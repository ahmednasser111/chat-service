import { Router } from 'express';
import { config } from '../config';
import * as Sentry from '@sentry/node';
import prismaClient from '../config/database';
import { RedisClient } from '../config/redis';

const indexRouter = Router();

/**
 * @openapi
 * /:
 *   get:
 *     summary: Root endpoint
 *     description: Returns the service name and status
 *     tags:
 *       - General
 *     responses:
 *       200:
 *         description: Service is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: running
 */
indexRouter.get('/', async (req, res): Promise<any> => {
  return res.json({ service: config.SERVICE_NAME, status: 'running' });
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns the health status of the service and its dependencies
 *     tags:
 *       - Monitoring
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is degraded or unavailable
 */
indexRouter.get('/health', async (req, res): Promise<any> => {
  const health = {
    service: config.SERVICE_NAME,
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      redis: 'unknown',
      sentry: 'configured',
    },
  };

  try {
    await prismaClient.$queryRaw`SELECT 1`;
    health.checks.database = 'connected';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }

  try {
    await RedisClient.ping();
    health.checks.redis = 'connected';
  } catch (error) {
    health.checks.redis = 'error';
    health.status = 'degraded';
  }

  if (!config.SENTRY_DSN) {
    health.checks.sentry = 'not_configured';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;

  if (statusCode === 503) {
    Sentry.addBreadcrumb({
      message: 'Health check failed',
      category: 'health',
      level: 'warning',
      data: health,
    });
  }

  return res.status(statusCode).json(health);
});

/**
 * @openapi
 * /test-sentry:
 *   get:
 *     summary: Test Sentry integration
 *     description: Throws a test error to verify Sentry reporting (only available in development)
 *     tags:
 *       - Monitoring
 *     responses:
 *       200:
 *         description: Test error sent to Sentry
 */
if (process.env.NODE_ENV === 'development') {
  indexRouter.get('/test-sentry', async (req, res): Promise<any> => {
    try {
      throw new Error('This is a test error for Sentry');
    } catch (error) {
      Sentry.captureException(error);
      return res.json({ message: 'Test error sent to Sentry' });
    }
  });
}

export { indexRouter };
