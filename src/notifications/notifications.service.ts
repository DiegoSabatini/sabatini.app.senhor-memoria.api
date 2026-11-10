import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_CHANNELS,
  NotificationChannel,
  NotificationMessage,
} from './notification.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[],
  ) {}

  async notifyUsers(userIds: string[], message: NotificationMessage) {
    if (userIds.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      include: { devices: true },
    });
    const recipients = users.map((u) => ({
      userId: u.id,
      name: u.name,
      phone: u.phone,
      pushTokens: u.devices.map((d) => d.pushToken),
    }));

    // Um canal com problema não pode impedir os outros de entregarem.
    await Promise.all(
      this.channels.map((channel) =>
        channel.send(recipients, message).catch((err) =>
          this.logger.error(`Canal ${channel.name} falhou: ${(err as Error).message}`),
        ),
      ),
    );
  }
}
