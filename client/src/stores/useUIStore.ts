// ─── UI Store ───

import { create } from 'zustand';

interface UIState {
  inventoryOpen: boolean;
  craftingOpen: boolean;
  mapOpen: boolean;
  chatOpen: boolean;
  buildingMode: boolean;
  settingsOpen: boolean;
  cursorLocked: boolean;

  toggleInventory: () => void;
  toggleCrafting: () => void;
  toggleMap: () => void;
  toggleChat: () => void;
  toggleBuildingMode: () => void;
  toggleSettings: () => void;
  setCursorLocked: (locked: boolean) => void;
  closeAll: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  inventoryOpen: false,
  craftingOpen: false,
  mapOpen: false,
  chatOpen: false,
  buildingMode: false,
  settingsOpen: false,
  cursorLocked: false,

  toggleInventory: () =>
    set((s) => ({
      inventoryOpen: !s.inventoryOpen,
      craftingOpen: false,
      mapOpen: false,
      chatOpen: false,
      settingsOpen: false,
    })),

  toggleCrafting: () =>
    set((s) => ({
      craftingOpen: !s.craftingOpen,
      inventoryOpen: false,
      mapOpen: false,
      chatOpen: false,
      settingsOpen: false,
    })),

  toggleMap: () =>
    set((s) => ({
      mapOpen: !s.mapOpen,
      inventoryOpen: false,
      craftingOpen: false,
      chatOpen: false,
      settingsOpen: false,
    })),

  toggleChat: () =>
    set((s) => ({
      chatOpen: !s.chatOpen,
      inventoryOpen: false,
      craftingOpen: false,
      mapOpen: false,
      settingsOpen: false,
    })),

  toggleBuildingMode: () =>
    set((s) => ({ buildingMode: !s.buildingMode })),

  toggleSettings: () =>
    set((s) => ({
      settingsOpen: !s.settingsOpen,
      inventoryOpen: false,
      craftingOpen: false,
      mapOpen: false,
      chatOpen: false,
    })),

  setCursorLocked: (locked) => set({ cursorLocked: locked }),

  closeAll: () =>
    set({
      inventoryOpen: false,
      craftingOpen: false,
      mapOpen: false,
      chatOpen: false,
      settingsOpen: false,
    }),
}));