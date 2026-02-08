// ─── Game Store ───

import { create } from 'zustand';

export type Screen = 'menu' | 'character-select' | 'loading' | 'playing' | 'dead';

interface GameState {
  screen: Screen;
  isConnected: boolean;
  isOffline: boolean;
  accessToken: string | null;
  playerName: string | null;

  setScreen: (screen: Screen) => void;
  setConnected: (connected: boolean) => void;
  setOffline: (offline: boolean) => void;
  setAuth: (token: string, name: string) => void;
  logout: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  isConnected: false,
  isOffline: false,
  accessToken: null,
  playerName: null,

  setScreen: (screen) => set({ screen }),
  setConnected: (connected) => set({ isConnected: connected }),
  setOffline: (offline) => set({ isOffline: offline }),
  setAuth: (token, name) => set({ accessToken: token, playerName: name }),
  logout: () =>
    set({
      screen: 'menu',
      isConnected: false,
      isOffline: false,
      accessToken: null,
      playerName: null,
    }),
}));
