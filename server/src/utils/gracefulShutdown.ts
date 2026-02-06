// ─── Graceful Shutdown ───

import type { Server as HttpServer } from 'node:http';
import type { Server as SocketIOServer } from 'socket.io';
import { closeDatabase } from '../database/connection.js';
import { logger } from './logger.js';

let isShuttingDown = false;

interface ShutdownDeps {
  httpServer: HttpServer;
  io: SocketIOServer;
}

let deps: ShutdownDeps | null = null;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Shutting down gracefully...`);

  try {
    // Disconnect all socket.io clients
    if (deps?.io) {
      deps.io.disconnectSockets(true);
      await new Promise<void>((resolve) => deps!.io.close(() => resolve()));
      logger.info('Socket.IO server closed');
    }

    // Close HTTP server
    if (deps?.httpServer) {
      await new Promise<void>((resolve, reject) => {
        deps!.httpServer.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');
    }

    // Close database connections
    await closeDatabase();
    logger.info('Database connections closed');

    // TODO: Save world state
    // TODO: Close Redis connection

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Error during shutdown');
    process.exit(1);
  }
}

export function setupGracefulShutdown(dependencies: ShutdownDeps): void {
  deps = dependencies;
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
