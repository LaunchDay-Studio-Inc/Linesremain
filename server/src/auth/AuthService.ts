// ─── Auth Service ───

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { eq, and, gt } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../database/connection.js';
import { refreshTokens } from '../database/schema.js';
import { playerRepository } from '../database/repositories/PlayerRepository.js';
import { hashPassword, comparePassword } from './PasswordUtils.js';
import { logger } from '../utils/logger.js';

// ─── Types ───

export interface JwtPayload {
  playerId: string;
  username: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  player: {
    id: string;
    username: string;
    customization: unknown;
  };
}

// ─── Custom Errors ───

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ─── Helper: parse JWT_REFRESH_EXPIRES_IN to milliseconds ───

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    // Default to 30 days
    return 30 * 24 * 60 * 60 * 1000;
  }
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 30 * 24 * 60 * 60 * 1000;
  }
}

// ─── Helper: hash refresh token with SHA-256 ───

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── Service ───

export class AuthService {
  /**
   * Register a new player account.
   */
  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<AuthResult> {
    // Check username uniqueness
    const existingUsername = await playerRepository.findByUsername(username);
    if (existingUsername) {
      throw new AuthError('Username is already taken', 'USERNAME_TAKEN', 409);
    }

    // Check email uniqueness
    const existingEmail = await playerRepository.findByEmail(email);
    if (existingEmail) {
      throw new AuthError(
        'An account with this email already exists',
        'EMAIL_TAKEN',
        409,
      );
    }

    // Hash password and create player
    const passwordHash = await hashPassword(password);
    const player = await playerRepository.createPlayer(
      username,
      email,
      passwordHash,
    );

    // Generate tokens
    const tokens = await this.generateTokens({
      playerId: player.id,
      username: player.username,
    });

    logger.info({ playerId: player.id, username: player.username }, 'Player registered');

    return {
      ...tokens,
      player: {
        id: player.id,
        username: player.username,
        customization: player.customization,
      },
    };
  }

  /**
   * Authenticate a player with email and password.
   */
  async login(email: string, password: string): Promise<AuthResult> {
    // Find player by email
    const player = await playerRepository.findByEmail(email);
    if (!player) {
      throw new AuthError(
        'Invalid email or password',
        'INVALID_CREDENTIALS',
        401,
      );
    }

    // Compare password
    const isValid = await comparePassword(password, player.passwordHash);
    if (!isValid) {
      throw new AuthError(
        'Invalid email or password',
        'INVALID_CREDENTIALS',
        401,
      );
    }

    // Update last login
    await playerRepository.updateLastLogin(player.id);

    // Generate tokens
    const tokens = await this.generateTokens({
      playerId: player.id,
      username: player.username,
    });

    logger.info({ playerId: player.id }, 'Player logged in');

    return {
      ...tokens,
      player: {
        id: player.id,
        username: player.username,
        customization: player.customization,
      },
    };
  }

  /**
   * Verify a JWT access token and return the payload.
   */
  verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
      return { playerId: decoded.playerId, username: decoded.username };
    } catch {
      throw new AuthError('Invalid or expired token', 'INVALID_TOKEN', 401);
    }
  }

  /**
   * Rotate refresh tokens — validate old token, delete it, issue new pair.
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashRefreshToken(refreshToken);

    // Look up the hashed token in the database
    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!stored) {
      throw new AuthError(
        'Invalid or expired refresh token',
        'INVALID_REFRESH_TOKEN',
        401,
      );
    }

    // Delete the old refresh token (rotation)
    await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.id, stored.id));

    // Look up the player to get current username
    const player = await playerRepository.findById(stored.playerId);
    if (!player) {
      throw new AuthError('Player not found', 'PLAYER_NOT_FOUND', 401);
    }

    // Generate new token pair
    const tokens = await this.generateTokens({
      playerId: player.id,
      username: player.username,
    });

    logger.debug({ playerId: player.id }, 'Tokens refreshed');

    return tokens;
  }

  /**
   * Logout — invalidate a refresh token.
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);

    await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));

    logger.debug('Refresh token invalidated');
  }

  /**
   * Generate a new access + refresh token pair and persist the refresh token.
   */
  private async generateTokens(payload: JwtPayload): Promise<AuthTokens> {
    // Access token
    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as string,
    } as jwt.SignOptions);

    // Refresh token — random 64-byte hex string
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashRefreshToken(rawRefreshToken);

    // Calculate expiry
    const expiresAtMs = Date.now() + parseExpiresIn(config.JWT_REFRESH_EXPIRES_IN);
    const expiresAt = new Date(expiresAtMs);

    // Store hashed refresh token in database
    await db.insert(refreshTokens).values({
      playerId: payload.playerId,
      tokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }
}

export const authService = new AuthService();