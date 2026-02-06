// ─── Rate Limiter ───
// Per-player, per-action sliding window rate limiter with configurable limits.

// ─── Types ───

interface RateLimitEntry {
  timestamps: number[];
}

// ─── Rate Limiter ───

export class RateLimiter {
  /** Map of "playerId:action" → timestamps */
  private entries = new Map<string, RateLimitEntry>();

  /** Maximum number of actions allowed within the window */
  private maxActions: number;

  /** Time window in milliseconds */
  private windowMs: number;

  constructor(maxActions: number, windowMs: number = 1000) {
    this.maxActions = maxActions;
    this.windowMs = windowMs;
  }

  /**
   * Check if an action is allowed for a player.
   * Returns true if allowed, false if rate limited.
   * Automatically records the action if allowed.
   */
  check(playerId: string, action: string = 'default'): boolean {
    const key = `${playerId}:${action}`;
    const now = Date.now();

    let entry = this.entries.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.entries.set(key, entry);
    }

    // Remove timestamps outside the window
    const cutoff = now - this.windowMs;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    // Check if under limit
    if (entry.timestamps.length >= this.maxActions) {
      return false;
    }

    // Record this action
    entry.timestamps.push(now);
    return true;
  }

  /**
   * Remove all entries for a player (on disconnect).
   */
  removePlayer(playerId: string): void {
    const keysToRemove: string[] = [];
    for (const key of this.entries.keys()) {
      if (key.startsWith(`${playerId}:`)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      this.entries.delete(key);
    }
  }

  /**
   * Clean up old entries to prevent memory leaks.
   * Should be called periodically (e.g., every 60 seconds).
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs * 2;

    for (const [key, entry] of this.entries) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) {
        this.entries.delete(key);
      }
    }
  }
}

// ─── Pre-configured Rate Limiters ───

/** Player input: 20 actions per second */
export const inputRateLimiter = new RateLimiter(20, 1000);

/** Chat messages: 1 per second */
export const chatRateLimiter = new RateLimiter(1, 1000);

/** Chunk requests: 10 per second */
export const chunkRequestRateLimiter = new RateLimiter(10, 1000);

/** Inventory operations: 10 per second */
export const inventoryRateLimiter = new RateLimiter(10, 1000);

/** Crafting operations: 5 per second */
export const craftingRateLimiter = new RateLimiter(5, 1000);

/** Team operations: 3 per second */
export const teamRateLimiter = new RateLimiter(3, 1000);