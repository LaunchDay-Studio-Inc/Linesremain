// ─── Customization & Tutorial Handler ───
// Handles player customization changes and tutorial progression.

import {
  ClientMessage,
  FREE_COLORS,
  LEVEL_REWARDS,
  ServerMessage,
  TUTORIAL_STEPS,
  type CustomizePayload,
  type TutorialStep,
} from '@lineremain/shared';
import type { Server, Socket } from 'socket.io';
import { achievementRepository } from '../../database/repositories/AchievementRepository.js';
import { getPlayerStats } from '../../game/systems/AchievementSystem.js';
import type { GameWorld } from '../../game/World.js';
import { logger } from '../../utils/logger.js';

// ─── Validation ───

function isValidCustomizePayload(payload: unknown): payload is CustomizePayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  // At least one field must be present
  return (
    p.bodyColor !== undefined ||
    p.accessory !== undefined ||
    p.trail !== undefined ||
    p.deathEffect !== undefined ||
    p.title !== undefined
  );
}

function isColorUnlocked(color: string, level: number): boolean {
  // Free colors are always available
  if (FREE_COLORS.includes(color)) return true;
  // Check level-unlocked colors
  const colorReward = LEVEL_REWARDS.find((r) => r.type === 'body_color' && r.id === color);
  return colorReward ? colorReward.level <= level : false;
}

function isRewardUnlocked(type: string, id: string, level: number): boolean {
  if (id === null) return true; // null means "none" → always valid
  const reward = LEVEL_REWARDS.find((r) => r.type === type && r.id === id);
  return reward ? reward.level <= level : false;
}

// ─── Register Handlers ───

export function registerCustomizationHandlers(
  _io: Server,
  socket: Socket,
  _world: GameWorld,
  getPlayerId: (socket: Socket) => string | undefined,
): void {
  // ── Customization ──
  socket.on(ClientMessage.Customize, (payload: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    if (!isValidCustomizePayload(payload)) return;

    const stats = getPlayerStats(playerId);
    const playerLevel = stats?.level ?? 1;

    // Validate each field against level rewards
    if (payload.bodyColor !== undefined) {
      // bodyColor is a hex string; check if it's a free color or a color_* reward id
      const isHexFree = FREE_COLORS.includes(payload.bodyColor);
      const isRewardColor = LEVEL_REWARDS.some(
        (r) => r.type === 'body_color' && r.id === payload.bodyColor && r.level <= playerLevel,
      );
      // Also allow hex colors that map to reward colors
      if (!isHexFree && !isRewardColor) {
        socket.emit(ServerMessage.Notification, {
          type: 'error',
          message: 'That color is locked.',
          duration: 3000,
        });
        return;
      }
    }

    if (payload.accessory !== undefined && payload.accessory !== null) {
      if (!isRewardUnlocked('accessory', payload.accessory, playerLevel)) {
        socket.emit(ServerMessage.Notification, {
          type: 'error',
          message: 'That accessory is locked.',
          duration: 3000,
        });
        return;
      }
    }

    if (payload.trail !== undefined && payload.trail !== null) {
      if (!isRewardUnlocked('trail', payload.trail, playerLevel)) {
        socket.emit(ServerMessage.Notification, {
          type: 'error',
          message: 'That trail is locked.',
          duration: 3000,
        });
        return;
      }
    }

    if (payload.deathEffect !== undefined && payload.deathEffect !== null) {
      if (!isRewardUnlocked('death_effect', payload.deathEffect, playerLevel)) {
        socket.emit(ServerMessage.Notification, {
          type: 'error',
          message: 'That death effect is locked.',
          duration: 3000,
        });
        return;
      }
    }

    if (payload.title !== undefined && payload.title !== null) {
      if (!isRewardUnlocked('title', payload.title, playerLevel)) {
        socket.emit(ServerMessage.Notification, {
          type: 'error',
          message: 'That title is locked.',
          duration: 3000,
        });
        return;
      }
    }

    // Build customization update
    const customization = {
      bodyColor: payload.bodyColor ?? '#ffffff',
      accessory: payload.accessory ?? null,
      trail: payload.trail ?? null,
      deathEffect: payload.deathEffect ?? null,
      title: payload.title ?? null,
    };

    // Persist to DB
    achievementRepository.updateCustomization(playerId, customization).catch((err) => {
      logger.error({ playerId, err }, 'Failed to save customization');
    });

    // Confirm back to client
    socket.emit(ServerMessage.CustomizationUpdated, customization);

    logger.debug({ playerId }, 'Player customization updated');
  });

  // ── Tutorial Advance ──
  socket.on(ClientMessage.TutorialAdvance, () => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const stats = getPlayerStats(playerId);
    if (!stats) return;

    // Load current tutorial step from DB stats (we don't cache this separately)
    achievementRepository
      .getPlayerStats(playerId)
      .then((dbStats) => {
        if (!dbStats) return;

        const currentStep = dbStats.tutorialStep as TutorialStep;
        const currentIdx = TUTORIAL_STEPS.indexOf(currentStep);
        if (currentIdx < 0 || currentIdx >= TUTORIAL_STEPS.length - 1) return;

        const nextStep = TUTORIAL_STEPS[currentIdx + 1]!;
        achievementRepository.updateTutorialStep(playerId, nextStep).catch((err) => {
          logger.error({ playerId, err }, 'Failed to advance tutorial step');
        });

        socket.emit(ServerMessage.TutorialStep, { step: nextStep });
      })
      .catch((err) => {
        logger.error({ playerId, err }, 'Failed to get tutorial state');
      });
  });

  // ── Tutorial Skip ──
  socket.on(ClientMessage.TutorialSkip, () => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    achievementRepository.updateTutorialStep(playerId, 'complete').catch((err) => {
      logger.error({ playerId, err }, 'Failed to skip tutorial');
    });

    socket.emit(ServerMessage.TutorialStep, { step: 'complete' });
  });

  logger.debug({ socketId: socket.id }, 'Customization handlers registered');
}
