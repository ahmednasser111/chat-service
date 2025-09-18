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

      const messages = await prismaClient.message.findMany({
        where: roomId ? { roomId: String(roomId) } : undefined,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      });

      res.json({ messages });
    } catch (error) {
      logger.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  async createMessage(req: AuthRequest, res: Response) {
    const { text, roomId = 'global' } = req.body;
    const userId = req.user!.id;

    const message = await prisma.message.create({
      data: { text, userId, roomId },
    });

    // 1) Publish on Redis channel for live subscribers
    await RedisClient.publish('MESSAGES', JSON.stringify(message));

    // 2) Produce to Kafka for async processing
    await KafkaService.getInstance().produceMessage('MESSAGES', message);

    return res.status(201).json({ message });
  }

  async deleteMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Check if message exists and belongs to user
      const message = await prismaClient.message.findUnique({
        where: { id },
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
      await prismaClient.message.delete({
        where: { id },
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting message:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
}
