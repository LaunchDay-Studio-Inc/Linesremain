// ─── Temperature System ───
// Calculates environmental temperature for entities based on biome, time of day,
// altitude, clothing, fire proximity, and water immersion. Applies freezing/heat damage.

import {
  ARMOR_STATS,
  BuildingPieceType,
  CAMPFIRE_WARMTH_BONUS,
  CAMPFIRE_WARMTH_RADIUS,
  COLD_DAMAGE_RATE,
  COLD_THRESHOLD,
  ComponentType,
  FREEZING_THRESHOLD,
  HEAT_DAMAGE_RATE,
  HEAT_THRESHOLD,
  NIGHT_TEMPERATURE_DROP,
  SEA_LEVEL,
  type ColliderComponent,
  type EquipmentComponent,
  type HealthComponent,
  type PositionComponent,
  type TemperatureComponent,
  type ThirstComponent,
} from '@lineremain/shared';
import type { GameWorld } from '../World.js';
import { getBlockAt, isWaterBlock } from './PhysicsSystem.js';

// ─── Constants ───

/** Run temperature checks every 60 ticks (3 seconds at 20 TPS) */
const TEMP_CHECK_INTERVAL = 60;

/** Pre-computed seconds per check interval for scaling per-second damage rates */
const CHECK_INTERVAL_SECONDS = TEMP_CHECK_INTERVAL / 20;

/** Temperature loss per 20 blocks above sea level */
const ALTITUDE_TEMP_DROP_PER_20 = 1.0;

/** Temperature penalty when submerged in water */
const WATER_TEMP_PENALTY = 10.0;

/** Thirst drain multiplier in hot environments */
const HEAT_THIRST_DRAIN_MULT = 2.0;

// ─── Tick Counter ───

let tickCounter = 0;

// ─── System ───

export function temperatureSystem(world: GameWorld, _dt: number): void {
  tickCounter++;
  if (tickCounter % TEMP_CHECK_INTERVAL !== 0) return;

  const biomeManager = world.terrainGenerator.biomeManager;

  // Pre-query campfire positions once (avoid O(N²) per-entity building scan)
  const buildingEntities = world.ecs.query(ComponentType.Building, ComponentType.Position);
  const campfirePositions: PositionComponent[] = [];
  for (const buildingId of buildingEntities) {
    const building = world.ecs.getComponent<import('@lineremain/shared').BuildingComponent>(
      buildingId,
      ComponentType.Building,
    )!;
    if (building.pieceType === BuildingPieceType.Campfire) {
      campfirePositions.push(
        world.ecs.getComponent<PositionComponent>(buildingId, ComponentType.Position)!,
      );
    }
  }

  const entities = world.ecs.query(ComponentType.Temperature, ComponentType.Position);

  for (const entityId of entities) {
    const temp = world.ecs.getComponent<TemperatureComponent>(entityId, ComponentType.Temperature)!;
    const pos = world.ecs.getComponent<PositionComponent>(entityId, ComponentType.Position)!;
    const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health);

    // ── 1. Biome base temperature ──
    const biome = biomeManager.getBiome(pos.x, pos.z);
    const biomeProps = biomeManager.getBiomeProperties(biome);
    let envTemp = biomeProps.baseTemperature;

    // ── 2. Time-of-day modifier (sinusoidal) ──
    // worldTime: 0 = dawn, 0.25 = noon, 0.5 = dusk, 0.75 = midnight
    // Sin curve: peak at noon (+5°C), trough at midnight (-NIGHT_TEMPERATURE_DROP)
    const timeAngle = (world.worldTime - 0.25) * Math.PI * 2; // offset so 0.25 (noon) = sin peak
    const timeMod = -Math.sin(timeAngle); // +1 at noon, -1 at midnight
    // Map: +1 → +5°C, -1 → -NIGHT_TEMPERATURE_DROP
    const timeTemp = timeMod > 0 ? timeMod * 5 : timeMod * NIGHT_TEMPERATURE_DROP;
    envTemp += timeTemp;

    // ── 3. Altitude modifier ──
    // -1°C per 20 blocks above sea level
    const altitudeAboveSea = pos.y - SEA_LEVEL;
    if (altitudeAboveSea > 0) {
      envTemp -= (altitudeAboveSea / 20) * ALTITUDE_TEMP_DROP_PER_20;
    }

    // ── 4. Clothing insulation modifier ──
    const equipment = world.ecs.getComponent<EquipmentComponent>(entityId, ComponentType.Equipment);
    if (equipment) {
      const slots = [equipment.head, equipment.chest, equipment.legs, equipment.feet];
      for (const slot of slots) {
        if (slot) {
          const armorStats = ARMOR_STATS[slot.itemId];
          if (armorStats) {
            envTemp += armorStats.insulation;
          }
        }
      }
    }

    // ── 5. Fire proximity ──
    // Check if any campfire is within CAMPFIRE_WARMTH_RADIUS
    let nearFire = false;
    const warmthRadSq = CAMPFIRE_WARMTH_RADIUS * CAMPFIRE_WARMTH_RADIUS;
    for (const bPos of campfirePositions) {
      const dx = pos.x - bPos.x;
      const dy = pos.y - bPos.y;
      const dz = pos.z - bPos.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq <= warmthRadSq) {
        nearFire = true;
        break;
      }
    }
    if (nearFire) {
      envTemp += CAMPFIRE_WARMTH_BONUS;
    }

    // ── 6. Water immersion modifier ──
    const collider = world.ecs.getComponent<ColliderComponent>(entityId, ComponentType.Collider);
    const halfHeight = collider ? collider.height / 2 : 0.9;
    const blockAtCenter = getBlockAt(world, pos.x, pos.y + halfHeight, pos.z);
    const inWater = isWaterBlock(blockAtCenter);
    if (inWater) {
      envTemp -= WATER_TEMP_PENALTY;
    }

    // ── Store environmental temperature ──
    temp.environmental = envTemp;

    // Body temperature lerps toward environmental with some homeostatic resistance
    // Body naturally regulates toward 37°C but environmental extremes overwhelm it
    const bodyTarget =
      envTemp < COLD_THRESHOLD
        ? Math.max(envTemp, envTemp + (37 - envTemp) * 0.3)
        : envTemp > HEAT_THRESHOLD
          ? Math.min(envTemp, envTemp - (envTemp - 37) * 0.3)
          : 37;
    temp.current += (bodyTarget - temp.current) * 0.1;

    // ── 7. Temperature damage effects ──
    if (!health) continue;

    // Freezing damage (scaled to check interval)
    if (envTemp <= FREEZING_THRESHOLD) {
      // Severe cold: high damage per second
      health.current -= COLD_DAMAGE_RATE * 4 * CHECK_INTERVAL_SECONDS;
    } else if (envTemp < COLD_THRESHOLD) {
      // Cold: moderate damage per second
      health.current -= COLD_DAMAGE_RATE * 2 * CHECK_INTERVAL_SECONDS;
    }

    // Heat damage (scaled to check interval)
    if (envTemp >= HEAT_THRESHOLD) {
      // Heatstroke: damage per second + increased thirst drain
      health.current -= HEAT_DAMAGE_RATE * 3 * CHECK_INTERVAL_SECONDS;

      // Double thirst drain in extreme heat
      const thirst = world.ecs.getComponent<ThirstComponent>(entityId, ComponentType.Thirst);
      if (thirst) {
        thirst.current = Math.max(0, thirst.current - thirst.drainRate * HEAT_THIRST_DRAIN_MULT);
      }
    }

    // Clamp health
    if (health.current < 0) health.current = 0;
  }
}
