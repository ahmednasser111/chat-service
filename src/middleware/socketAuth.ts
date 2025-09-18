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
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = await verifyToken(token);
    socket.userId = decoded.userId;
    socket.user = decoded;

    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Invalid or expired token'));
  }
};
