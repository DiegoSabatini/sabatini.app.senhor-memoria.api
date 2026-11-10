export interface NotificationMessage {
  title: string;
  body: string;
  /** Dados extras para o app abrir a tela certa (ex.: { doseId }). */
  data?: Record<string, unknown>;
}

export interface Recipient {
  userId: string;
  name: string;
  phone: string | null;
  pushTokens: string[];
}

/**
 * Um canal de entrega (push, WhatsApp, e-mail...).
 * Para adicionar o WhatsApp, basta criar uma classe que implemente esta interface.
 */
export interface NotificationChannel {
  readonly name: string;
  send(recipients: Recipient[], message: NotificationMessage): Promise<void>;
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
