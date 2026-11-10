import { generateOccurrences } from './dose-generation';

const TZ = 'America/Sao_Paulo'; // UTC-3, sem horário de verão
const d = (iso: string) => new Date(iso);
const iso = (list: { scheduledAt: Date }[]) => list.map((o) => o.scheduledAt.toISOString());

describe('generateOccurrences', () => {
  const daily = {
    startDate: d('2026-11-01'),
    endDate: null,
    schedules: [
      { id: 's8', time: '08:00', daysOfWeek: [] },
      { id: 's20', time: '20:00', daysOfWeek: [] },
    ],
  };

  it('gera os horários no fuso do perfil', () => {
    // 09/11 00:00 a 10/11 00:00 em São Paulo
    const out = generateOccurrences(daily, TZ, d('2026-11-09T03:00:00Z'), d('2026-11-10T03:00:00Z'));
    expect(iso(out)).toEqual(['2026-11-09T11:00:00.000Z', '2026-11-09T23:00:00.000Z']);
  });

  it('não gera horários antes do início da janela (agora)', () => {
    // agora = 09/11 10:00 em SP → só a dose das 20h
    const out = generateOccurrences(daily, TZ, d('2026-11-09T13:00:00Z'), d('2026-11-10T03:00:00Z'));
    expect(iso(out)).toEqual(['2026-11-09T23:00:00.000Z']);
  });

  it('respeita os dias da semana (1 = segunda)', () => {
    const med = {
      ...daily,
      schedules: [{ id: 'mwf', time: '09:00', daysOfWeek: [1, 3, 5] }],
    };
    // 09/11/2026 é segunda; uma semana inteira
    const out = generateOccurrences(med, TZ, d('2026-11-09T03:00:00Z'), d('2026-11-16T03:00:00Z'));
    expect(iso(out)).toEqual([
      '2026-11-09T12:00:00.000Z',
      '2026-11-11T12:00:00.000Z',
      '2026-11-13T12:00:00.000Z',
    ]);
  });

  it('respeita início e fim do tratamento', () => {
    const med = { ...daily, startDate: d('2026-11-10'), endDate: d('2026-11-11') };
    const out = generateOccurrences(med, TZ, d('2026-11-09T03:00:00Z'), d('2026-11-13T03:00:00Z'));
    expect(out).toHaveLength(4); // 10 e 11, duas por dia
    expect(out[0].scheduledAt.toISOString()).toBe('2026-11-10T11:00:00.000Z');
    expect(out[3].scheduledAt.toISOString()).toBe('2026-11-11T23:00:00.000Z');
  });

  it('funciona em outros fusos', () => {
    const out = generateOccurrences(
      { ...daily, schedules: [{ id: 'x', time: '08:00', daysOfWeek: [] }] },
      'America/Manaus', // UTC-4
      d('2026-11-09T04:00:00Z'),
      d('2026-11-10T04:00:00Z'),
    );
    expect(iso(out)).toEqual(['2026-11-09T12:00:00.000Z']);
  });
});
