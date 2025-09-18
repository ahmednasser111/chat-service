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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// API Documentation
setupSwagger(app);

// Routes
app.use('/', indexRouter);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res
    .status(200)
    .json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling
app.use(Sentry.Handlers.errorHandler());
app.use(errorHandler);

// Initialize services
async function initializeServices() {
  try {
    // Initialize Redis
    const redisService = RedisClient.getInstance();
    await redisService.connect();

    // Initialize Kafka
    const kafkaService = KafkaService.getInstance();
    await kafkaService.connect();
    await kafkaService.startConsumer();

    // Initialize Socket.io
    const io = new Server(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true,
      },
    });

    // Socket authentication middleware
    io.use(authenticateSocket);

    const socketService = new SocketService(io);
    socketService.initListeners();
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

export { app, server, initializeServices };
