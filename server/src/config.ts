// ─── Server Configuration ───

import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root
dotenvConfig({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection string' }),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(20),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth
  JWT_SECRET: z.string().min(32, { message: 'JWT_SECRET must be at least 32 characters' }),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(20).default(12),

  // Game World
  WORLD_SEED: z.coerce.number().int().default(42),
  WORLD_SIZE: z.coerce.number().int().positive().default(4096),
  TICK_RATE: z.coerce.number().int().positive().default(20),
  MAX_PLAYERS: z.coerce.number().int().positive().default(50),
  SAVE_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.format();
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(formatted, null, 2));
  throw new Error('Missing or invalid environment variables. See above for details.');
}

export const config = Object.freeze(parsed.data);

export type Config = z.infer<typeof envSchema>;