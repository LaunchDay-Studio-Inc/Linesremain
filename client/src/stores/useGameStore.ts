// ─── Game Store ───

import { create } from 'zustand';

export type Screen = 'menu' | 'character-select' | 'loading' | 'playing' | 'dead';

interface GameState {
  screen: Screen;
  isConnected: boolean;
  isOffline: boolean;
  accessToken: string | null;
  playerName: string | null;
  hasSleepingBag: boolean;

  setScreen: (screen: Screen) => void;
  setConnected: (connected: boolean) => void;
  setOffline: (offline: boolean) => void;
  setAuth: (token: string, name: string) => void;
  setHasSleepingBag: (has: boolean) => void;
  logout: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  isConnected: false,
  isOffline: false,
  accessToken: null,
  playerName: null,
  hasSleepingBag: false,

  setScreen: (screen) => set({ screen }),
  setConnected: (connected) => set({ isConnected: connected }),
  setOffline: (offline) => set({ isOffline: offline }),
  setAuth: (token, name) => set({ accessToken: token, playerName: name }),
  setHasSleepingBag: (has) => set({ hasSleepingBag: has }),
  logout: () =>
    set({
      screen: 'menu',
      isConnected: false,
      isOffline: false,
      accessToken: null,
      playerName: null,
      hasSleepingBag: false,
    }),
}));
