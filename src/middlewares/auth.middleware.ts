import { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyAuthToken } from '../utils/token';
import prisma from '../config/prisma';

// 1) Globally augment Express.Request so TS knows about `req.user`
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

// 2) Protect routes & populate req.user
export const isAuthenticated: RequestHandler = async (
  req,
  res,
  next
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
      return;
    }

    const token = authHeader.slice(7).trim(); // remove "Bearer "
    let payload;
    try {
      payload = verifyAuthToken(token);
    } catch (_err) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      return;
    }

    // 3) Confirm user still exists
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User no longer exists' });
      return;
    }

    // 4) Attach to request
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    console.error('Error in isAuthenticated middleware:', err);
    next(err);
  }
};