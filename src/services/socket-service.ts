import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { KafkaService } from './kafka-service';
import { RedisClient } from '../config/redis';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

export class SocketService {
  private io: Server;
  private kafkaService: KafkaService;

  constructor(io: Server) {
    this.io = io;
    this.kafkaService = KafkaService.getInstance();

    // Subscribe to Redis messages
    RedisClient.subscribe('MESSAGES', this.handleRedisMessage.bind(this));
  }

  initListeners(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`Socket connected: ${socket.id}, userId: ${socket.userId}`);

      // Join user to their personal room
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      // Handle joining rooms
      socket.on('join:room', (roomId: string) => {
        socket.join(`room:${roomId}`);
        logger.info(`Socket ${socket.id} joined room: ${roomId}`);
      });

      // Handle leaving rooms
      socket.on('leave:room', (roomId: string) => {
        socket.leave(`room:${roomId}`);
        logger.info(`Socket ${socket.id} left room: ${roomId}`);
      });

      // Handle sending messages
      socket.on(
        'message:send',
        async (data: { text: string; roomId?: string }) => {
          try {
            const message = {
              text: data.text,
              userId: socket.userId,
              roomId: data.roomId || 'global',
              timestamp: new Date().toISOString(),
            };

            // Publish to Redis for real-time distribution
            await RedisClient.publish('MESSAGES', JSON.stringify(message));

            // Send to Kafka for persistence
            await this.kafkaService.produceMessage('MESSAGES', message);

            logger.info(`Message sent by ${socket.userId}: ${data.text}`);
          } catch (error) {
            logger.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
          }
        },
      );

      // Handle typing events
      socket.on('typing:start', (roomId: string) => {
        socket.to(`room:${roomId}`).emit('typing:user', {
          userId: socket.userId,
          isTyping: true,
        });
      });

      socket.on('typing:stop', (roomId: string) => {
        socket.to(`room:${roomId}`).emit('typing:user', {
          userId: socket.userId,
          isTyping: false,
        });
      });

      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
      });
    });
  }

  private handleRedisMessage(message: string): void {
    try {
      const messageData = JSON.parse(message);
      const roomId = messageData.roomId || 'global';

      // Emit to all clients in the room
      this.io.to(`room:${roomId}`).emit('message:new', messageData);

      logger.info(`Message broadcast to room ${roomId}`);
    } catch (error) {
      logger.error('Error handling Redis message:', error);
    }
  }
}
