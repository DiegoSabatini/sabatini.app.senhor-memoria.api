# Senhor Memória — API

A memória de saúde da família. Esta é a API da **fase 1**: perfis, cuidadores, cartão de emergência e organizador de remédios com aviso ao cuidador.

Veja também: [o problema](docs/PROBLEMA.md) · [planos e preços](docs/PLANOS.md)

## Stack

- **NestJS 11** + TypeScript
- **PostgreSQL 16** com **Prisma 6**
- Agendador interno (`@nestjs/schedule`) para doses e alertas
- Push via **Expo** (pronto para o app em React Native)

## Rodando localmente

Pré-requisitos: Node 22+ e Docker (ou um PostgreSQL próprio).

```bash
cp .env.example .env          # ajuste o JWT_SECRET
docker compose up -d          # sobe o Postgres
npm install
npm run db:migrate            # cria as tabelas
npm run start:dev
```

- API: http://localhost:3000
- Documentação interativa (Swagger): http://localhost:3000/docs

## Testes

```bash
npm test             # testes unitários (geração de doses e escalonamento)
npm run test:e2e     # fluxo completo contra o banco do .env
```

## Como funciona o organizador de remédios

1. O remédio é cadastrado com seus horários (ex.: 08:00 e 20:00, todos os dias ou em dias específicos).
2. A API cria as **doses** das próximas 48h, no fuso do perfil.
3. O app busca `GET /profiles/:id/doses/upcoming` e agenda **alarmes locais** no celular, que tocam mesmo sem internet.
4. A pessoa confirma com `POST /doses/:id/take` (ou `/skip`).
5. Se não confirmar, o agendador (a cada minuto) escalona:

| Tempo após o horário | Ação |
|---|---|
| `reminderRetryMinutes` (padrão 30) | Lembra a pessoa de novo |
| `caregiverAlertMinutes` (padrão 60) | Avisa os cuidadores ("A Maria ainda não confirmou...") |
| 6h (ou 1h após o aviso, se ele for mais tarde) | Marca a dose como perdida |

Quando a dose é confirmada depois do aviso, os cuidadores recebem "A Maria tomou o remédio".
Se o estoque for informado, a API desconta a cada dose e avisa quando restam ~5 dias.

## Rotas principais

| Área | Rotas |
|---|---|
| Conta | `POST /auth/register`, `POST /auth/login`, `GET /me`, `POST /me/devices` |
| Perfis | `GET/POST /profiles`, `GET/PATCH/DELETE /profiles/:id` |
| Cuidadores | `GET/POST /profiles/:id/members`, `PATCH /profiles/:id/members/me`, `DELETE /profiles/:id/members/:userId` |
| Cartão de emergência | `GET/PUT /profiles/:id/emergency-card`, `POST .../rotate-link`, `GET /emergency/:token` (público, via QR code) |
| Remédios | `GET/POST /profiles/:id/medications`, `GET/PATCH/DELETE /medications/:id` |
| Doses | `GET /profiles/:id/doses?date=`, `GET /profiles/:id/doses/upcoming`, `POST /doses/:id/take`, `POST /doses/:id/skip` |
| Adesão | `GET /profiles/:id/adherence?days=30` |

## Papéis e privacidade (LGPD)

- **OWNER**: quem criou o perfil (a própria pessoa ou o filho que cuida da mãe). Altera configurações, cartão e cuidadores.
- **CAREGIVER**: familiar convidado. Vê tudo, cadastra remédios e confirma doses.
- Quem não é membro recebe **404**, sem revelar que o perfil existe.
- O link público do cartão de emergência fica **desligado por padrão** e pode ser trocado a qualquer momento.

## Próximos passos

- [ ] Canal de **WhatsApp** (implementar `NotificationChannel` em `src/notifications`)
- [ ] Convite de cuidador por link (hoje a pessoa precisa já ter conta)
- [ ] Planos e limites por assinatura
- [ ] Rotas de admin mínimas (suporte e pedidos LGPD), com log de auditoria
- [ ] Fase 2: exames, leitura automática e linha do tempo
