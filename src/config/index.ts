interface Config {
  SERVICE_NAME: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  KAFKA_BROKER: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  LOG_LEVEL: string;
  ALLOWED_ORIGINS: string;
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT: string;
  SENTRY_SAMPLE_RATE: number;
  SENTRY_TRACES_SAMPLE_RATE: number;
}

export const config: Config = {
  SERVICE_NAME: require('../../package.json').name,
  PORT: Number(process.env.PORT) || 3001,
  DATABASE_URL:
    process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/chat',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:909',
  JWT_SECRET: process.env.JWT_SECRET || 'your-default-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
  SENTRY_DSN: process.env.SENTRY_DSN,
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT || 'development',
  SENTRY_SAMPLE_RATE: Number(process.env.SENTRY_SAMPLE_RATE) || 1.0,
  SENTRY_TRACES_SAMPLE_RATE:
    Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
};
