// ─── Island Survival System ───
// Lightweight survival mechanics for the island world.
// - Drinking from water blocks (restores thirst)
// - Campfire warmth zone (restores temperature)
// Runs every 60 ticks (~3 seconds).

import {
  BlockType,
  ComponentType,
  type PositionComponent,
  type TemperatureComponent,
  type ThirstComponent,
} from '@lineremain/shared';
import type { GameWorld } from '../World.js';
import { getBlockAt } from './PhysicsSystem.js';

const CHECK_INTERVAL_TICKS = 60;
const WATER_THIRST_RESTORE = 2;
const CAMPFIRE_WARMTH_RANGE_SQ = 5 * 5;

let tickCounter = 0;

export function islandSurvivalSystem(world: GameWorld, _dt: number): void {
  tickCounter++;
  if (tickCounter < CHECK_INTERVAL_TICKS) return;
  tickCounter = 0;

  for (const [playerId, worldType] of world.playerWorldMap) {
    if (worldType !== 'islands') continue;

    const entityId = world.getPlayerEntity(playerId);
    if (entityId === undefined) continue;

    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position);
    if (!pos) continue;

    // ── Water drinking ──
    const thirst = world.ecs.getComponent<ThirstComponent>(entityId, ComponentType.Thirst);
    if (thirst && thirst.current < thirst.max) {
      // Check adjacent blocks for water
      let nearWater = false;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const block = getBlockAt(world, pos.x + dx, pos.y - 1, pos.z + dz, 'islands');
          if (block === BlockType.Water) {
            nearWater = true;
            break;
          }
          const blockAtFeet = getBlockAt(world, pos.x + dx, pos.y, pos.z + dz, 'islands');
          if (blockAtFeet === BlockType.Water) {
            nearWater = true;
            break;
          }
        }
        if (nearWater) break;
      }

      if (nearWater) {
        thirst.current = Math.min(thirst.max, thirst.current + WATER_THIRST_RESTORE);
      }
    }

    // ── Campfire warmth ──
    const temp = world.ecs.getComponent<TemperatureComponent>(entityId, ComponentType.Temperature);
    if (temp) {
      // Check if any building entity with pieceType 'campfire' is within range
      const buildings = world.ecs.query(ComponentType.Building, ComponentType.Position);
      for (const buildingId of buildings) {
        const building = world.ecs.getComponent(buildingId, ComponentType.Building) as
          | { pieceType: string }
          | undefined;
        if (!building || building.pieceType !== 'campfire') continue;

        const bPos = world.ecs.getComponent<PositionComponent>(buildingId, ComponentType.Position);
        if (!bPos) continue;

        const dx = pos.x - bPos.x;
        const dz = pos.z - bPos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < CAMPFIRE_WARMTH_RANGE_SQ) {
          // Warm up toward comfortable temperature
          if (temp.current < 37) {
            temp.current = Math.min(37, temp.current + 0.5);
          }
          break;
        }
      }
    }
  }
}
