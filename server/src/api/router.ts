// ─── API Router ───

import { Router } from 'express';
import { authRouter } from './routes/auth.routes.js';
import { serverRouter } from './routes/server.routes.js';
import { apiErrorHandler } from './errorMiddleware.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/server', serverRouter);

// Centralized error handler — must be registered after all routes
router.use(apiErrorHandler);

export const apiRouter = router;
