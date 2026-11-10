/**
 * Fluxo completo contra um Postgres real (DATABASE_URL do .env).
 * Cenário: a Maria usa o app, o filho Diego acompanha como cuidador.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DosesService } from '../src/doses/doses.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

process.env.SCHEDULER_ENABLED = 'false';
process.env.JWT_SECRET ??= 'test-secret';

describe('Remédios: lembrete, aviso ao cuidador e adesão', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let doses: DosesService;
  const sent: { userIds: string[]; title: string }[] = [];

  const run = randomUUID().slice(0, 8);
  let maria: { token: string; id: string };
  let diego: { token: string; id: string };
  let estranho: { token: string; id: string };
  let profileId: string;
  let medicationId: string;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function register(name: string) {
    const res = await http()
      .post('/auth/register')
      .send({ name, email: `${name.toLowerCase()}-${run}@teste.com`, password: 'senha-forte-123' })
      .expect(201);
    return { token: res.body.accessToken, id: res.body.user.id };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NotificationsService)
      .useValue({
        notifyUsers: async (userIds: string[], msg: { title: string }) => {
          sent.push({ userIds, title: msg.title });
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    doses = app.get(DosesService);

    maria = await register('Maria');
    diego = await register('Diego');
    estranho = await register('Estranho');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@teste.com` } } });
    await prisma.profile.deleteMany({ where: { id: profileId } });
    await app.close();
  });

  it('exige login', async () => {
    await http().get('/profiles').expect(401);
    await http().get('/health').expect(200);
  });

  it('Maria cria o próprio perfil e adiciona o Diego como cuidador', async () => {
    const res = await http()
      .post('/profiles')
      .set(auth(maria.token))
      .send({ name: 'Maria', birthDate: '1955-03-10', isSelf: true })
      .expect(201);
    profileId = res.body.id;
    expect(res.body.patientUserId).toBe(maria.id);

    const members = await http()
      .post(`/profiles/${profileId}/members`)
      .set(auth(maria.token))
      .send({ email: `diego-${run}@teste.com` })
      .expect(201);
    expect(members.body.map((m: { role: string }) => m.role)).toEqual(['OWNER', 'CAREGIVER']);

    const list = await http().get('/profiles').set(auth(diego.token)).expect(200);
    expect(list.body[0]).toMatchObject({ id: profileId, myRole: 'CAREGIVER' });
  });

  it('quem não é membro não vê o perfil', async () => {
    await http().get(`/profiles/${profileId}`).set(auth(estranho.token)).expect(404);
    await http().get(`/profiles/${profileId}/medications`).set(auth(estranho.token)).expect(404);
  });

  it('cuidador não altera configurações do perfil', async () => {
    await http()
      .patch(`/profiles/${profileId}`)
      .set(auth(diego.token))
      .send({ caregiverAlertMinutes: 30 })
      .expect(403);
  });

  it('valida os dados do remédio', async () => {
    await http()
      .post(`/profiles/${profileId}/medications`)
      .set(auth(maria.token))
      .send({ name: 'Losartana', dosage: '50 mg', schedules: [{ time: '25:00' }] })
      .expect(400);
  });

  it('cadastra o remédio e gera as doses futuras', async () => {
    const res = await http()
      .post(`/profiles/${profileId}/medications`)
      .set(auth(diego.token)) // o cuidador também pode cadastrar
      .send({
        name: 'Losartana',
        dosage: '50 mg',
        stockQuantity: 12,
        schedules: [{ time: '08:00' }, { time: '20:00' }],
      })
      .expect(201);
    medicationId = res.body.id;
    expect(res.body.schedules.map((s: { time: string }) => s.time)).toEqual(['08:00', '20:00']);

    const upcoming = await http()
      .get(`/profiles/${profileId}/doses/upcoming?hours=48`)
      .set(auth(maria.token))
      .expect(200);
    expect(upcoming.body.length).toBeGreaterThanOrEqual(3);
    expect(upcoming.body.every((d: { status: string }) => d.status === 'PENDING')).toBe(true);
  });

  it('o cartão de emergência mostra os remédios em uso', async () => {
    const card = await http()
      .put(`/profiles/${profileId}/emergency-card`)
      .set(auth(maria.token))
      .send({
        bloodType: 'O+',
        allergies: ['Dipirona'],
        conditions: ['Hipertensão'],
        contacts: [{ name: 'Diego', phone: '+5511999999999', relationship: 'Filho' }],
      })
      .expect(200);
    expect(card.body.medications).toEqual([{ name: 'Losartana', dosage: '50 mg' }]);
    expect(card.body.age).toBeGreaterThanOrEqual(70);

    // Link público só funciona se a pessoa permitir
    await http().get(`/emergency/${card.body.emergencyToken}`).expect(404);
    await http()
      .put(`/profiles/${profileId}/emergency-card`)
      .set(auth(maria.token))
      .send({ emergencyPublic: true })
      .expect(200);
    const pub = await http().get(`/emergency/${card.body.emergencyToken}`).expect(200);
    expect(pub.body).toMatchObject({ name: 'Maria', bloodType: 'O+', allergies: ['Dipirona'] });
    expect(pub.body.profileId).toBeUndefined();
    expect(pub.body.emergencyToken).toBeUndefined();
  });

  it('escalona: lembra a Maria, depois avisa o Diego, e o tranquiliza quando ela confirma', async () => {
    const scheduledAt = new Date(Date.now() - 2 * 3_600_000);
    const dose = await prisma.doseEvent.create({
      data: { profileId, medicationId, scheduledAt },
    });
    const later = (min: number) => new Date(scheduledAt.getTime() + min * 60_000);
    sent.length = 0;

    await doses.runEscalation(later(31));
    expect(sent).toEqual([{ userIds: [maria.id], title: 'Já tomou o remédio?' }]);

    await doses.runEscalation(later(32)); // não repete
    expect(sent).toHaveLength(1);

    await doses.runEscalation(later(61));
    expect(sent[1]).toEqual({
      userIds: [diego.id],
      title: 'Maria ainda não confirmou o remédio',
    });

    await doses.runEscalation(later(62)); // não repete
    expect(sent).toHaveLength(2);

    const taken = await http().post(`/doses/${dose.id}/take`).set(auth(maria.token)).send({}).expect(200);
    expect(taken.body.status).toBe('TAKEN');
    expect(sent[2]).toEqual({ userIds: [diego.id], title: 'Maria tomou o remédio' });

    const med = await prisma.medication.findUniqueOrThrow({ where: { id: medicationId } });
    expect(med.stockQuantity).toBe(11);
  });

  it('marca como perdida quando ninguém confirma', async () => {
    const scheduledAt = new Date(Date.now() - 7 * 3_600_000);
    const dose = await prisma.doseEvent.create({
      data: { profileId, medicationId, scheduledAt, remindersSent: 1, caregiverAlertedAt: new Date() },
    });
    await doses.runEscalation(new Date());
    const after = await prisma.doseEvent.findUniqueOrThrow({ where: { id: dose.id } });
    expect(after.status).toBe('MISSED');
  });

  it('avisa quando a caixa está acabando', async () => {
    sent.length = 0;
    // 2 horários × 1 unidade × 5 dias = limite de 10 unidades
    const dose = await prisma.doseEvent.create({
      data: { profileId, medicationId, scheduledAt: new Date(Date.now() - 3_600_000) },
    });
    await http().post(`/doses/${dose.id}/take`).set(auth(diego.token)).send({}).expect(200);
    expect(sent.map((s) => s.title)).toContain('Losartana está acabando');
  });

  it('calcula a adesão', async () => {
    const res = await http()
      .get(`/profiles/${profileId}/adherence?days=1`)
      .set(auth(diego.token))
      .expect(200);
    expect(res.body).toMatchObject({ taken: 2, missed: 1, skipped: 0 });
    expect(res.body.rate).toBe(66.7);
    expect(res.body.medications[0].name).toBe('Losartana');
  });

  it('alterar horários recria as doses futuras', async () => {
    await http()
      .patch(`/medications/${medicationId}`)
      .set(auth(maria.token))
      .send({ schedules: [{ time: '09:30' }] })
      .expect(200);
    const upcoming = await http()
      .get(`/profiles/${profileId}/doses/upcoming`)
      .set(auth(maria.token))
      .expect(200);
    const times = new Set(
      upcoming.body.map((d: { scheduledAt: string }) =>
        new Date(d.scheduledAt).toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
        }),
      ),
    );
    expect([...times]).toEqual(['09:30']);
  });
});
