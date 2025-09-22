import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export default interface AuthRequest extends Request {
  user?: { id: string; email?: string; [k: string]: any };
}

export interface DecodedToken extends JwtPayload {
  id?: string;
  sub?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  [k: string]: any;
}

export function verifyToken(token: string): DecodedToken {
  return jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(403).json({
      error: 'Invalid authorization header',
      message: 'Please provide a valid Bearer token',
    });
  }

  const token = header.split(' ')[1];
  if (!token) {
    return res.status(403).json({
      error: 'No token provided',
      message: 'Authorization token is required',
    });
  }

  try {
    const payload = verifyToken(token);

    // Handle both auth service token formats
    const userId = payload.sub || payload.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token does not contain valid user ID',
      });
    }

    req.user = {
      id: userId.toString(),
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
    };

    return next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid.',
      });
    } else {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Unable to authenticate the request.',
      });
    }
  }
}
