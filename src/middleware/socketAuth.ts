import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { logger } from '../utils/logger';
import { verifyToken } from './auth';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

export const authenticateSocket = async (
  socket: AuthenticatedSocket,
  next: (err?: ExtendedError) => void,
): Promise<void> => {
  try {
    // Try to get token from different sources
    let token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      logger.warn(`Socket ${socket.id} attempted connection without token`);
      return next(new Error('Authentication required - no token provided'));
    }

    // Remove 'Bearer ' prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.substring(7);
    }

    // Verify the JWT token
    const decoded = verifyToken(token);

    // Handle both auth service token formats
    const userId = decoded.sub || decoded.id;
    if (!userId) {
      logger.warn(`Socket ${socket.id} provided token without valid user ID`);
      return next(new Error('Invalid token - no user ID found'));
    }

    // Attach user data to socket
    socket.userId = userId.toString();
    socket.user = {
      id: userId.toString(),
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
    };

    logger.info(`Socket ${socket.id} authenticated for user ${socket.userId}`);
    next();
  } catch (error: any) {
    logger.error('Socket authentication error:', {
      socketId: socket.id,
      error: error.message,
      name: error.name,
    });

    if (error.name === 'TokenExpiredError') {
      next(new Error('Token expired - please login again'));
    } else if (error.name === 'JsonWebTokenError') {
      next(new Error('Invalid token format'));
    } else {
      next(new Error('Authentication failed'));
    }
  }
};
