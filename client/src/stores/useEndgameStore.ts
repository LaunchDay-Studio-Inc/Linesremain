// ─── Endgame Store ───

import type { ItemStack } from '@shared/types/items';
import { create } from 'zustand';

interface EndgameState {
  // Raid alerts
  raidAlert: { position: { x: number; y: number; z: number }; attackerName: string } | null;
  setRaidAlert: (
    alert: { position: { x: number; y: number; z: number }; attackerName: string } | null,
  ) => void;

  // Code lock prompt
  codeLockPrompt: { entityId: number; isOwner: boolean } | null;
  setCodeLockPrompt: (prompt: { entityId: number; isOwner: boolean } | null) => void;

  // Container
  containerOpen: {
    entityId: number;
    containerType: string;
    slots: (ItemStack | null)[];
    maxSlots: number;
  } | null;
  setContainerOpen: (
    data: {
      entityId: number;
      containerType: string;
      slots: (ItemStack | null)[];
      maxSlots: number;
    } | null,
  ) => void;

  // Research
  researchProgress: {
    entityId: number;
    progress: number;
    isComplete: boolean;
    itemName?: string;
  } | null;
  setResearchProgress: (
    data: { entityId: number; progress: number; isComplete: boolean; itemName?: string } | null,
  ) => void;

  // Blueprints learned
  learnedBlueprints: number[];
  addBlueprint: (recipeId: number) => void;

  // Season info
  seasonInfo: { seasonNumber: number; wipeTimestamp: number; seasonStartedAt: number } | null;
  setSeasonInfo: (
    info: { seasonNumber: number; wipeTimestamp: number; seasonStartedAt: number } | null,
  ) => void;

  // Wipe warning
  wipeWarning: { timeRemainingMs: number; message: string } | null;
  setWipeWarning: (warning: { timeRemainingMs: number; message: string } | null) => void;
}

export const useEndgameStore = create<EndgameState>((set) => ({
  raidAlert: null,
  setRaidAlert: (alert) => set({ raidAlert: alert }),

  codeLockPrompt: null,
  setCodeLockPrompt: (prompt) => set({ codeLockPrompt: prompt }),

  containerOpen: null,
  setContainerOpen: (data) => set({ containerOpen: data }),

  researchProgress: null,
  setResearchProgress: (data) => set({ researchProgress: data }),

  learnedBlueprints: [],
  addBlueprint: (recipeId) =>
    set((state) => ({
      learnedBlueprints: state.learnedBlueprints.includes(recipeId)
        ? state.learnedBlueprints
        : [...state.learnedBlueprints, recipeId],
    })),

  seasonInfo: null,
  setSeasonInfo: (info) => set({ seasonInfo: info }),

  wipeWarning: null,
  setWipeWarning: (warning) => set({ wipeWarning: warning }),
}));
