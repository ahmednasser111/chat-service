import Redis from 'ioredis';
import { config } from '.';
import { logger } from '../utils/logger';

class RedisClient {
  private static instance: Redis;
  private static subClient: Redis;
  private static isConnected = false;

  private constructor() {}

  public static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis(config.REDIS_URL, {
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });
      RedisClient.setupEventListeners(RedisClient.instance, 'main');
    }
    return RedisClient.instance;
  }

  private static getSubscriber(): Redis {
    if (!RedisClient.subClient) {
      RedisClient.subClient = new Redis(config.REDIS_URL, {
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });
      RedisClient.setupEventListeners(RedisClient.subClient, 'subscriber');
    }
    return RedisClient.subClient;
  }

  private static setupEventListeners(client: Redis, type: string): void {
    client.on('connect', () => logger.info(`Redis (${type}) connected`));
    client.on('ready', () => logger.info(`Redis (${type}) ready`));
    client.on('error', (err) => logger.error(`Redis (${type}) error:`, err));
    client.on('close', () => logger.warn(`Redis (${type}) connection closed`));
    client.on('reconnecting', () =>
      logger.info(`Redis (${type}) reconnecting...`),
    );
    client.on('end', () => logger.info(`Redis (${type}) connection ended`));
  }

  public static async closeConnection() {
    try {
      if (RedisClient.instance) await RedisClient.instance.quit();
      if (RedisClient.subClient) await RedisClient.subClient.quit();
      logger.info('Redis connections closed');
    } catch (error) {
      logger.error('Error closing Redis connections:', error);
    }
  }

  public static isReady(): boolean {
    return RedisClient.isConnected;
  }

  // ------------------ Ping ------------------
  public static async ping(): Promise<boolean> {
    try {
      const client = RedisClient.getInstance();
      const result = await client.ping();
      if (result === 'PONG') {
        logger.info('Redis ping successful');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Redis ping failed:', error);
      return false;
    }
  }

  public static async testConnection(): Promise<boolean> {
    return RedisClient.ping();
  }

  public static async publish(channel: string, message: string) {
    const client = RedisClient.getInstance();
    try {
      await client.publish(channel, message);
    } catch (error) {
      logger.error('Redis publish error:', error);
    }
  }

  public static async subscribe(
    channel: string,
    callback: (message: string) => void,
  ) {
    const client = RedisClient.getSubscriber();
    try {
      await client.subscribe(channel);
      client.on('message', (ch, message) => {
        if (ch === channel) callback(message);
      });
      logger.info(`Subscribed to Redis channel: ${channel}`);
    } catch (error) {
      logger.error('Redis subscribe error:', error);
    }
  }
}

export { RedisClient };
