import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DosesService } from './doses.service';

/**
 * Tarefas periódicas das doses.
 * Atenção: com mais de uma instância da API, deixe SCHEDULER_ENABLED=true em apenas uma
 * (as atualizações são idempotentes, mas evita trabalho repetido).
 */
@Injectable()
export class DoseSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DoseSchedulerService.name);
  private readonly enabled: boolean;
  private running = false;

  constructor(
    private readonly doses: DosesService,
    config: ConfigService,
  ) {
    this.enabled = config.get('SCHEDULER_ENABLED', 'true') === 'true';
  }

  async onApplicationBootstrap() {
    if (this.enabled) await this.generate();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async generate() {
    if (!this.enabled) return;
    const created = await this.doses.generateUpcoming();
    if (created > 0) this.logger.log(`${created} dose(s) criada(s) para as próximas horas`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async escalate() {
    if (!this.enabled || this.running) return;
    this.running = true;
    try {
      const r = await this.doses.runEscalation();
      if (r.reminded || r.caregiversAlerted || r.missed) {
        this.logger.log(
          `Lembretes: ${r.reminded} · cuidadores avisados: ${r.caregiversAlerted} · perdidas: ${r.missed}`,
        );
      }
    } catch (err) {
      this.logger.error(`Falha no escalonamento: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
