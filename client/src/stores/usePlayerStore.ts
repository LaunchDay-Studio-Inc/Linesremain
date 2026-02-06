// ─── Player Store ───

import { create } from 'zustand';
import type { ItemStack } from '@shared/types/items';
import {
  MAX_HEALTH,
  MAX_HUNGER,
  MAX_THIRST,
  NORMAL_BODY_TEMP,
} from '@shared/constants/survival';
import {
  PLAYER_INVENTORY_SLOTS,
  HOTBAR_SLOTS,
} from '@shared/constants/game';

interface PlayerState {
  position: { x: number; y: number; z: number };
  health: number;
  hunger: number;
  thirst: number;
  temperature: number;
  inventory: (ItemStack | null)[];
  equipment: Record<string, ItemStack | null>;
  hotbarIndex: number;

  setPosition: (x: number, y: number, z: number) => void;
  setHealth: (health: number) => void;
  setHunger: (hunger: number) => void;
  setThirst: (thirst: number) => void;
  setTemperature: (temperature: number) => void;
  setInventory: (inventory: (ItemStack | null)[]) => void;
  setHotbarIndex: (index: number) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  position: { x: 0, y: 0, z: 0 },
  health: MAX_HEALTH,
  hunger: MAX_HUNGER,
  thirst: MAX_THIRST,
  temperature: NORMAL_BODY_TEMP,
  inventory: Array(PLAYER_INVENTORY_SLOTS + HOTBAR_SLOTS).fill(null) as (ItemStack | null)[],
  equipment: {},
  hotbarIndex: 0,

  setPosition: (x, y, z) => set({ position: { x, y, z } }),
  setHealth: (health) => set({ health }),
  setHunger: (hunger) => set({ hunger }),
  setThirst: (thirst) => set({ thirst }),
  setTemperature: (temperature) => set({ temperature }),
  setInventory: (inventory) => set({ inventory }),
  setHotbarIndex: (index) => set({ hotbarIndex: index }),
}));