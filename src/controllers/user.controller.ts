import { Request, Response } from 'express';
import AuthRequest from '../middleware/auth';
import { logger } from '../utils/logger';
import prisma from '../config/prisma';
import { KafkaService } from '../services/kafka-service';

export class UserController {
  async getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      // Try to find user in chat service database
      let user = await prisma.user.findUnique({
        where: { id: userId },
      });

      // If user doesn't exist in chat DB, create them
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userId,
            email: req.user!.email || '',
          },
        });

        // Publish user created event
        await KafkaService.getInstance().produceMessage('USER_CREATED', {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        });

        logger.info(`Created new user in chat service: ${userId}`);
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error fetching current user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  async getUserStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      res.json({
        status: 'online',
        lastSeen: new Date(),
        userId: userId,
      });
    } catch (error) {
      logger.error('Error fetching user status:', error);
      res.status(500).json({ error: 'Failed to fetch user status' });
    }
  }

  async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({ users });
    } catch (error) {
      logger.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  async getUserById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user });
    } catch (error) {
      logger.error('Error fetching user by ID:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
}
