import { decideEscalation } from './escalation';

const settings = { reminderRetryMinutes: 30, caregiverAlertMinutes: 60 };
const at = new Date('2026-11-09T11:00:00Z');
const plus = (min: number) => new Date(at.getTime() + min * 60_000);
const fresh = { scheduledAt: at, remindersSent: 0, caregiverAlertedAt: null };

describe('decideEscalation', () => {
  it('não faz nada antes do horário nem logo depois', () => {
    expect(decideEscalation(fresh, settings, plus(-5))).toBe('NONE');
    expect(decideEscalation(fresh, settings, plus(10))).toBe('NONE');
  });

  it('lembra a pessoa de novo após o tempo configurado, uma única vez', () => {
    expect(decideEscalation(fresh, settings, plus(30))).toBe('REMIND_PATIENT');
    expect(decideEscalation({ ...fresh, remindersSent: 1 }, settings, plus(45))).toBe('NONE');
  });

  it('avisa os cuidadores, uma única vez', () => {
    expect(decideEscalation({ ...fresh, remindersSent: 1 }, settings, plus(60))).toBe('ALERT_CAREGIVERS');
    // Mesmo que o lembrete não tenha saído, o cuidador é avisado
    expect(decideEscalation(fresh, settings, plus(61))).toBe('ALERT_CAREGIVERS');
    expect(
      decideEscalation({ ...fresh, remindersSent: 1, caregiverAlertedAt: plus(60) }, settings, plus(90)),
    ).toBe('NONE');
  });

  it('marca como perdida depois de 6h', () => {
    expect(decideEscalation({ ...fresh, caregiverAlertedAt: plus(60) }, settings, plus(360))).toBe(
      'MARK_MISSED',
    );
  });

  it('quando o aviso ao cuidador é tardio, a dose só é perdida depois dele', () => {
    const late = { reminderRetryMinutes: 30, caregiverAlertMinutes: 600 };
    expect(decideEscalation(fresh, late, plus(600))).toBe('ALERT_CAREGIVERS');
    expect(decideEscalation(fresh, late, plus(660))).toBe('MARK_MISSED');
  });
});
