import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { logger } from '../utils/logger';
import prismaClient from '../config/database';

export class KafkaService {
  private static instance: KafkaService;
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private isConnected: boolean = false;

  private constructor() {
    this.kafka = new Kafka({
      clientId: 'chat-backend',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9094'],
      connectionTimeout: 10000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 8,
        maxRetryTime: 30000,
        factor: 2,
        multiplier: 1.5,
        restartOnFailure: async () => true,
      },
      ssl:
        process.env.KAFKA_SSL === 'true'
          ? {
              rejectUnauthorized: false,
            }
          : undefined,
      sasl: process.env.KAFKA_USERNAME
        ? {
            mechanism: 'plain',
            username: process.env.KAFKA_USERNAME,
            password: process.env.KAFKA_PASSWORD || '',
          }
        : undefined,
    });
  }

  static getInstance(): KafkaService {
    if (!KafkaService.instance) {
      KafkaService.instance = new KafkaService();
    }
    return KafkaService.instance;
  }

  async connect(): Promise<void> {
    const maxRetries = 10;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        logger.info(
          `Attempting to connect to Kafka (attempt ${
            retryCount + 1
          }/${maxRetries})`,
        );

        this.producer = this.kafka.producer({
          allowAutoTopicCreation: true,
          transactionTimeout: 30000,
        });

        this.consumer = this.kafka.consumer({
          groupId: 'chat-group',
          sessionTimeout: 30000,
          heartbeatInterval: 3000,
        });

        // Test connection by connecting producer first
        await this.producer.connect();
        logger.info('Kafka producer connected successfully');

        await this.consumer.connect();
        logger.info('Kafka consumer connected successfully');

        this.isConnected = true;
        logger.info('Kafka connected successfully');
        return;
      } catch (error) {
        retryCount++;
        logger.error(`Kafka connection attempt ${retryCount} failed:`, error);

        // Cleanup failed connections
        try {
          if (this.producer) {
            await this.producer.disconnect();
            this.producer = null;
          }
          if (this.consumer) {
            await this.consumer.disconnect();
            this.consumer = null;
          }
        } catch (cleanupError) {
          logger.error(
            'Error cleaning up failed Kafka connections:',
            cleanupError,
          );
        }

        if (retryCount >= maxRetries) {
          throw new Error(
            `Failed to connect to Kafka after ${maxRetries} attempts. Last error: ${error}`,
          );
        }

        // Wait before retry with exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
        logger.info(
          `Waiting ${waitTime}ms before next Kafka connection attempt...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  async produceMessage(topic: string, message: any): Promise<void> {
    if (!this.producer || !this.isConnected) {
      throw new Error('Kafka producer not initialized or connected');
    }

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: `message-${Date.now()}-${Math.random()}`,
            value: JSON.stringify(message),
          },
        ],
      });
      logger.debug(`Message sent to Kafka topic ${topic}`);
    } catch (error) {
      logger.error('Error producing message to Kafka:', error);
      throw error;
    }
  }

  async startConsumer(): Promise<void> {
    if (!this.consumer || !this.isConnected) {
      throw new Error('Kafka consumer not initialized or connected');
    }

    try {
      await this.consumer.subscribe({
        topic: 'MESSAGES',
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async ({ message, pause }: EachMessagePayload) => {
          try {
            if (!message.value) {
              logger.warn('Received empty Kafka message');
              return;
            }

            const messageData = JSON.parse(message.value.toString());
            logger.debug('Processing message from Kafka:', messageData);

            // Validate message data before saving
            if (!messageData.text || !messageData.userId) {
              logger.error('Invalid message data from Kafka:', messageData);
              return;
            }

            // Save to database - Note: This might create duplicates if the message was already saved via REST API
            // You might want to implement idempotency here
            await prismaClient.message.upsert({
              where: {
                id: messageData.id || `${messageData.userId}-${Date.now()}`,
              },
              update: {},
              create: {
                id: messageData.id,
                text: messageData.text,
                userId: messageData.userId,
                roomId: messageData.roomId || 'global',
              },
            });

            logger.debug('Message processed and saved to database');
          } catch (error) {
            logger.error('Error processing Kafka message:', error);

            // Pause consumer for 30 seconds on error to prevent rapid error loops
            pause();
            setTimeout(() => {
              try {
                this.consumer?.resume([{ topic: 'MESSAGES' }]);
                logger.info('Kafka consumer resumed after error');
              } catch (resumeError) {
                logger.error('Error resuming Kafka consumer:', resumeError);
              }
            }, 30000);
          }
        },
      });

      logger.info('Kafka consumer started and listening for messages');
    } catch (error) {
      logger.error('Error starting Kafka consumer:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        logger.info('Kafka producer disconnected');
      }
      if (this.consumer) {
        await this.consumer.disconnect();
        logger.info('Kafka consumer disconnected');
      }
      this.isConnected = false;
      logger.info('Kafka disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from Kafka:', error);
    }
  }

  isHealthy(): boolean {
    return this.isConnected && this.producer !== null && this.consumer !== null;
  }
}
