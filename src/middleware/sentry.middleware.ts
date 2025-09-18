import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';

// Middleware to add user context to Sentry scope
export const sentryUserContext = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.userId) {
    Sentry.setUser({
      id: req.userId.toString(),
    });
  }

  // Add request context
  Sentry.setContext('request', {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  next();
};

// Middleware to capture request as breadcrumb
export const sentryRequestBreadcrumb = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  Sentry.addBreadcrumb({
    message: `${req.method} ${req.path}`,
    category: 'http',
    level: 'info',
    data: {
      method: req.method,
      url: req.url,
      query: req.query,
      ip: req.ip,
    },
  });

  next();
};
