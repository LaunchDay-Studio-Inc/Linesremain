// ─── Settings Store (persisted to localStorage) ───

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_KEYBINDS, type KeybindMap } from '../engine/InputManager';

type ShadowQuality = 'off' | 'low' | 'medium' | 'high';

interface SettingsState {
  // Graphics
  renderDistance: number;
  shadowQuality: ShadowQuality;
  particleDensity: number;
  fov: number;
  maxFps: number;

  // Audio
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  musicEnabled: boolean;
  muteAll: boolean;

  // Controls
  mouseSensitivity: number;
  invertY: boolean;
  keybinds: KeybindMap;

  // HUD & Gameplay
  showFps: boolean;
  showPing: boolean;
  showDebug: boolean;
  chatOpacity: number;
  showTutorial: boolean;

  // Setters
  setRenderDistance: (v: number) => void;
  setShadowQuality: (v: ShadowQuality) => void;
  setParticleDensity: (v: number) => void;
  setFov: (v: number) => void;
  setMaxFps: (v: number) => void;
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setMusicEnabled: (v: boolean) => void;
  setMuteAll: (v: boolean) => void;
  setMouseSensitivity: (v: number) => void;
  setInvertY: (v: boolean) => void;
  setKeybind: (action: keyof KeybindMap, code: string) => void;
  resetKeybinds: () => void;
  setShowFps: (v: boolean) => void;
  setShowPing: (v: boolean) => void;
  setShowDebug: (v: boolean) => void;
  setChatOpacity: (v: number) => void;
  setShowTutorial: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Graphics
      renderDistance: 5,
      shadowQuality: 'medium',
      particleDensity: 100,
      fov: 70,
      maxFps: 60,

      // Audio
      masterVolume: 80,
      sfxVolume: 80,
      musicVolume: 50,
      musicEnabled: true,
      muteAll: false,

      // Controls
      mouseSensitivity: 1.0,
      invertY: false,
      keybinds: { ...DEFAULT_KEYBINDS },

      // HUD & Gameplay
      showFps: false,
      showPing: false,
      showDebug: false,
      chatOpacity: 80,
      showTutorial: true,

      // Setters
      setRenderDistance: (v) => set({ renderDistance: Math.max(3, Math.min(10, v)) }),
      setShadowQuality: (v) => set({ shadowQuality: v }),
      setParticleDensity: (v) => set({ particleDensity: Math.max(0, Math.min(100, v)) }),
      setFov: (v) => set({ fov: Math.max(50, Math.min(120, v)) }),
      setMaxFps: (v) => set({ maxFps: v }),
      setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(100, v)) }),
      setSfxVolume: (v) => set({ sfxVolume: Math.max(0, Math.min(100, v)) }),
      setMusicVolume: (v) => set({ musicVolume: Math.max(0, Math.min(100, v)) }),
      setMusicEnabled: (v) => set({ musicEnabled: v }),
      setMuteAll: (v) => set({ muteAll: v }),
      setMouseSensitivity: (v) => set({ mouseSensitivity: Math.max(0.1, Math.min(3.0, v)) }),
      setInvertY: (v) => set({ invertY: v }),
      setKeybind: (action, code) => set((s) => ({ keybinds: { ...s.keybinds, [action]: code } })),
      resetKeybinds: () => set({ keybinds: { ...DEFAULT_KEYBINDS } }),
      setShowFps: (v) => set({ showFps: v }),
      setShowPing: (v) => set({ showPing: v }),
      setShowDebug: (v) => set({ showDebug: v }),
      setChatOpacity: (v) => set({ chatOpacity: Math.max(0, Math.min(100, v)) }),
      setShowTutorial: (v) => set({ showTutorial: v }),
    }),
    {
      name: 'lineremain-settings',
    },
  ),
);
