// ─── Achievement Store ───
// Client-side state for achievements, progression, customization, and tutorial.

import type { AchievementDefinition } from '@shared/constants/achievements';
import { ACHIEVEMENT_LIST } from '@shared/constants/achievements';
import { getStarColor, levelFromXP, xpProgressInLevel } from '@shared/constants/progression';
import type { PlayerCustomization, TutorialStep } from '@shared/types/customization';
import { DEFAULT_CUSTOMIZATION } from '@shared/types/customization';
import { create } from 'zustand';

// ─── Types ───

export interface AchievementToastData {
  id: string;
  achievement: AchievementDefinition;
  timestamp: number;
}

export interface LevelUpData {
  newLevel: number;
  timestamp: number;
}

interface AchievementState {
  // Achievements
  unlockedIds: Set<string>;
  toasts: AchievementToastData[];

  // Progression
  xp: number;
  level: number;
  starColor: string;
  xpProgress: number; // 0-1 within current level
  levelUpNotification: LevelUpData | null;

  // Customization
  customization: PlayerCustomization;
  hasChosenBodyType: boolean;

  // Tutorial
  tutorialStep: TutorialStep | null;
  tutorialComplete: boolean;

  // Actions
  unlockAchievement: (achievementId: string) => void;
  dismissToast: (id: string) => void;
  setXP: (xp: number) => void;
  addXP: (amount: number, reason: string) => void;
  setLevel: (level: number) => void;
  dismissLevelUp: () => void;
  setCustomization: (customization: PlayerCustomization) => void;
  setHasChosenBodyType: (val: boolean) => void;
  setTutorialStep: (step: TutorialStep | null) => void;
  completeTutorial: () => void;
}

// ─── Store ───

export const useAchievementStore = create<AchievementState>((set, get) => ({
  // Achievements
  unlockedIds: new Set<string>(),
  toasts: [],

  // Progression
  xp: 0,
  level: 1,
  starColor: getStarColor(1),
  xpProgress: 0,
  levelUpNotification: null,

  // Customization
  customization: { ...DEFAULT_CUSTOMIZATION },
  hasChosenBodyType: false,

  // Tutorial
  tutorialStep: 'move' as TutorialStep,
  tutorialComplete: false,

  // Actions
  unlockAchievement: (achievementId: string) => {
    const state = get();
    if (state.unlockedIds.has(achievementId)) return;

    const achievement = ACHIEVEMENT_LIST.find((a) => a.id === achievementId);
    if (!achievement) return;

    const toast: AchievementToastData = {
      id: `${achievementId}-${Date.now()}`,
      achievement,
      timestamp: Date.now(),
    };

    set((s) => ({
      unlockedIds: new Set([...s.unlockedIds, achievementId]),
      toasts: [...s.toasts, toast],
    }));

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      get().dismissToast(toast.id);
    }, 5000);
  },

  dismissToast: (id: string) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),

  setXP: (xp: number) => {
    const level = levelFromXP(xp);
    set({
      xp,
      level,
      starColor: getStarColor(level),
      xpProgress: xpProgressInLevel(xp),
    });
  },

  addXP: (amount: number, _reason: string) => {
    const state = get();
    const newXP = state.xp + amount;
    const newLevel = levelFromXP(newXP);

    set({
      xp: newXP,
      level: newLevel,
      starColor: getStarColor(newLevel),
      xpProgress: xpProgressInLevel(newXP),
    });
  },

  setLevel: (level: number) => {
    set({
      level,
      starColor: getStarColor(level),
      levelUpNotification: {
        newLevel: level,
        timestamp: Date.now(),
      },
    });

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      get().dismissLevelUp();
    }, 4000);
  },

  dismissLevelUp: () => set({ levelUpNotification: null }),

  setCustomization: (customization: PlayerCustomization) => set({ customization }),

  setHasChosenBodyType: (val: boolean) => set({ hasChosenBodyType: val }),

  setTutorialStep: (step: TutorialStep | null) =>
    set({
      tutorialStep: step,
      tutorialComplete: step === 'complete' || step === null,
    }),

  completeTutorial: () =>
    set({
      tutorialStep: null,
      tutorialComplete: true,
    }),
}));