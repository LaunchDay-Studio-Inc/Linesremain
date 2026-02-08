// ─── API Router ───

import { Router } from 'express';
import { apiErrorHandler } from './errorMiddleware.js';
import { authRouter } from './routes/auth.routes.js';
import { leaderboardRouter } from './routes/leaderboard.routes.js';
import { serverRouter } from './routes/server.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/server', serverRouter);
router.use('/leaderboard', leaderboardRouter);

// Centralized error handler — must be registered after all routes
router.use(apiErrorHandler);

export const apiRouter = router;
