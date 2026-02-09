// ─── Teleport System ───
// Checks if players in the island world are standing on the teleport portal.
// If within trigger radius, teleports them to the main world.

import {
  ComponentType,
  EMBER_ISLAND,
  MAIN_WORLD_SPAWN,
  PORTAL_TRIGGER_RADIUS,
  type PositionComponent,
} from '@lineremain/shared';
import type { GameWorld } from '../World.js';

export function teleportSystem(world: GameWorld, _dt: number): void {
  const playerWorldMap = world.playerWorldMap;

  for (const [playerId, worldType] of playerWorldMap) {
    if (worldType !== 'islands') continue;

    const entityId = world.getPlayerEntity(playerId);
    if (entityId === undefined) continue;

    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
    if (!pos) continue;

    // XZ distance to portal center
    const dx = pos.x - EMBER_ISLAND.portalX;
    const dz = pos.z - EMBER_ISLAND.portalZ;
    const distSq = dx * dx + dz * dz;

    if (distSq > PORTAL_TRIGGER_RADIUS * PORTAL_TRIGGER_RADIUS) continue;

    // Y check (within 3 blocks of portal level)
    const dy = Math.abs(pos.y - EMBER_ISLAND.portalY);
    if (dy > 3) continue;

    // ── TELEPORT TO MAIN WORLD ──
    playerWorldMap.set(playerId, 'main');

    // Move player to main world spawn
    const spawnY = world.findMainWorldSurfaceY(MAIN_WORLD_SPAWN.x, MAIN_WORLD_SPAWN.z);
    pos.x = MAIN_WORLD_SPAWN.x;
    pos.y = spawnY + 1;
    pos.z = MAIN_WORLD_SPAWN.z;

    // Queue for client notification (picked up by SocketServer)
    world.pendingTeleports.push(playerId);
  }
}
