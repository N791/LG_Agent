import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { NotificationDTO } from '@lg-agent/contracts';
import * as jwt from 'jsonwebtoken';
import { Inject } from '@nestjs/common';
import { AUTH_CONFIG, type AuthConfig } from '../auth/auth-config.module';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*',
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(@Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig) {}
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth['token'] as string | undefined) ??
        (client.handshake.query['token'] as string | undefined);

      if (!token) {
        client.disconnect();
        return;
      }

      const decoded = jwt.verify(token, this.authConfig.secret, {
        algorithms: [this.authConfig.algorithm],
      }) as { sub: string; tokenType?: string; mustChangePassword?: boolean };
      if (decoded.tokenType !== 'access' || decoded.mustChangePassword) {
        client.disconnect();
        return;
      }
      const userId = decoded.sub;

      if (!userId) {
        client.disconnect();
        return;
      }

      // Join user-specific room
      void client.join(`user:${userId}`);
      this.logger.log(`Client ${client.id} joined room user:${userId}`);
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}: ${(error as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Push a new notification to a specific user.
   */
  pushNotification(userId: string, notification: NotificationDTO): void {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }

  /**
   * Push updated unread count to a specific user.
   */
  pushUnreadCount(userId: string, count: number): void {
    this.server.to(`user:${userId}`).emit('notification:count', { count });
  }
}
