// ─── Building Network Handler ───
// Socket event handlers for building placement, upgrades, and demolition.
// All requests are validated server-side before execution.

import { BuildingPieceType, BuildingTier, ClientMessage, type EntityId } from '@lineremain/shared';
import type { Server, Socket } from 'socket.io';
import {
  handleDemolish,
  handlePlacement,
  handleUpgrade,
} from '../../game/systems/BuildingPlacementSystem.js';
import { hasBuilderPrivilege } from '../../game/systems/ToolCupboardSystem.js';
import { trackBuildingPlace } from '../../game/systems/AchievementSystem.js';
import type { GameWorld } from '../../game/World.js';
import { logger } from '../../utils/logger.js';

// ─── Event Payload Types ───

interface BuildPlacePayload {
  pieceType: string;
  tier: number;
  position: { x: number; y: number; z: number };
  rotation: number;
}

interface BuildUpgradePayload {
  entityId: number;
  newTier: number;
}

interface BuildDemolishPayload {
  entityId: number;
}

// ─── Response Types ───

interface BuildResponse {
  success: boolean;
  entityId?: EntityId;
  error?: string;
  position?: { x: number; y: number; z: number };
  pieceType?: string;
  tier?: number;
  rotation?: number;
}

// ─── Validation Helpers ───

function isValidPieceType(value: string): value is BuildingPieceType {
  return Object.values(BuildingPieceType).includes(value as BuildingPieceType);
}

function isValidTier(value: number): value is BuildingTier {
  return value >= BuildingTier.Twig && value <= BuildingTier.Armored && Number.isInteger(value);
}

function isValidPosition(pos: unknown): pos is { x: number; y: number; z: number } {
  if (!pos || typeof pos !== 'object') return false;
  const p = pos as Record<string, unknown>;
  return (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    typeof p.z === 'number' &&
    isFinite(p.x) &&
    isFinite(p.y) &&
    isFinite(p.z)
  );
}

// ─── Register Building Handlers ───

export function registerBuildingHandlers(
  io: Server,
  socket: Socket,
  world: GameWorld,
  getPlayerId: (socket: Socket) => string | undefined,
): void {
  // ─── Build Place ───
  socket.on(
    ClientMessage.BuildPlace,
    (payload: BuildPlacePayload, callback?: (res: BuildResponse) => void) => {
      const playerId = getPlayerId(socket);
      if (!playerId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      // Validate payload
      if (!payload || typeof payload !== 'object') {
        callback?.({ success: false, error: 'Invalid payload' });
        return;
      }

      if (!isValidPieceType(payload.pieceType)) {
        callback?.({ success: false, error: 'Invalid piece type' });
        return;
      }

      if (!isValidTier(payload.tier)) {
        callback?.({ success: false, error: 'Invalid building tier' });
        return;
      }

      if (!isValidPosition(payload.position)) {
        callback?.({ success: false, error: 'Invalid position' });
        return;
      }

      if (typeof payload.rotation !== 'number' || !isFinite(payload.rotation)) {
        callback?.({ success: false, error: 'Invalid rotation' });
        return;
      }

      // Check building privilege (TC authorization)
      if (!hasBuilderPrivilege(world, playerId, payload.position)) {
        callback?.({ success: false, error: 'No building privilege in this area' });
        return;
      }

      // Execute placement
      const result = handlePlacement(
        world,
        playerId,
        payload.pieceType as BuildingPieceType,
        payload.tier as BuildingTier,
        payload.position,
        payload.rotation,
      );

      if (result.success && result.entityId !== undefined) {
        // Track building placement for achievements
        trackBuildingPlace(playerId);

        // Use the server-snapped position (authoritative) instead of raw client position
        const snappedPos = result.snappedPosition ?? payload.position;

        // Broadcast to all players in range
        const response: BuildResponse = {
          success: true,
          entityId: result.entityId,
          position: snappedPos,
          pieceType: payload.pieceType,
          tier: payload.tier,
          rotation: payload.rotation,
        };

        // Notify the placing player
        callback?.(response);

        // Broadcast to other players
        socket.broadcast.emit('build:placed', {
          entityId: result.entityId,
          pieceType: payload.pieceType,
          tier: payload.tier,
          position: snappedPos,
          rotation: payload.rotation,
          ownerId: playerId,
        });
      } else {
        callback?.({ success: false, error: result.error });
      }
    },
  );

  // ─── Build Upgrade ───
  socket.on(
    ClientMessage.BuildUpgrade,
    (payload: BuildUpgradePayload, callback?: (res: BuildResponse) => void) => {
      const playerId = getPlayerId(socket);
      if (!playerId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!payload || typeof payload !== 'object') {
        callback?.({ success: false, error: 'Invalid payload' });
        return;
      }

      if (typeof payload.entityId !== 'number' || !Number.isInteger(payload.entityId)) {
        callback?.({ success: false, error: 'Invalid entity ID' });
        return;
      }

      if (!isValidTier(payload.newTier)) {
        callback?.({ success: false, error: 'Invalid target tier' });
        return;
      }

      const result = handleUpgrade(
        world,
        playerId,
        payload.entityId as EntityId,
        payload.newTier as BuildingTier,
      );

      if (result.success) {
        callback?.({ success: true });

        // Broadcast upgrade to other players
        socket.broadcast.emit('build:upgraded', {
          entityId: payload.entityId,
          newTier: payload.newTier,
        });
      } else {
        callback?.({ success: false, error: result.error });
      }
    },
  );

  // ─── Build Demolish ───
  socket.on(
    ClientMessage.BuildDemolish,
    (payload: BuildDemolishPayload, callback?: (res: BuildResponse) => void) => {
      const playerId = getPlayerId(socket);
      if (!playerId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!payload || typeof payload !== 'object') {
        callback?.({ success: false, error: 'Invalid payload' });
        return;
      }

      if (typeof payload.entityId !== 'number' || !Number.isInteger(payload.entityId)) {
        callback?.({ success: false, error: 'Invalid entity ID' });
        return;
      }

      const result = handleDemolish(world, playerId, payload.entityId as EntityId);

      if (result.success) {
        callback?.({ success: true });

        // Broadcast demolition to other players
        socket.broadcast.emit('build:demolished', {
          entityId: payload.entityId,
        });
      } else {
        callback?.({ success: false, error: result.error });
      }
    },
  );

  logger.debug({ socketId: socket.id }, 'Building handlers registered');
}
