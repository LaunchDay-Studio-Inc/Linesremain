// ─── Game Store ───

import type { AncestorRecord, LineagePayload } from '@lineremain/shared';
import { create } from 'zustand';

export type Screen = 'menu' | 'character-select' | 'loading' | 'playing' | 'dead' | 'legacy';

interface GameState {
  screen: Screen;
  isConnected: boolean;
  isOffline: boolean;
  accessToken: string | null;
  playerName: string | null;
  hasSleepingBag: boolean;
  deathCause: string | null;
  lineage: { generation: number; ancestors: AncestorRecord[] } | null;
  legacyData: LineagePayload | null;
  loadingProgress: number;
  loadingStage: string;

  setScreen: (screen: Screen) => void;
  setConnected: (connected: boolean) => void;
  setOffline: (offline: boolean) => void;
  setAuth: (token: string, name: string) => void;
  setHasSleepingBag: (has: boolean) => void;
  setDeathCause: (cause: string | null) => void;
  setLineage: (lineage: { generation: number; ancestors: AncestorRecord[] } | null) => void;
  setLegacyData: (data: LineagePayload | null) => void;
  setLoadingProgress: (progress: number, stage: string) => void;
  logout: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  isConnected: false,
  isOffline: false,
  accessToken: null,
  playerName: null,
  hasSleepingBag: false,
  deathCause: null,
  lineage: null,
  legacyData: null,
  loadingProgress: 0,
  loadingStage: 'Connecting to server...',

  setScreen: (screen) => set({ screen }),
  setConnected: (connected) => set({ isConnected: connected }),
  setOffline: (offline) => set({ isOffline: offline }),
  setAuth: (token, name) => set({ accessToken: token, playerName: name }),
  setHasSleepingBag: (has) => set({ hasSleepingBag: has }),
  setDeathCause: (cause) => set({ deathCause: cause }),
  setLineage: (lineage) => set({ lineage }),
  setLegacyData: (data) => set({ legacyData: data }),
  setLoadingProgress: (progress, stage) => set({ loadingProgress: progress, loadingStage: stage }),
  logout: () =>
    set({
      screen: 'menu',
      isConnected: false,
      isOffline: false,
      accessToken: null,
      playerName: null,
      hasSleepingBag: false,
      deathCause: null,
      lineage: null,
      legacyData: null,
      loadingProgress: 0,
      loadingStage: 'Connecting to server...',
    }),
}));
