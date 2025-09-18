import dotenv from 'dotenv';
import { server, initializeServices } from './app';
import { logger } from './utils/logger';
import { RedisClient } from './config/redis';

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
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Disconnect from services
  const { KafkaService } = require('./services/kafka-service');

  await RedisClient.getInstance().disconnect();
  await KafkaService.getInstance().disconnect();
  process.exit(0);
});
