import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DoseStatus, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileAccessService } from '../profiles/profile-access.service';
import { generateOccurrences } from './dose-generation';
import { decideEscalation } from './escalation';

/** Quantas horas à frente as doses ficam criadas no banco. */
export const GENERATION_HORIZON_HOURS = 48;
/** Até quantos dias à frente o app pode consultar a agenda. */
const MAX_DAYS_AHEAD = 31;
/** Avisa quando a caixa der para menos que isso. */
const LOW_STOCK_DAYS = 5;

const doseInclude = {
  medication: { select: { id: true, name: true, dosage: true, instructions: true } },
} satisfies Prisma.DoseEventInclude;

@Injectable()
export class DosesService {
  private readonly logger = new Logger(DosesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProfileAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- Geração de doses ----------

  /** Cria as doses das próximas horas para todos os remédios ativos. */
  async generateUpcoming(now = new Date()) {
    const to = new Date(now.getTime() + GENERATION_HORIZON_HOURS * 3_600_000);
    return this.generate({ active: true }, now, to);
  }

  /** Recalcula as doses futuras de um remédio depois de uma mudança. */
  async regenerateForMedication(medicationId: string, now = new Date()) {
    await this.prisma.doseEvent.deleteMany({
      where: { medicationId, status: DoseStatus.PENDING, scheduledAt: { gt: now } },
    });
    const to = new Date(now.getTime() + GENERATION_HORIZON_HOURS * 3_600_000);
    return this.generate({ id: medicationId, active: true }, now, to);
  }

  /**
   * Só gera doses a partir de "agora": um remédio cadastrado às 10h
   * não cria a dose das 8h do mesmo dia (que dispararia alerta falso).
   */
  private async generate(where: Prisma.MedicationWhereInput, from: Date, to: Date) {
    if (to <= from) return 0;
    const medications = await this.prisma.medication.findMany({
      where,
      include: { schedules: true, profile: { select: { timezone: true } } },
    });

    const data = medications.flatMap((m) =>
      generateOccurrences(m, m.profile.timezone, from, to).map((o) => ({
        profileId: m.profileId,
        medicationId: m.id,
        scheduleId: o.scheduleId,
        scheduledAt: o.scheduledAt,
      })),
    );
    if (data.length === 0) return 0;
    const { count } = await this.prisma.doseEvent.createMany({ data, skipDuplicates: true });
    return count;
  }

  // ---------- Consulta ----------

  /** Agenda de um dia (no fuso do perfil). */
  async listDay(userId: string, profileId: string, date?: string, now = new Date()) {
    await this.access.assertMember(userId, profileId);
    const { timezone } = await this.prisma.profile.findUniqueOrThrow({ where: { id: profileId } });

    const dayStart = date
      ? DateTime.fromISO(date, { zone: timezone }).startOf('day')
      : DateTime.fromJSDate(now).setZone(timezone).startOf('day');
    if (!dayStart.isValid) throw new BadRequestException('Data inválida');
    const dayEnd = dayStart.plus({ days: 1 });

    const limit = DateTime.fromJSDate(now).plus({ days: MAX_DAYS_AHEAD });
    if (dayStart > limit) {
      throw new BadRequestException(`Consulte no máximo ${MAX_DAYS_AHEAD} dias à frente`);
    }
    // Dias além do horizonte padrão são gerados sob demanda.
    if (dayEnd.toJSDate() > now) {
      const from = new Date(Math.max(now.getTime(), dayStart.toMillis()));
      await this.generate({ profileId, active: true }, from, dayEnd.toJSDate());
    }

    return this.prisma.doseEvent.findMany({
      where: { profileId, scheduledAt: { gte: dayStart.toJSDate(), lt: dayEnd.toJSDate() } },
      include: doseInclude,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /** Próximas doses pendentes: o app usa para agendar os alarmes locais no celular. */
  async listUpcoming(userId: string, profileId: string, hours = 48, now = new Date()) {
    await this.access.assertMember(userId, profileId);
    const to = new Date(now.getTime() + hours * 3_600_000);
    await this.generate({ profileId, active: true }, now, to);
    return this.prisma.doseEvent.findMany({
      where: { profileId, status: DoseStatus.PENDING, scheduledAt: { gte: now, lt: to } },
      include: doseInclude,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // ---------- Confirmação ----------

  async confirm(
    userId: string,
    doseId: string,
    status: 'TAKEN' | 'SKIPPED',
    note?: string,
    now = new Date(),
  ) {
    const dose = await this.prisma.doseEvent.findUnique({
      where: { id: doseId },
      include: {
        medication: { include: { schedules: true } },
        profile: { include: { members: true } },
      },
    });
    if (!dose) throw new NotFoundException('Dose não encontrada');
    await this.access.assertMember(userId, dose.profileId);

    if (dose.scheduledAt.getTime() - now.getTime() > 2 * 3_600_000) {
      throw new BadRequestException('Só é possível confirmar doses a partir de 2h antes do horário');
    }
    if (dose.status === status) {
      return this.prisma.doseEvent.findUniqueOrThrow({ where: { id: doseId }, include: doseInclude });
    }

    const updated = await this.prisma.doseEvent.update({
      where: { id: doseId },
      data: { status, confirmedAt: now, confirmedById: userId, note },
      include: doseInclude,
    });

    await this.adjustStock(dose, status);

    // Se os cuidadores já tinham sido avisados, tranquiliza-os.
    if (status === DoseStatus.TAKEN && dose.caregiverAlertedAt) {
      const caregivers = this.caregiverIds(dose.profile);
      await this.notifications.notifyUsers(caregivers, {
        title: `${dose.profile.name} tomou o remédio`,
        body: `${dose.medication.name} ${dose.medication.dosage} confirmado às ${this.time(now, dose.profile.timezone)}.`,
        data: { type: 'DOSE_CONFIRMED', doseId, profileId: dose.profileId },
      });
    }
    return updated;
  }

  private async adjustStock(
    dose: {
      status: DoseStatus;
      medication: {
        id: string;
        name: string;
        stockQuantity: number | null;
        unitsPerDose: number;
        schedules: unknown[];
      };
      profile: { id: string; name: string; members: { userId: string }[] };
    },
    newStatus: DoseStatus,
  ) {
    const med = dose.medication;
    if (med.stockQuantity === null) return;

    let delta = 0;
    if (newStatus === DoseStatus.TAKEN && dose.status !== DoseStatus.TAKEN) delta = -med.unitsPerDose;
    if (dose.status === DoseStatus.TAKEN && newStatus !== DoseStatus.TAKEN) delta = med.unitsPerDose;
    if (delta === 0) return;

    const before = med.stockQuantity;
    const after = Math.max(0, before + delta);
    await this.prisma.medication.update({ where: { id: med.id }, data: { stockQuantity: after } });

    const threshold = med.unitsPerDose * Math.max(1, med.schedules.length) * LOW_STOCK_DAYS;
    if (before > threshold && after <= threshold) {
      await this.notifications.notifyUsers(
        dose.profile.members.map((m) => m.userId),
        {
          title: `${med.name} está acabando`,
          body: `Restam ${after} unidade(s) para ${dose.profile.name}. Hora de comprar mais.`,
          data: { type: 'LOW_STOCK', medicationId: med.id, profileId: dose.profile.id },
        },
      );
    }
  }

  // ---------- Adesão ----------

  async adherence(userId: string, profileId: string, days = 30, now = new Date()) {
    await this.access.assertMember(userId, profileId);
    const from = new Date(now.getTime() - days * 86_400_000);
    const doses = await this.prisma.doseEvent.findMany({
      where: { profileId, scheduledAt: { gte: from, lte: now } },
      select: { status: true, medication: { select: { id: true, name: true, dosage: true } } },
    });

    const summarize = (list: { status: DoseStatus }[]) => {
      const count = (s: DoseStatus) => list.filter((d) => d.status === s).length;
      const taken = count(DoseStatus.TAKEN);
      const skipped = count(DoseStatus.SKIPPED);
      const missed = count(DoseStatus.MISSED);
      const pending = count(DoseStatus.PENDING);
      const resolved = taken + skipped + missed;
      return {
        taken,
        skipped,
        missed,
        pending,
        /** % de doses tomadas entre as que já deveriam ter sido resolvidas. */
        rate: resolved === 0 ? null : Math.round((taken / resolved) * 1000) / 10,
      };
    };

    const byMedication = new Map<string, { name: string; dosage: string; doses: typeof doses }>();
    for (const d of doses) {
      const entry = byMedication.get(d.medication.id) ?? {
        name: d.medication.name,
        dosage: d.medication.dosage,
        doses: [],
      };
      entry.doses.push(d);
      byMedication.set(d.medication.id, entry);
    }

    return {
      days,
      ...summarize(doses),
      medications: [...byMedication.entries()].map(([medicationId, m]) => ({
        medicationId,
        name: m.name,
        dosage: m.dosage,
        ...summarize(m.doses),
      })),
    };
  }

  // ---------- Escalonamento ----------

  /**
   * Roda a cada minuto. Para cada dose pendente decide:
   * lembrar a pessoa de novo → avisar os cuidadores → marcar como perdida.
   * As atualizações são condicionais para não notificar duas vezes.
   */
  async runEscalation(now = new Date()) {
    const result = { reminded: 0, caregiversAlerted: 0, missed: 0 };

    // Doses muito antigas (ex.: servidor ficou fora do ar) viram perdidas sem notificar.
    const stale = await this.prisma.doseEvent.updateMany({
      where: { status: DoseStatus.PENDING, scheduledAt: { lt: new Date(now.getTime() - 86_400_000) } },
      data: { status: DoseStatus.MISSED },
    });
    result.missed += stale.count;

    const pending = await this.prisma.doseEvent.findMany({
      where: { status: DoseStatus.PENDING, scheduledAt: { lte: now } },
      include: {
        medication: { select: { name: true, dosage: true } },
        profile: { include: { members: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 1000,
    });

    for (const dose of pending) {
      const action = decideEscalation(dose, dose.profile, now);
      const at = this.time(dose.scheduledAt, dose.profile.timezone);
      const med = `${dose.medication.name} ${dose.medication.dosage}`;

      try {
        if (action === 'REMIND_PATIENT') {
          const { count } = await this.prisma.doseEvent.updateMany({
            where: { id: dose.id, status: DoseStatus.PENDING, remindersSent: 0 },
            data: { remindersSent: 1, lastReminderAt: now },
          });
          if (count === 1 && dose.profile.patientUserId) {
            await this.notifications.notifyUsers([dose.profile.patientUserId], {
              title: 'Já tomou o remédio?',
              body: `${med} das ${at}. Toque para confirmar.`,
              data: { type: 'DOSE_REMINDER', doseId: dose.id, profileId: dose.profileId },
            });
          }
          if (count === 1) result.reminded++;
        }

        if (action === 'ALERT_CAREGIVERS') {
          const { count } = await this.prisma.doseEvent.updateMany({
            where: { id: dose.id, status: DoseStatus.PENDING, caregiverAlertedAt: null },
            data: { caregiverAlertedAt: now },
          });
          if (count === 1) {
            await this.notifications.notifyUsers(this.caregiverIds(dose.profile), {
              title: `${dose.profile.name} ainda não confirmou o remédio`,
              body: `${med} das ${at} não foi confirmado.`,
              data: { type: 'DOSE_NOT_CONFIRMED', doseId: dose.id, profileId: dose.profileId },
            });
            result.caregiversAlerted++;
          }
        }

        if (action === 'MARK_MISSED') {
          const { count } = await this.prisma.doseEvent.updateMany({
            where: { id: dose.id, status: DoseStatus.PENDING },
            data: { status: DoseStatus.MISSED },
          });
          result.missed += count;
        }
      } catch (err) {
        this.logger.error(`Falha ao escalonar dose ${dose.id}: ${(err as Error).message}`);
      }
    }
    return result;
  }

  /** Quem deve ser avisado: membros com aviso ligado, exceto a própria pessoa. */
  private caregiverIds(profile: {
    patientUserId: string | null;
    members: { userId: string; notifyMissedDoses: boolean }[];
  }) {
    return profile.members
      .filter((m) => m.notifyMissedDoses && m.userId !== profile.patientUserId)
      .map((m) => m.userId);
  }

  private time(date: Date, timezone: string) {
    return DateTime.fromJSDate(date).setZone(timezone).toFormat('HH:mm');
  }
}
