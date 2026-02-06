// ─── Game Store ───

import { create } from 'zustand';

export type Screen = 'menu' | 'loading' | 'playing' | 'dead';

interface GameState {
  screen: Screen;
  isConnected: boolean;
  accessToken: string | null;
  playerName: string | null;

  setScreen: (screen: Screen) => void;
  setConnected: (connected: boolean) => void;
  setAuth: (token: string, name: string) => void;
  logout: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  isConnected: false,
  accessToken: null,
  playerName: null,

  setScreen: (screen) => set({ screen }),
  setConnected: (connected) => set({ isConnected: connected }),
  setAuth: (token, name) => set({ accessToken: token, playerName: name }),
  logout: () =>
    set({
      screen: 'menu',
      isConnected: false,
      accessToken: null,
      playerName: null,
    }),
}));