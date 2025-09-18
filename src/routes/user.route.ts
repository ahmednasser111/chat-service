import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, (req, res) => {
  // The user object is attached by the authenticate middleware
  res.json({ user: req.user });
});

/**
 * @swagger
 * /api/users/status:
 *   get:
 *     summary: Get user online status
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User status retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/status', authenticate, (req, res) => {
  res.json({ status: 'online', lastSeen: new Date() });
});

export default router;
