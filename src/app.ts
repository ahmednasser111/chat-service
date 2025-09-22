import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { Server } from 'socket.io';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { setupSwagger } from './utils/swagger';
import messageRoutes from './routes/message.route';
import userRoutes from './routes/user.route';
import roomRoutes from './routes/room.route';
import { SocketService } from './services/socket-service';
import { KafkaService } from './services/kafka-service';
import { authenticateSocket } from './middleware/socketAuth';
import { indexRouter } from './routes/index.route';
import compression from 'compression';
import { RedisClient } from './config/redis';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,
});

// Middleware
app.use(Sentry.Handlers.requestHandler());
app.use(helmet());
(app as any).use(compression());

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // increased limit for chat application
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// API Documentation
setupSwagger(app);

// Routes
app.use('/', indexRouter);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);

// Health check
app.get('/health', async (req, res) => {
  const health = {
    service: 'chat-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      redis: 'unknown',
      kafka: 'unknown',
    },
  };

  try {
    // Check database (Prisma doesn't have a direct ping method)
    await prisma.$queryRaw`SELECT 1`;
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

  try {
    const kafkaService = KafkaService.getInstance();
    health.checks.kafka = kafkaService.isHealthy() ? 'connected' : 'error';
    if (!kafkaService.isHealthy()) {
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.kafka = 'error';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Error handling
app.use(Sentry.Handlers.errorHandler());
app.use(errorHandler);

// Import prisma after routes to avoid circular dependency
import prisma from './config/prisma';

// Utility function to wait for a service
async function waitForService(
  serviceName: string,
  checkFn: () => Promise<boolean>,
  maxRetries: number = 30,
  retryDelay: number = 2000,
): Promise<void> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const isReady = await checkFn();
      if (isReady) {
        logger.info(`${serviceName} is ready`);
        return;
      }
    } catch (error: any) {
      logger.debug(`${serviceName} not ready yet:`, error.message);
    }

    retries++;
    logger.info(
      `Waiting for ${serviceName} (attempt ${retries}/${maxRetries})`,
    );
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }

  throw new Error(
    `${serviceName} did not become ready after ${maxRetries} attempts`,
  );
}

// Initialize services
async function initializeServices() {
  try {
    logger.info('Starting service initialization...');

    // Step 1: Initialize Database
    logger.info('1/4 - Connecting to Database...');
    await prisma.$connect();
    logger.info('Database connected');

    // Step 2: Initialize Redis
    logger.info('2/4 - Connecting to Redis...');
    await RedisClient.connect();

    // Wait for Redis to be ready
    await waitForService('Redis', () => RedisClient.ping(), 10, 1000);

    // Step 3: Initialize Kafka (with retry logic built into KafkaService)
    logger.info('3/4 - Connecting to Kafka...');
    const kafkaService = KafkaService.getInstance();
    await kafkaService.connect();

    // Wait a bit more and start consumer
    logger.info('Starting Kafka consumer...');
    await kafkaService.startConsumer();

    // Step 4: Initialize Socket.io
    logger.info('4/4 - Initializing Socket.IO...');
    const io = new Server(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Socket authentication middleware
    io.use(authenticateSocket);

    const socketService = new SocketService(io);
    socketService.initListeners();

    logger.info('✅ All services initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize services:', error);
    throw error;
  }
}

export { app, server, initializeServices };
