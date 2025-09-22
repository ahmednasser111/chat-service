import { Request, Response } from 'express';
import AuthRequest from '../middleware/auth';
import { logger } from '../utils/logger';
import prisma from '../config/prisma';
import { KafkaService } from '../services/kafka-service';

export class RoomController {
  async createRoom(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;
      const userId = req.user!.id;

      const room = await prisma.room.create({
        data: {
          name,
          description,
        },
      });

      // Publish room created event
      await KafkaService.getInstance().produceMessage('ROOM_CREATED', {
        ...room,
        createdBy: userId,
      });

      logger.info(`Room created: ${room.id} by user: ${userId}`);

      res.status(201).json({ room });
    } catch (error) {
      logger.error('Error creating room:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  }

  async getRooms(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const rooms = await prisma.room.findMany({
        take: Number(limit),
        skip: Number(offset),
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({ rooms });
    } catch (error) {
      logger.error('Error fetching rooms:', error);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  }

  async getRoomById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const room = await prisma.room.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      res.json({ room });
    } catch (error) {
      logger.error('Error fetching room by ID:', error);
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  }

  async updateRoom(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const userId = req.user!.id;

      const existingRoom = await prisma.room.findUnique({
        where: { id },
      });

      if (!existingRoom) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      const room = await prisma.room.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
        },
      });

      // Publish room updated event
      await KafkaService.getInstance().produceMessage('ROOM_UPDATED', {
        ...room,
        updatedBy: userId,
      });

      logger.info(`Room updated: ${room.id} by user: ${userId}`);

      res.json({ room });
    } catch (error) {
      logger.error('Error updating room:', error);
      res.status(500).json({ error: 'Failed to update room' });
    }
  }

  async deleteRoom(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const existingRoom = await prisma.room.findUnique({
        where: { id },
      });

      if (!existingRoom) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      // Delete all messages in the room first
      await prisma.message.deleteMany({
        where: { roomId: id },
      });

      // Delete the room
      await prisma.room.delete({
        where: { id },
      });

      // Publish room deleted event
      await KafkaService.getInstance().produceMessage('ROOM_DELETED', {
        roomId: id,
        deletedBy: userId,
        deletedAt: new Date(),
      });

      logger.info(`Room deleted: ${id} by user: ${userId}`);

      res.json({ success: true, message: 'Room deleted successfully' });
    } catch (error) {
      logger.error('Error deleting room:', error);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  }

  async getRoomMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Check if room exists
      const room = await prisma.room.findUnique({
        where: { id },
      });

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      const messages = await prisma.message.findMany({
        where: { roomId: id },
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
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
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
        },
        messages,
      });
    } catch (error) {
      logger.error('Error fetching room messages:', error);
      res.status(500).json({ error: 'Failed to fetch room messages' });
    }
  }
}
