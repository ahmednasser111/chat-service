// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export default interface AuthRequest extends Request {
  user?: { id: string; email?: string; [k: string]: any };
}

export interface DecodedToken extends JwtPayload {
  id?: string;
  sub?: string;
  email?: string;
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
    return res.status(403).json({ message: 'Invalid authorization header' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub || payload.id!, email: payload.email };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}
