import { Router } from "express";
import { MessageController } from "../controllers/message.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
	createMessageSchema,
	getMessagesSchema,
} from "../schemas/message.schema";

const router = Router();
const messageController = new MessageController();

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
 *       401:
 *         description: Unauthorized
 */
router.get(
	"/",
	authenticate,
	validate(getMessagesSchema),
	messageController.getMessages
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
 *               roomId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message created successfully
 *       401:
 *         description: Unauthorized
 */
router.post(
	"/",
	authenticate,
	validate(createMessageSchema),
	messageController.createMessage
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
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Message not found
 */
router.delete("/:id", authenticate, messageController.deleteMessage);

export default router;
