import { Logger } from '@nestjs/common';
import { NotificationChannel, NotificationMessage, Recipient } from './notification.types';

/** Registra no log. Útil em desenvolvimento e como trilha de auditoria. */
export class LogChannel implements NotificationChannel {
  readonly name = 'log';
  private readonly logger = new Logger('Notificação');

  async send(recipients: Recipient[], message: NotificationMessage) {
    for (const r of recipients) {
      this.logger.log(`→ ${r.name}: ${message.title} — ${message.body}`);
    }
  }
}

/** Push pelo serviço do Expo (funciona em Android e iPhone). */
export class ExpoPushChannel implements NotificationChannel {
  readonly name = 'expo-push';
  private readonly logger = new Logger(ExpoPushChannel.name);
  private static readonly URL = 'https://exp.host/--/api/v2/push/send';

  async send(recipients: Recipient[], message: NotificationMessage) {
    const tokens = recipients.flatMap((r) => r.pushTokens);
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100).map((to) => ({
        to,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        sound: 'default',
        priority: 'high',
      }));
      try {
        const res = await fetch(ExpoPushChannel.URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(batch),
        });
        if (!res.ok) this.logger.warn(`Expo push respondeu ${res.status}`);
      } catch (err) {
        this.logger.error(`Falha ao enviar push: ${(err as Error).message}`);
      }
    }
  }
}
