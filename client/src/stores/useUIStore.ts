// ─── UI Store ───

import { create } from 'zustand';
import { AudioManager } from '../engine/AudioManager';

/** Play uiOpen or uiClose sound based on toggle direction */
function playToggleSound(opening: boolean): void {
  AudioManager.getInstance().play(opening ? 'uiOpen' : 'uiClose');
}

interface UIState {
  inventoryOpen: boolean;
  craftingOpen: boolean;
  mapOpen: boolean;
  chatOpen: boolean;
  buildingMode: boolean;
  settingsOpen: boolean;
  achievementsOpen: boolean;
  customizationOpen: boolean;
  leaderboardOpen: boolean;
  cursorLocked: boolean;
  menuPanel: string | null;

  toggleInventory: () => void;
  toggleCrafting: () => void;
  toggleMap: () => void;
  toggleChat: () => void;
  toggleBuildingMode: () => void;
  toggleSettings: () => void;
  toggleAchievements: () => void;
  toggleCustomization: () => void;
  toggleLeaderboard: () => void;
  setCursorLocked: (locked: boolean) => void;
  openPanel: (name: string) => void;
  closePanel: () => void;
  closeAll: () => void;
}

const CLOSE_PANELS = {
  inventoryOpen: false,
  craftingOpen: false,
  mapOpen: false,
  chatOpen: false,
  settingsOpen: false,
  achievementsOpen: false,
  customizationOpen: false,
  leaderboardOpen: false,
  menuPanel: null,
};

export const useUIStore = create<UIState>((set) => ({
  inventoryOpen: false,
  craftingOpen: false,
  mapOpen: false,
  chatOpen: false,
  buildingMode: false,
  settingsOpen: false,
  achievementsOpen: false,
  customizationOpen: false,
  leaderboardOpen: false,
  cursorLocked: false,
  menuPanel: null,

  toggleInventory: () =>
    set((s) => {
      playToggleSound(!s.inventoryOpen);
      return { ...CLOSE_PANELS, inventoryOpen: !s.inventoryOpen };
    }),

  toggleCrafting: () =>
    set((s) => {
      playToggleSound(!s.craftingOpen);
      return { ...CLOSE_PANELS, craftingOpen: !s.craftingOpen };
    }),

  toggleMap: () =>
    set((s) => {
      playToggleSound(!s.mapOpen);
      return { ...CLOSE_PANELS, mapOpen: !s.mapOpen };
    }),

  toggleChat: () =>
    set((s) => ({
      ...CLOSE_PANELS,
      chatOpen: !s.chatOpen,
    })),

  toggleBuildingMode: () => set((s) => ({ buildingMode: !s.buildingMode })),

  toggleSettings: () =>
    set((s) => {
      playToggleSound(!s.settingsOpen);
      return { ...CLOSE_PANELS, settingsOpen: !s.settingsOpen };
    }),

  toggleAchievements: () =>
    set((s) => {
      playToggleSound(!s.achievementsOpen);
      return { ...CLOSE_PANELS, achievementsOpen: !s.achievementsOpen };
    }),

  toggleCustomization: () =>
    set((s) => {
      playToggleSound(!s.customizationOpen);
      return { ...CLOSE_PANELS, customizationOpen: !s.customizationOpen };
    }),

  toggleLeaderboard: () =>
    set((s) => {
      playToggleSound(!s.leaderboardOpen);
      return { ...CLOSE_PANELS, leaderboardOpen: !s.leaderboardOpen };
    }),

  setCursorLocked: (locked) => set({ cursorLocked: locked }),

  openPanel: (name) => set({ menuPanel: name }),

  closePanel: () => set({ menuPanel: null }),

  closeAll: () => set(CLOSE_PANELS),
}));
