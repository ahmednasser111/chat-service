import { Request, Response } from 'express';
import prismaClient from '../config/database';
import { KafkaService } from '../services/kafka-service';
import AuthRequest from '../middleware/auth';
import { logger } from '../utils/logger';
import prisma from '../config/prisma';
import { RedisClient } from '../config/redis';

export class MessageController {
  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const { roomId, limit = 50, offset = 0 } = req.query;

      const messages = await prisma.message.findMany({
        where: roomId ? { roomId: String(roomId) } : undefined,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      res.json({ messages: messages.reverse() }); // Reverse to show oldest first
    } catch (error) {
      logger.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  async createMessage(req: AuthRequest, res: Response) {
    try {
      const { text, roomId = 'global' } = req.body;
      const userId = req.user!.id;

      // Validate message content
      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Message text is required' });
      }

      if (text.length > 1000) {
        return res
          .status(400)
          .json({ error: 'Message too long (max 1000 characters)' });
      }

      // Ensure user exists in chat database
      let user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        // Create user if they don't exist in chat service
        user = await prisma.user.create({
          data: {
            id: userId,
            email: req.user!.email || '',
          },
        });
        logger.info(`Auto-created user ${userId} in chat service`);
      }

      // Check if it's a room message and validate room exists
      if (roomId !== 'global') {
        const room = await prisma.room.findUnique({
          where: { id: roomId },
        });

        if (!room) {
          return res.status(404).json({ error: 'Room not found' });
        }
      }

      const message = await prisma.message.create({
        data: {
          text: text.trim(),
          userId,
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

      // 1) Publish on Redis channel for live subscribers
      const messagePayload = {
        ...message,
        timestamp: message.createdAt,
      };

      await RedisClient.publish('MESSAGES', JSON.stringify(messagePayload));

      // 2) Produce to Kafka for async processing and other services
      await KafkaService.getInstance().produceMessage(
        'MESSAGES',
        messagePayload,
      );

      logger.info(
        `Message created: ${message.id} in room: ${roomId} by user: ${userId}`,
      );

      return res.status(201).json({ message });
    } catch (error) {
      logger.error('Error creating message:', error);
      return res.status(500).json({ error: 'Failed to create message' });
    }
  }

  async deleteMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Check if message exists and belongs to user
      const message = await prisma.message.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      if (message.userId !== userId) {
        res
          .status(403)
          .json({ error: 'Not authorized to delete this message' });
        return;
      }

      // Delete message
      await prisma.message.delete({
        where: { id },
      });

      // Publish message deleted event
      const deletedPayload = {
        messageId: id,
        roomId: message.roomId,
        deletedBy: userId,
        deletedAt: new Date(),
      };

      await RedisClient.publish(
        'MESSAGE_DELETED',
        JSON.stringify(deletedPayload),
      );
      await KafkaService.getInstance().produceMessage(
        'MESSAGE_DELETED',
        deletedPayload,
      );

      logger.info(`Message deleted: ${id} by user: ${userId}`);

      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting message:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }

  async updateMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { text } = req.body;
      const userId = req.user!.id;

      // Validate message content
      if (!text || text.trim().length === 0) {
        res.status(400).json({ error: 'Message text is required' });
        return;
      }

      if (text.length > 1000) {
        res
          .status(400)
          .json({ error: 'Message too long (max 1000 characters)' });
        return;
      }

      // Check if message exists and belongs to user
      const existingMessage = await prisma.message.findUnique({
        where: { id },
      });

      if (!existingMessage) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      if (existingMessage.userId !== userId) {
        res
          .status(403)
          .json({ error: 'Not authorized to update this message' });
        return;
      }

      // Update message
      const message = await prisma.message.update({
        where: { id },
        data: {
          text: text.trim(),
          updatedAt: new Date(),
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

      // Publish message updated event
      const updatedPayload = {
        ...message,
        updatedBy: userId,
        timestamp: message.updatedAt,
      };

      await RedisClient.publish(
        'MESSAGE_UPDATED',
        JSON.stringify(updatedPayload),
      );
      await KafkaService.getInstance().produceMessage(
        'MESSAGE_UPDATED',
        updatedPayload,
      );

      logger.info(`Message updated: ${id} by user: ${userId}`);

      res.json({ message });
    } catch (error) {
      logger.error('Error updating message:', error);
      res.status(500).json({ error: 'Failed to update message' });
    }
  }

  async getMessagesByRoom(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { roomId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Check if room exists (skip for global room)
      if (roomId !== 'global') {
        const room = await prisma.room.findUnique({
          where: { id: roomId },
        });

        if (!room) {
          res.status(404).json({ error: 'Room not found' });
          return;
        }
      }

      const messages = await prisma.message.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      res.json({
        roomId,
        messages: messages.reverse(), // Show oldest first
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          hasMore: messages.length === Number(limit),
        },
      });
    } catch (error) {
      logger.error('Error fetching messages by room:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
}
