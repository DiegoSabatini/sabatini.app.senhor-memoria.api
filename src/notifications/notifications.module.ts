import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpoPushChannel, LogChannel } from './channels';
import { NOTIFICATION_CHANNELS, NotificationChannel } from './notification.types';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  providers: [
    {
      provide: NOTIFICATION_CHANNELS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): NotificationChannel[] => {
        const channels: NotificationChannel[] = [new LogChannel()];
        if (config.get('PUSH_ENABLED') === 'true') channels.push(new ExpoPushChannel());
        // Próximo passo: WhatsAppChannel (API oficial do WhatsApp Business).
        return channels;
      },
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
