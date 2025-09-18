import * as express from 'express';

declare global {
  namespace Express {
    export interface Request {
      user?: User;
      userId: number;
      token: string;
    }
  }
}
