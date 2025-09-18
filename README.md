# Auth Service Microservice

A production-ready authentication and authorization microservice built with Node.js, TypeScript, PostgreSQL, Redis, and Kafka.

## 🚀 Features

- **User Registration & Authentication**: Secure user registration and JWT-based authentication
- **Token Management**: JWT tokens with Redis-based session management
- **Password Security**: Bcrypt hashing for password storage
- **Event-Driven Architecture**: Kafka integration for publishing auth events
- **Monitoring**: Sentry integration for error tracking and performance monitoring
- **API Documentation**: Swagger/OpenAPI documentation
- **Health Checks**: Comprehensive health check endpoints
- **Security**: Helmet.js for security headers, CORS configuration
- **Logging**: Winston logger with configurable log levels
- **Graceful Shutdown**: Proper cleanup of connections on shutdown
- **Docker Support**: Full Docker and Docker Compose setup

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Apache Kafka (or Docker)
- npm or yarn

## 🛠️ Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js 5
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis with ioredis
- **Message Broker**: Apache Kafka with KafkaJS
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Zod
- **Documentation**: Swagger/OpenAPI
- **Monitoring**: Sentry
- **Security**: Helmet, CORS, bcrypt
- **Logging**: Winston
- **Testing**: Jest
- **Linting**: ESLint with Prettier

## 📦 Installation

### Local Development

1. Clone the repository:

```bash
git clone https://github.com/yourusername/auth-service.git
cd auth-service
```

2. Install dependencies:

```bash
npm install
```

3. Copy environment variables:

```bash
cp .env.example .env
```

4. Update `.env` with your configuration:

```env
PORT=3001
NODE_ENV=development

DATABASE_URL=postgres://admin:pass@localhost:5432/auth
REDIS_URL=redis://:pass@localhost:6379
KAFKA_BROKER=localhost:9092

JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

LOG_LEVEL=debug

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Optional: Sentry Configuration
SENTRY_DSN=your-sentry-dsn-here
SENTRY_ENVIRONMENT=development
```

5. Start services (PostgreSQL, Redis, Kafka):

```bash
# Using Docker Compose (recommended)
docker-compose up -d postgres redis kafka zookeeper

# Or install and run them locally
```

6. Run the application:

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

### Docker Deployment

1. Build and run with Docker Compose:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f auth-service

# Stop services
docker-compose down
```

2. For development with Kafka UI:

```bash
docker-compose --profile dev up -d
```

3. For production with Nginx:

```bash
docker-compose --profile production up -d
```

## 🔑 API Endpoints

### Base URL

- Local: `http://localhost:3001`

### Public Endpoints

#### Health Check

```http
GET /health
```

Response:

```json
{
  "service": "auth-service",
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "checks": {
    "database": "connected",
    "redis": "connected",
    "sentry": "configured"
  }
}
```

#### Service Info

```http
GET /
```

### Authentication Endpoints

#### Register User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

Response (201 Created):

```json
{
  "id": 1,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

#### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

Response (200 OK):

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com"
}
```

#### Logout (Protected)

```http
POST /api/v1/auth/logout
Authorization: Bearer {token}
```

Response (200 OK):

```json
{
  "message": "logged out successfully"
}
```

## 📚 API Documentation

Swagger documentation is available at:

- Local: http://localhost:3001/docs

## 🔒 Authentication

The service uses JWT tokens for authentication. Include the token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Tokens expire after 24 hours by default (configurable via `JWT_EXPIRES_IN`).

## 📊 Events

The service publishes the following Kafka events:

### user.registered

Published when a new user successfully registers:

```json
{
  "key": "userId",
  "value": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

## 🧪 Testing

Run tests:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🔧 Development

### Code Quality

```bash
# Run linter
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

### Database Migrations

TypeORM is configured with synchronize for development. For production, use migrations:

```bash
# Generate migration
npm run typeorm migration:generate -- -n MigrationName

# Run migrations
npm run typeorm migration:run

# Revert migration
npm run typeorm migration:revert
```

## 📈 Monitoring

### Sentry Integration

The service includes Sentry integration for:

- Error tracking
- Performance monitoring
- Release tracking
- Custom breadcrumbs for auth events

Configure Sentry by setting the `SENTRY_DSN` environment variable.

### Health Monitoring

The `/health` endpoint provides:

- Database connectivity status
- Redis connectivity status
- Sentry configuration status
- Service uptime

## 🚦 Error Handling

The service uses consistent error responses:

```json
{
  "status": "error",
  "message": "Error description",
  "errors": [] // Optional validation errors
}
```

HTTP Status Codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable

## 🔐 Security

- **Password Hashing**: Bcrypt with 10 rounds
- **JWT Security**: Configurable secret and expiration
- **Helmet.js**: Security headers
- **CORS**: Configurable origins
- **Input Validation**: Zod schemas
- **SQL Injection Protection**: TypeORM parameterized queries
- **Rate Limiting**: Redis-based token validation
- **Environment Variables**: Sensitive data in .env files

## 🐳 Docker

### Building the Image

```bash
# Build production image
docker build -t auth-service:latest .

# Build with build args
docker build \
  --build-arg NODE_ENV=production \
  -t auth-service:latest .
```

### Running the Container

```bash
# Run with environment variables
docker run -d \
  --name auth-service \
  -p 3001:3001 \
  --env-file .env \
  auth-service:latest

# Run with Docker Compose
docker-compose up -d
```

## 📝 Environment Variables

| Variable                    | Description               | Default       | Required |
| --------------------------- | ------------------------- | ------------- | -------- |
| `PORT`                      | Service port              | `3001`        | No       |
| `NODE_ENV`                  | Environment               | `development` | No       |
| `DATABASE_URL`              | PostgreSQL connection URL | -             | Yes      |
| `REDIS_URL`                 | Redis connection URL      | -             | Yes      |
| `KAFKA_BROKER`              | Kafka broker address      | -             | Yes      |
| `JWT_SECRET`                | JWT signing secret        | -             | Yes      |
| `JWT_EXPIRES_IN`            | Token expiration time     | `24h`         | No       |
| `LOG_LEVEL`                 | Winston log level         | `info`        | No       |
| `ALLOWED_ORIGINS`           | CORS allowed origins      | -             | Yes      |
| `SENTRY_DSN`                | Sentry DSN                | -             | No       |
| `SENTRY_ENVIRONMENT`        | Sentry environment        | `development` | No       |
| `SENTRY_SAMPLE_RATE`        | Error sampling rate       | `1.0`         | No       |
| `SENTRY_TRACES_SAMPLE_RATE` | Transaction sampling      | `0.1`         | No       |

## 🏗️ Project Structure

```
auth-service/
├── src/
│   ├── config/          # Configuration files
│   │   ├── index.ts     # Config aggregator
│   │   ├── logger.ts    # Winston logger
│   │   ├── redis.ts     # Redis client
│   │   ├── sentry.ts    # Sentry setup
│   │   └── swagger.ts   # Swagger config
│   ├── controllers/     # Request handlers
│   ├── entity/          # TypeORM entities
│   ├── events/          # Kafka events
│   ├── middlewares/     # Express middlewares
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   ├── utils/           # Helper functions
│   ├── app.ts          # Application entry
│   ├── data-source.ts  # Database config
│   └── init/           # Initialization
├── .env.example        # Environment template
├── .gitignore         # Git ignore rules
├── .prettierrc        # Prettier config
├── docker-compose.yml # Docker Compose
├── Dockerfile         # Docker image
├── eslint.config.js   # ESLint config
├── package.json       # Dependencies
├── README.md          # Documentation
└── tsconfig.json      # TypeScript config
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

**Ahmed Nasser**

- GitHub: [@ahmednasser](https://github.com/ahmednasser111)
- Email: ahmednaser7707@gmail.com

## 🆘 Support

For issues and questions:

- Create an issue in the GitHub repository
- Contact the development team
- Check the [API Documentation](http://localhost:3001/docs)
