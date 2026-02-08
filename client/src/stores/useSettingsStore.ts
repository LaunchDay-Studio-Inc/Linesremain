// ─── Settings Store (persisted to localStorage) ───

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ShadowQuality = 'off' | 'low' | 'medium' | 'high';

interface SettingsState {
  renderDistance: number;
  shadowQuality: ShadowQuality;
  particleDensity: number;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  musicEnabled: boolean;
  mouseSensitivity: number;
  showFps: boolean;
  showPing: boolean;

  setRenderDistance: (v: number) => void;
  setShadowQuality: (v: ShadowQuality) => void;
  setParticleDensity: (v: number) => void;
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setMusicEnabled: (v: boolean) => void;
  setMouseSensitivity: (v: number) => void;
  setShowFps: (v: boolean) => void;
  setShowPing: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      renderDistance: 5,
      shadowQuality: 'medium',
      particleDensity: 100,
      masterVolume: 80,
      sfxVolume: 80,
      musicVolume: 50,
      musicEnabled: true,
      mouseSensitivity: 1.0,
      showFps: false,
      showPing: false,

      setRenderDistance: (v) => set({ renderDistance: Math.max(3, Math.min(10, v)) }),
      setShadowQuality: (v) => set({ shadowQuality: v }),
      setParticleDensity: (v) => set({ particleDensity: Math.max(0, Math.min(100, v)) }),
      setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(100, v)) }),
      setSfxVolume: (v) => set({ sfxVolume: Math.max(0, Math.min(100, v)) }),
      setMusicVolume: (v) => set({ musicVolume: Math.max(0, Math.min(100, v)) }),
      setMusicEnabled: (v) => set({ musicEnabled: v }),
      setMouseSensitivity: (v) => set({ mouseSensitivity: Math.max(0.1, Math.min(3.0, v)) }),
      setShowFps: (v) => set({ showFps: v }),
      setShowPing: (v) => set({ showPing: v }),
    }),
    {
      name: 'lineremain-settings',
    },
  ),
);
