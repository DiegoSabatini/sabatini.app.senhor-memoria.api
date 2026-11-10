export type EscalationAction = 'NONE' | 'REMIND_PATIENT' | 'ALERT_CAREGIVERS' | 'MARK_MISSED';

export interface PendingDose {
  scheduledAt: Date;
  remindersSent: number;
  caregiverAlertedAt: Date | null;
}

export interface EscalationSettings {
  reminderRetryMinutes: number;
  caregiverAlertMinutes: number;
}

/** Depois disso a dose é marcada como perdida (ainda pode ser confirmada depois). */
export const missedAfterMinutes = (s: EscalationSettings) =>
  Math.max(6 * 60, s.caregiverAlertMinutes + 60);

/**
 * Decide o próximo passo para uma dose não confirmada:
 *   horário → (lembrete local no celular)
 *   + reminderRetryMinutes → lembra a pessoa de novo
 *   + caregiverAlertMinutes → avisa os cuidadores
 *   + missedAfterMinutes → marca como perdida
 */
export function decideEscalation(
  dose: PendingDose,
  settings: EscalationSettings,
  now: Date,
): EscalationAction {
  const elapsed = (now.getTime() - dose.scheduledAt.getTime()) / 60_000;
  if (elapsed < 0) return 'NONE';

  if (elapsed >= missedAfterMinutes(settings)) return 'MARK_MISSED';

  if (elapsed >= settings.caregiverAlertMinutes) {
    return dose.caregiverAlertedAt ? 'NONE' : 'ALERT_CAREGIVERS';
  }

  if (elapsed >= settings.reminderRetryMinutes && dose.remindersSent === 0) {
    return 'REMIND_PATIENT';
  }

  return 'NONE';
}
