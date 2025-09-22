# 🚀 Scalable Chat Microservices

A production-ready chat application built with microservices architecture, featuring real-time messaging, user authentication, and event-driven communication.

## 🏗️ Architecture Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │ API Gateway │    │   Client    │
│   (React)   │◄──►│   (Kong)   │◄──►│  (Mobile)   │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
      │ Auth Service│ │Chat Service │ │Other Services│
      │   :3001     │ │   :3002     │ │   :300X     │
      └─────────────┘ └─────────────┘ └─────────────┘
              │            │            │
              └────────────┼────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ PostgreSQL  │ │    Redis    │ │   Kafka     │
    │ (Auth DB)   │ │  (Cache)    │ │ (Events)    │
    └─────────────┘ └─────────────┘ └─────────────┘
           │
    ┌─────────────┐
    │ PostgreSQL  │
    │ (Chat DB)   │
    └─────────────┘
```

## 🎯 Features

### Auth Service

- ✅ User registration & authentication
- ✅ JWT token management with Redis
- ✅ Password security with bcrypt
- ✅ Event publishing via Kafka
- ✅ Comprehensive API documentation
- ✅ Health checks & monitoring
- ✅ Sentry error tracking

### Chat Service

- ✅ Real-time messaging with Socket.IO
- ✅ Room/channel management
- ✅ Message persistence
- ✅ User presence tracking
- ✅ Event-driven architecture
- ✅ Redis pub/sub for scaling
- ✅ Kafka integration for events

### Infrastructure

- ✅ Docker containerization
- ✅ PostgreSQL databases (separate for each service)
- ✅ Redis for caching and pub/sub
- ✅ Apache Kafka for event streaming
- ✅ Kong API Gateway
- ✅ Health monitoring
- ✅ Development tools (Kafka UI, Redis Commander)

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Git

### 1. Clone & Setup

```bash
# Clone the repository
git clone <repository-url>
cd scalable-chat-microservices

# Copy environment files
cp auth-service/.env.example auth-service/.env
cp .env.example .env

# Update environment variables as needed
```

### 2. Start with Docker Compose

```bash
# Start all services
docker-compose up -d

# With development tools (Kafka UI, Redis Commander)
docker-compose --profile dev up -d

# With API Gateway
docker-compose --profile gateway up -d

# Start everything
docker-compose --profile dev --profile gateway up -d
```

### 3. Verify Services

```bash
# Check service health
curl http://localhost:3001/health  # Auth Service
curl http://localhost:3002/health  # Chat Service
curl http://localhost:8080/health  # API Gateway (if enabled)
```

## 📡 API Endpoints

### Auth Service (Port 3001)

```http
POST /api/v1/auth/register    # User registration
POST /api/v1/auth/login       # User login
POST /api/v1/auth/logout      # User logout (protected)
GET  /health                  # Health check
GET  /docs                    # API documentation
```

### Chat Service (Port 3002)

```http
# Messages
GET    /api/messages                    # Get messages
POST   /api/messages                    # Send message
PUT    /api/messages/{id}               # Update message
DELETE /api/messages/{id}               # Delete message
GET    /api/messages/room/{roomId}      # Get room messages

# Rooms
GET    /api/rooms                       # Get rooms
POST   /api/rooms                       # Create room
GET    /api/rooms/{id}                  # Get room details
PUT    /api/rooms/{id}                  # Update room
DELETE /api/rooms/{id}                  # Delete room
GET    /api/rooms/{id}/messages         # Get room messages

# Users
GET    /api/users/me                    # Get current user
GET    /api/users/{id}                  # Get user by ID
GET    /api/users                       # Get all users
GET    /api/users/status                # Get user status

# Health & Docs
GET    /health                          # Health check
GET    /docs                            # API documentation
```

### API Gateway (Port 8080)

```http
# Routes all requests to appropriate services
POST /api/v1/auth/*          # → Auth Service
GET  /api/*                  # → Chat Service
WS   /socket.io/*            # → Chat Service (WebSocket)
GET  /auth/health            # → Auth Service Health
GET  /chat/health            # → Chat Service Health
```

## 🔌 WebSocket Events

### Client → Server

```javascript
// Authentication (required)
socket.auth = { token: 'your-jwt-token' };

// Join/Leave rooms
socket.emit('join:room', 'room-id');
socket.emit('leave:room', 'room-id');

// Send messages
socket.emit('message:send', {
  text: 'Hello world!',
  roomId: 'room-id', // optional, defaults to 'global'
});

// Typing indicators
socket.emit('typing:start', { roomId: 'room-id' });
socket.emit('typing:stop', { roomId: 'room-id' });

// Get online users
socket.emit('users:online');
```

### Server → Client

```javascript
// New messages
socket.on('message:new', (message) => {
  console.log('New message:', message);
});

// Message updates/deletions
socket.on('message:updated', (message) => {});
socket.on('message:deleted', (data) => {});

// User events
socket.on('user:joined', (data) => {});
socket.on('user:left', (data) => {});
socket.on('user:status', (data) => {});
socket.on('users:online:list', (data) => {});

// Typing indicators
socket.on('typing:user', (data) => {
  console.log(`${data.userId} is ${data.isTyping ? 'typing' : 'not typing'}`);
});

// Errors
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

## 🌐 Development

### Local Development Setup

#### Auth Service

```bash
cd auth-service
npm install
npm run dev
```

#### Chat Service

```bash
npm install
npm run dev
```

### Environment Variables

#### Auth Service (.env)

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgres://postgres:Pos#3014708@localhost:5433/authdb
REDIS_URL=redis://localhost:6379
KAFKA_BROKER=localhost:9094
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
SENTRY_DSN=your-sentry-dsn
```

#### Chat Service (.env)

```env
PORT=3002
NODE_ENV=development
DATABASE_URL=postgres://postgres:Pos#3014708@localhost:5434/chatdb
REDIS_URL=redis://localhost:6379
KAFKA_BROKER=localhost:9094
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
SENTRY_DSN=your-sentry-dsn
```

### Database Migrations

#### Auth Service (TypeORM)

```bash
cd auth-service
npm run typeorm migration:generate -- -n MigrationName
npm run typeorm migration:run
```

#### Chat Service (Prisma)

```bash
npm run db:migrate
npm run db:generate
```

## 🧪 Testing

### API Testing with cURL

#### Register & Login

```bash
# Register
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

#### Send Messages

```bash
# Get JWT token from login response
TOKEN="your-jwt-token"

# Send message
curl -X POST http://localhost:3002/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "text": "Hello from cURL!",
    "roomId": "global"
  }'

# Get messages
curl -X GET "http://localhost:3002/api/messages?roomId=global&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### WebSocket Testing

```javascript
// Browser console or Node.js
const socket = io('http://localhost:3002', {
  auth: { token: 'your-jwt-token' },
});

socket.on('connect', () => {
  console.log('Connected!');

  // Join global room
  socket.emit('join:room', 'global');

  // Send message
  socket.emit('message:send', {
    text: 'Hello from WebSocket!',
    roomId: 'global',
  });
});

socket.on('message:new', (message) => {
  console.log('New message:', message);
});
```

## 📊 Monitoring & Debugging

### Service Health

```bash
# Check individual services
curl http://localhost:3001/health | jq
curl http://localhost:3002/health | jq

# Via API Gateway
curl http://localhost:8080/auth/health | jq
curl http://localhost:8080/chat/health | jq
```

### Development Tools

- **Kafka UI**: http://localhost:8081
- **Redis Commander**: http://localhost:8082
- **Auth API Docs**: http://localhost:3001/docs
- **Chat API Docs**: http://localhost:3002/docs

### Logs

```bash
# Service logs
docker-compose logs -f auth-service
docker-compose logs -f chat-service

# All logs
docker-compose logs -f
```

## 🔧 Configuration

### Docker Profiles

```bash
# Basic services only
docker-compose up -d

# With development tools
docker-compose --profile dev up -d

# With API Gateway
docker-compose --profile gateway up -d

# Everything
docker-compose --profile dev --profile gateway up -d
```

### Scaling Services

```bash
# Scale chat service
docker-compose up -d --scale chat-service=3

# Scale with load balancer
docker-compose --profile gateway up -d --scale chat-service=3
```

## 🚀 Deployment

### Production Checklist

- [ ] Update JWT secrets
- [ ] Configure proper database credentials
- [ ] Set up SSL certificates
- [ ] Configure Sentry DSN
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation
- [ ] Set up backup strategies
- [ ] Configure firewall rules
- [ ] Set resource limits

### Docker Production

```bash
# Production build
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# With SSL termination
docker-compose -f docker-compose.yml -f docker-compose.ssl.yml up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Ahmed Nasser**

- GitHub: [@ahmednasser111](https://github.com/ahmednasser111)
- Email: ahmednaser7707@gmail.com

## 🆘 Support

- Create an issue for bugs/features
- Check API documentation at `/docs` endpoints
- Review logs for troubleshooting
- Join our community discussions
