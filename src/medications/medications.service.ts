import { Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { DosesService } from '../doses/doses.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileAccessService } from '../profiles/profile-access.service';
import { CreateMedicationDto, ScheduleDto, UpdateMedicationDto } from './dto/medication.dto';

const withSchedules = { schedules: { orderBy: { time: 'asc' as const } } };

@Injectable()
export class MedicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProfileAccessService,
    private readonly doses: DosesService,
  ) {}

  async list(userId: string, profileId: string, includeInactive = false) {
    await this.access.assertMember(userId, profileId);
    return this.prisma.medication.findMany({
      where: { profileId, ...(includeInactive ? {} : { active: true }) },
      include: withSchedules,
      orderBy: { name: 'asc' },
    });
  }

  async create(userId: string, profileId: string, dto: CreateMedicationDto) {
    await this.access.assertMember(userId, profileId);
    const profile = await this.prisma.profile.findUniqueOrThrow({ where: { id: profileId } });
    const today = DateTime.now().setZone(profile.timezone).toISODate()!;

    const medication = await this.prisma.medication.create({
      data: {
        profileId,
        name: dto.name.trim(),
        dosage: dto.dosage.trim(),
        instructions: dto.instructions,
        startDate: new Date(dto.startDate ?? today),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        stockQuantity: dto.stockQuantity,
        unitsPerDose: dto.unitsPerDose,
        schedules: { create: this.normalizeSchedules(dto.schedules) },
      },
      include: withSchedules,
    });
    await this.doses.regenerateForMedication(medication.id);
    return medication;
  }

  async get(userId: string, medicationId: string) {
    const medication = await this.findAccessible(userId, medicationId);
    return medication;
  }

  async update(userId: string, medicationId: string, dto: UpdateMedicationDto) {
    await this.findAccessible(userId, medicationId);
    const { schedules, startDate, endDate, ...fields } = dto;

    await this.prisma.$transaction(async (tx) => {
      await tx.medication.update({
        where: { id: medicationId },
        data: {
          ...fields,
          name: fields.name?.trim(),
          dosage: fields.dosage?.trim(),
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate === null ? null : endDate ? new Date(endDate) : undefined,
        },
      });
      if (schedules) {
        await tx.medicationSchedule.deleteMany({ where: { medicationId } });
        await tx.medicationSchedule.createMany({
          data: this.normalizeSchedules(schedules).map((s) => ({ ...s, medicationId })),
        });
      }
    });

    await this.doses.regenerateForMedication(medicationId);
    return this.prisma.medication.findUniqueOrThrow({
      where: { id: medicationId },
      include: withSchedules,
    });
  }

  /** Encerra o remédio sem apagar o histórico de adesão. */
  async deactivate(userId: string, medicationId: string) {
    await this.findAccessible(userId, medicationId);
    await this.prisma.medication.update({
      where: { id: medicationId },
      data: { active: false },
    });
    await this.doses.regenerateForMedication(medicationId);
  }

  private async findAccessible(userId: string, medicationId: string) {
    const medication = await this.prisma.medication.findUnique({
      where: { id: medicationId },
      include: withSchedules,
    });
    if (!medication) throw new NotFoundException('Remédio não encontrado');
    await this.access.assertMember(userId, medication.profileId);
    return medication;
  }

  private normalizeSchedules(schedules: ScheduleDto[]) {
    const seen = new Set<string>();
    return schedules
      .map((s) => ({
        time: s.time,
        daysOfWeek: [...new Set(s.daysOfWeek ?? [])].sort(),
      }))
      .filter((s) => {
        const key = `${s.time}|${s.daysOfWeek.join(',')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }
}
