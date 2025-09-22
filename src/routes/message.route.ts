import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createMessageSchema,
  getMessagesSchema,
} from '../schemas/message.schema';
import { z } from 'zod';

const router = Router();
const messageController = new MessageController();

// Additional validation schemas
const updateMessageSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    text: z.string().min(1).max(1000),
  }),
});

const deleteMessageSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const getMessagesByRoomSchema = z.object({
  params: z.object({
    roomId: z.string(),
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
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         text:
 *           type: string
 *         userId:
 *           type: string
 *         roomId:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             email:
 *               type: string
 */

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Get messages
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *         description: Room ID to filter messages
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
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  validate(getMessagesSchema),
  messageController.getMessages,
);

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Create a new message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *               roomId:
 *                 type: string
 *                 default: global
 *     responses:
 *       201:
 *         description: Message created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: Bad request - invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found
 */
router.post(
  '/',
  authenticate,
  validate(createMessageSchema),
  messageController.createMessage,
);

/**
 * @swagger
 * /api/messages/{id}:
 *   put:
 *     summary: Update a message
 *     tags: [Messages]
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
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Message updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: Bad request - invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not message owner
 *       404:
 *         description: Message not found
 */
router.put(
  '/:id',
  authenticate,
  validate(updateMessageSchema),
  messageController.updateMessage,
);

/**
 * @swagger
 * /api/messages/{id}:
 *   delete:
 *     summary: Delete a message
 *     tags: [Messages]
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
 *         description: Message deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not message owner
 *       404:
 *         description: Message not found
 */
router.delete(
  '/:id',
  authenticate,
  validate(deleteMessageSchema),
  messageController.deleteMessage,
);

/**
 * @swagger
 * /api/messages/room/{roomId}:
 *   get:
 *     summary: Get messages by room
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID (use 'global' for global room)
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
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roomId:
 *                   type: string
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found
 */
router.get(
  '/room/:roomId',
  authenticate,
  validate(getMessagesByRoomSchema),
  messageController.getMessagesByRoom,
);

export default router;
