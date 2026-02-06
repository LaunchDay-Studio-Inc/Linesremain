// ─── Centralized API Error Middleware ───

import type { Request, Response, NextFunction } from 'express';
import { AuthError } from '../auth/AuthService.js';
import { logger } from '../utils/logger.js';

/**
 * Express error-handling middleware.
 * Must have 4 parameters so Express recognises it as an error handler.
 */
export function apiErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  logger.error(err, 'Unexpected API error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}