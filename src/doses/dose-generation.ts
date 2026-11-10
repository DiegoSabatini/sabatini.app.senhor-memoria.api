import { DateTime } from 'luxon';

export interface ScheduleInput {
  id: string;
  /** "HH:mm" no fuso do perfil */
  time: string;
  /** 1 = segunda ... 7 = domingo. Vazio = todos os dias. */
  daysOfWeek: number[];
}

export interface MedicationInput {
  /** Datas "de calendário" (@db.Date chegam como meia-noite UTC). */
  startDate: Date;
  endDate: Date | null;
  schedules: ScheduleInput[];
}

export interface Occurrence {
  scheduleId: string;
  scheduledAt: Date;
}

const calendarDate = (d: Date) => DateTime.fromJSDate(d, { zone: 'utc' }).toISODate()!;

/**
 * Calcula os horários de dose de um remédio dentro da janela [from, to),
 * respeitando o fuso do perfil, os dias da semana e o período do tratamento.
 */
export function generateOccurrences(
  medication: MedicationInput,
  timezone: string,
  from: Date,
  to: Date,
): Occurrence[] {
  const start = calendarDate(medication.startDate);
  const end = medication.endDate ? calendarDate(medication.endDate) : null;
  const windowStart = from.getTime();
  const windowEnd = to.getTime();

  const occurrences: Occurrence[] = [];
  let day = DateTime.fromJSDate(from).setZone(timezone).startOf('day');
  const lastDay = DateTime.fromJSDate(to).setZone(timezone).startOf('day');

  while (day <= lastDay) {
    const isoDay = day.toISODate()!;
    const inTreatment = isoDay >= start && (end === null || isoDay <= end);

    if (inTreatment) {
      for (const schedule of medication.schedules) {
        if (schedule.daysOfWeek.length > 0 && !schedule.daysOfWeek.includes(day.weekday)) {
          continue;
        }
        const [hour, minute] = schedule.time.split(':').map(Number);
        const at = day.set({ hour, minute, second: 0, millisecond: 0 });
        const ms = at.toMillis();
        if (ms >= windowStart && ms < windowEnd) {
          occurrences.push({ scheduleId: schedule.id, scheduledAt: at.toJSDate() });
        }
      }
    }
    day = day.plus({ days: 1 });
  }

  return occurrences.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}
