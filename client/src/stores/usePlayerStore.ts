// ─── Player Store ───

import { HOTBAR_SLOTS, PLAYER_INVENTORY_SLOTS } from '@shared/constants/game';
import { MAX_HEALTH, MAX_HUNGER, MAX_THIRST, NORMAL_BODY_TEMP } from '@shared/constants/survival';
import type { ItemStack } from '@shared/types/items';
import { create } from 'zustand';

interface PlayerState {
  position: { x: number; y: number; z: number };
  yaw: number; // camera azimuth in degrees (0-360)
  health: number;
  hunger: number;
  thirst: number;
  temperature: number;
  inventory: (ItemStack | null)[];
  equipment: Record<string, ItemStack | null>;
  hotbarIndex: number;
  currentBiome: string;
  deathPosition: { x: number; y: number; z: number } | null;
  deathTime: number | null; // timestamp of last death

  setPosition: (x: number, y: number, z: number) => void;
  setYaw: (yaw: number) => void;
  setHealth: (health: number) => void;
  setHunger: (hunger: number) => void;
  setThirst: (thirst: number) => void;
  setTemperature: (temperature: number) => void;
  setInventory: (inventory: (ItemStack | null)[]) => void;
  setEquipment: (equipment: Record<string, ItemStack | null>) => void;
  setHotbarIndex: (index: number) => void;
  setCurrentBiome: (biome: string) => void;
  setDeathPosition: (pos: { x: number; y: number; z: number } | null) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  position: { x: 0, y: 0, z: 0 },
  yaw: 0,
  health: MAX_HEALTH,
  hunger: MAX_HUNGER,
  thirst: MAX_THIRST,
  temperature: NORMAL_BODY_TEMP,
  inventory: Array(PLAYER_INVENTORY_SLOTS + HOTBAR_SLOTS).fill(null) as (ItemStack | null)[],
  equipment: {},
  hotbarIndex: 0,
  currentBiome: 'Greenhollow',
  deathPosition: null,
  deathTime: null,

  setPosition: (x, y, z) => set({ position: { x, y, z } }),
  setYaw: (yaw) => set({ yaw }),
  setHealth: (health) => set({ health }),
  setHunger: (hunger) => set({ hunger }),
  setThirst: (thirst) => set({ thirst }),
  setTemperature: (temperature) => set({ temperature }),
  setInventory: (inventory) => set({ inventory }),
  setEquipment: (equipment) => set({ equipment }),
  setHotbarIndex: (index) => set({ hotbarIndex: index }),
  setCurrentBiome: (biome) => set({ currentBiome: biome }),
  setDeathPosition: (pos) => set({ deathPosition: pos, deathTime: pos ? Date.now() : null }),
}));
