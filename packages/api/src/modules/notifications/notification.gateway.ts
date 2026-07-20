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

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*',
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.['token'] as string) ??
        (client.handshake.query?.['token'] as string);

      if (!token) {
        client.disconnect();
        return;
      }

      const secret = process.env['JWT_SECRET'] ?? 'default-secret';
      const decoded = jwt.verify(token, secret) as { sub: string };
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
