// src/index.ts
import dotenv from 'dotenv';
import { server, initializeServices } from './app';
import { logger } from './utils/logger';
import { RedisClient } from './config/redis';
import { KafkaService } from './services/kafka-service';

dotenv.config();

const PORT = process.env.PORT || 3002;

// Start server
server.listen(PORT, () => {
  logger.info(`Chat service running on port ${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/docs`);
});

// Initialize all services
initializeServices().catch((error) => {
  logger.error('Failed to initialize services:', error);
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} signal received: starting graceful shutdown`);

  try {
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Disconnect from services
    logger.info('Disconnecting from services...');

    const kafkaService = KafkaService.getInstance();
    await kafkaService.disconnect();

    await RedisClient.closeConnection();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});
