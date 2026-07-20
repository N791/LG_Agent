import { Module, Global } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationPublisher } from './notification.publisher';
import { NotificationGateway } from './notification.gateway';
import { NOTIFICATION_PUBLISHER } from './notification-publisher.interface';

@Global()
@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    {
      provide: NOTIFICATION_PUBLISHER,
      useClass: NotificationPublisher,
    },
  ],
  exports: [NotificationService, NOTIFICATION_PUBLISHER],
})
export class NotificationModule {}
