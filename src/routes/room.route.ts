import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { RoomController } from '../controllers/room.controller';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
const roomController = new RoomController();

// Validation schemas
const createRoomSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
  }),
});

const updateRoomSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
  }),
});

const getRoomSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const getRoomsSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 20)),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 0)),
  }),
});

const getRoomMessagesSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 50)),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 0)),
  }),
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Room:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authenticate,
  validate(createRoomSchema),
  roomController.createRoom.bind(roomController),
);

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: Get all rooms
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Rooms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rooms:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Room'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  validate(getRoomsSchema),
  roomController.getRooms.bind(roomController),
);

/**
 * @swagger
 * /api/rooms/{id}:
 *   get:
 *     summary: Get room by ID
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Room retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       404:
 *         description: Room not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/:id',
  authenticate,
  validate(getRoomSchema),
  roomController.getRoomById.bind(roomController),
);

/**
 * @swagger
 * /api/rooms/{id}:
 *   put:
 *     summary: Update room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Room updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       404:
 *         description: Room not found
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/:id',
  authenticate,
  validate(updateRoomSchema),
  roomController.updateRoom.bind(roomController),
);

/**
 * @swagger
 * /api/rooms/{id}:
 *   delete:
 *     summary: Delete room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Room deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Room not found
 *       401:
 *         description: Unauthorized
 */
router.delete(
  '/:id',
  authenticate,
  validate(getRoomSchema),
  roomController.deleteRoom.bind(roomController),
);

/**
 * @swagger
 * /api/rooms/{id}/messages:
 *   get:
 *     summary: Get messages in a room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Room ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Room messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       text:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       roomId:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           email:
 *                             type: string
 *       404:
 *         description: Room not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/:id/messages',
  authenticate,
  validate(getRoomMessagesSchema),
  roomController.getRoomMessages.bind(roomController),
);

export default router;
