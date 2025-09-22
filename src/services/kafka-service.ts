import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { logger } from '../utils/logger';
import prisma from '../config/prisma';

export class KafkaService {
  private static instance: KafkaService;
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private isConnected: boolean = false;

  private constructor() {
    this.kafka = new Kafka({
      clientId: 'chat-service',
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
          groupId: 'chat-service-group',
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
            key: `${topic}-${Date.now()}-${Math.random()}`,
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
      // Subscribe to multiple topics
      const topics = [
        'MESSAGES',
        'MESSAGE_UPDATED',
        'MESSAGE_DELETED',
        'user.registered', // Listen to auth service events
        'USER_CREATED',
        'ROOM_CREATED',
        'ROOM_UPDATED',
        'ROOM_DELETED',
      ];

      for (const topic of topics) {
        await this.consumer.subscribe({
          topic,
          fromBeginning: false,
        });
      }

      await this.consumer.run({
        eachMessage: async ({ topic, message, pause }: EachMessagePayload) => {
          try {
            if (!message.value) {
              logger.warn(`Received empty Kafka message from topic: ${topic}`);
              return;
            }

            const messageData = JSON.parse(message.value.toString());
            logger.debug(
              `Processing message from Kafka topic ${topic}:`,
              messageData,
            );

            // Route message to appropriate handler
            await this.handleMessage(topic, messageData);
          } catch (error) {
            logger.error(
              `Error processing Kafka message from topic ${topic}:`,
              error,
            );

            // Pause consumer for 30 seconds on error to prevent rapid error loops
            pause();
            setTimeout(() => {
              try {
                this.consumer?.resume([{ topic }]);
                logger.info(
                  `Kafka consumer resumed for topic ${topic} after error`,
                );
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

  private async handleMessage(topic: string, messageData: any): Promise<void> {
    switch (topic) {
      case 'MESSAGES':
        await this.handleNewMessage(messageData);
        break;

      case 'MESSAGE_UPDATED':
        await this.handleMessageUpdate(messageData);
        break;

      case 'MESSAGE_DELETED':
        await this.handleMessageDeletion(messageData);
        break;

      case 'user.registered':
        await this.handleUserRegistered(messageData);
        break;

      case 'USER_CREATED':
        await this.handleUserCreated(messageData);
        break;

      case 'ROOM_CREATED':
        await this.handleRoomCreated(messageData);
        break;

      case 'ROOM_UPDATED':
        await this.handleRoomUpdated(messageData);
        break;

      case 'ROOM_DELETED':
        await this.handleRoomDeleted(messageData);
        break;

      default:
        logger.warn(`Unhandled Kafka topic: ${topic}`);
    }
  }

  private async handleNewMessage(messageData: any): Promise<void> {
    try {
      // Validate message data
      if (!messageData.text || !messageData.userId) {
        logger.error('Invalid message data from Kafka:', messageData);
        return;
      }

      // Check if message already exists (idempotency)
      if (messageData.id) {
        const existingMessage = await prisma.message.findUnique({
          where: { id: messageData.id },
        });

        if (existingMessage) {
          logger.debug(
            `Message ${messageData.id} already exists, skipping creation`,
          );
          return;
        }
      }

      // This is mainly for messages created via Socket.IO
      // REST API messages are already saved, so we need to avoid duplicates
      logger.debug('New message processed via Kafka');
    } catch (error) {
      logger.error('Error handling new message:', error);
    }
  }

  private async handleMessageUpdate(messageData: any): Promise<void> {
    try {
      logger.info(`Message updated: ${messageData.id}`);
      // Additional processing for message updates can be added here
    } catch (error) {
      logger.error('Error handling message update:', error);
    }
  }

  private async handleMessageDeletion(messageData: any): Promise<void> {
    try {
      logger.info(`Message deleted: ${messageData.messageId}`);
      // Additional processing for message deletions can be added here
    } catch (error) {
      logger.error('Error handling message deletion:', error);
    }
  }

  private async handleUserRegistered(messageData: any): Promise<void> {
    try {
      // Extract user data from auth service registration event
      const userData = messageData.value || messageData;

      if (!userData.id || !userData.email) {
        logger.error(
          'Invalid user registration data from auth service:',
          userData,
        );
        return;
      }

      // Check if user already exists in chat database
      const existingUser = await prisma.user.findUnique({
        where: { id: userData.id.toString() },
      });

      if (existingUser) {
        logger.debug(`User ${userData.id} already exists in chat service`);
        return;
      }

      // Create user in chat service database
      const user = await prisma.user.create({
        data: {
          id: userData.id.toString(),
          email: userData.email,
        },
      });

      logger.info(
        `User created in chat service from auth registration: ${user.id}`,
      );
    } catch (error) {
      logger.error('Error handling user registration event:', error);
    }
  }

  private async handleUserCreated(messageData: any): Promise<void> {
    try {
      logger.info(`User created in chat service: ${messageData.id}`);
      // Additional processing for user creation can be added here
    } catch (error) {
      logger.error('Error handling user creation:', error);
    }
  }

  private async handleRoomCreated(messageData: any): Promise<void> {
    try {
      logger.info(
        `Room created: ${messageData.id} by user ${messageData.createdBy}`,
      );
      // Additional processing for room creation can be added here
    } catch (error) {
      logger.error('Error handling room creation:', error);
    }
  }

  private async handleRoomUpdated(messageData: any): Promise<void> {
    try {
      logger.info(
        `Room updated: ${messageData.id} by user ${messageData.updatedBy}`,
      );
      // Additional processing for room updates can be added here
    } catch (error) {
      logger.error('Error handling room update:', error);
    }
  }

  private async handleRoomDeleted(messageData: any): Promise<void> {
    try {
      logger.info(
        `Room deleted: ${messageData.roomId} by user ${messageData.deletedBy}`,
      );
      // Additional processing for room deletion can be added here
    } catch (error) {
      logger.error('Error handling room deletion:', error);
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
