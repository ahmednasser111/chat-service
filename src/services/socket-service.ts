import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { KafkaService } from './kafka-service';
import { RedisClient } from '../config/redis';
import prisma from '../config/prisma';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

interface MessageData {
  text: string;
  roomId?: string;
}

interface TypingData {
  roomId: string;
  userId: string;
  isTyping: boolean;
}

export class SocketService {
  private io: Server;
  private kafkaService: KafkaService;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>
  private userSockets: Map<string, string> = new Map(); // socketId -> userId

  constructor(io: Server) {
    this.io = io;
    this.kafkaService = KafkaService.getInstance();

    // Subscribe to Redis channels for real-time message distribution
    this.setupRedisSubscriptions();
  }

  private async setupRedisSubscriptions(): Promise<void> {
    try {
      // Subscribe to different message channels
      await RedisClient.subscribe('MESSAGES', this.handleNewMessage.bind(this));
      await RedisClient.subscribe(
        'MESSAGE_UPDATED',
        this.handleUpdatedMessage.bind(this),
      );
      await RedisClient.subscribe(
        'MESSAGE_DELETED',
        this.handleDeletedMessage.bind(this),
      );
      await RedisClient.subscribe(
        'USER_STATUS',
        this.handleUserStatus.bind(this),
      );

      logger.info('Socket service subscribed to Redis channels');
    } catch (error) {
      logger.error('Error setting up Redis subscriptions:', error);
    }
  }

  initListeners(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`Socket connected: ${socket.id}, userId: ${socket.userId}`);

      // Track connected user
      if (socket.userId) {
        this.addUserSocket(socket.userId, socket.id);
        this.broadcastUserStatus(socket.userId, 'online');
      }

      // Join user to their personal room
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
        socket.join('global'); // Join global room by default
      }

      // Handle joining specific rooms
      socket.on('join:room', async (roomId: string) => {
        try {
          // Validate room exists (except for global)
          if (roomId !== 'global') {
            const room = await prisma.room.findUnique({
              where: { id: roomId },
            });

            if (!room) {
              socket.emit('error', { message: 'Room not found' });
              return;
            }
          }

          socket.join(`room:${roomId}`);
          logger.info(`Socket ${socket.id} joined room: ${roomId}`);

          // Notify room members
          socket.to(`room:${roomId}`).emit('user:joined', {
            userId: socket.userId,
            roomId,
            timestamp: new Date(),
          });
        } catch (error) {
          logger.error('Error joining room:', error);
          socket.emit('error', { message: 'Failed to join room' });
        }
      });

      // Handle leaving rooms
      socket.on('leave:room', (roomId: string) => {
        socket.leave(`room:${roomId}`);
        logger.info(`Socket ${socket.id} left room: ${roomId}`);

        // Notify room members
        socket.to(`room:${roomId}`).emit('user:left', {
          userId: socket.userId,
          roomId,
          timestamp: new Date(),
        });
      });

      // Handle sending messages
      socket.on('message:send', async (data: MessageData) => {
        try {
          if (!data.text || data.text.trim().length === 0) {
            socket.emit('error', { message: 'Message text is required' });
            return;
          }

          if (data.text.length > 1000) {
            socket.emit('error', {
              message: 'Message too long (max 1000 characters)',
            });
            return;
          }

          const roomId = data.roomId || 'global';

          // Validate room exists (except for global)
          if (roomId !== 'global') {
            const room = await prisma.room.findUnique({
              where: { id: roomId },
            });

            if (!room) {
              socket.emit('error', { message: 'Room not found' });
              return;
            }
          }

          // Ensure user exists in chat database
          let user = await prisma.user.findUnique({
            where: { id: socket.userId! },
          });

          if (!user) {
            // Auto-create user if they don't exist
            user = await prisma.user.create({
              data: {
                id: socket.userId!,
                email: socket.user?.email || '',
              },
            });
            logger.info(`Auto-created user ${socket.userId} via socket`);
          }

          // Create message in database
          const message = await prisma.message.create({
            data: {
              text: data.text.trim(),
              userId: socket.userId!,
              roomId,
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          });

          // Prepare message payload
          const messagePayload = {
            ...message,
            timestamp: message.createdAt,
          };

          // Publish to Redis for real-time distribution
          await RedisClient.publish('MESSAGES', JSON.stringify(messagePayload));

          // Send to Kafka for persistence and other services
          await this.kafkaService.produceMessage('MESSAGES', messagePayload);

          logger.info(
            `Message sent via socket by ${socket.userId}: ${data.text}`,
          );
        } catch (error) {
          logger.error('Error sending message via socket:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing events
      socket.on('typing:start', (data: { roomId: string }) => {
        const typingData: TypingData = {
          roomId: data.roomId,
          userId: socket.userId!,
          isTyping: true,
        };

        socket.to(`room:${data.roomId}`).emit('typing:user', typingData);
        logger.debug(
          `User ${socket.userId} started typing in room ${data.roomId}`,
        );
      });

      socket.on('typing:stop', (data: { roomId: string }) => {
        const typingData: TypingData = {
          roomId: data.roomId,
          userId: socket.userId!,
          isTyping: false,
        };

        socket.to(`room:${data.roomId}`).emit('typing:user', typingData);
        logger.debug(
          `User ${socket.userId} stopped typing in room ${data.roomId}`,
        );
      });

      // Handle get online users
      socket.on('users:online', () => {
        const onlineUsers = Array.from(this.connectedUsers.keys());
        socket.emit('users:online:list', { users: onlineUsers });
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);

        if (socket.userId) {
          this.removeUserSocket(socket.userId, socket.id);

          // If user has no more connections, mark as offline
          if (!this.connectedUsers.has(socket.userId)) {
            this.broadcastUserStatus(socket.userId, 'offline');
          }
        }
      });
    });
  }

  // Redis message handlers
  private handleNewMessage(message: string): void {
    try {
      const messageData = JSON.parse(message);
      const roomId = messageData.roomId || 'global';

      // Emit to all clients in the room
      this.io.to(`room:${roomId}`).emit('message:new', messageData);

      logger.debug(`Message broadcast to room ${roomId}`);
    } catch (error) {
      logger.error('Error handling new message from Redis:', error);
    }
  }

  private handleUpdatedMessage(message: string): void {
    try {
      const messageData = JSON.parse(message);
      const roomId = messageData.roomId || 'global';

      // Emit to all clients in the room
      this.io.to(`room:${roomId}`).emit('message:updated', messageData);

      logger.debug(`Message update broadcast to room ${roomId}`);
    } catch (error) {
      logger.error('Error handling updated message from Redis:', error);
    }
  }

  private handleDeletedMessage(message: string): void {
    try {
      const messageData = JSON.parse(message);
      const roomId = messageData.roomId || 'global';

      // Emit to all clients in the room
      this.io.to(`room:${roomId}`).emit('message:deleted', messageData);

      logger.debug(`Message deletion broadcast to room ${roomId}`);
    } catch (error) {
      logger.error('Error handling deleted message from Redis:', error);
    }
  }

  private handleUserStatus(message: string): void {
    try {
      const statusData = JSON.parse(message);

      // Broadcast to all connected clients
      this.io.emit('user:status', statusData);

      logger.debug(
        `User status broadcast: ${statusData.userId} - ${statusData.status}`,
      );
    } catch (error) {
      logger.error('Error handling user status from Redis:', error);
    }
  }

  // User tracking methods
  private addUserSocket(userId: string, socketId: string): void {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
    this.userSockets.set(socketId, userId);
  }

  private removeUserSocket(userId: string, socketId: string): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
    this.userSockets.delete(socketId);
  }

  private async broadcastUserStatus(
    userId: string,
    status: 'online' | 'offline',
  ): Promise<void> {
    try {
      const statusData = {
        userId,
        status,
        timestamp: new Date(),
      };

      // Publish to Redis for other instances
      await RedisClient.publish('USER_STATUS', JSON.stringify(statusData));

      logger.debug(`User status broadcasted: ${userId} - ${status}`);
    } catch (error) {
      logger.error('Error broadcasting user status:', error);
    }
  }

  // Public methods for getting connected users
  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getUserSocketCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }
}
