// ─── Player Customization Types ───

export interface PlayerCustomization {
  bodyColor: string; // hex color
  accessory: string | null; // 'bandana' | 'cap' | 'helmet' | 'crown' | 'horns' | null
  trail: string | null; // 'dust' | 'sparkles' | 'fire' | null
  deathEffect: string | null; // 'skull' | 'explosion' | 'fade_gold' | null
  title: string | null; // 'title_newcomer' | 'title_survivor' | etc.
}

export const DEFAULT_CUSTOMIZATION: PlayerCustomization = {
  bodyColor: '#ffffff',
  accessory: null,
  trail: null,
  deathEffect: null,
  title: null,
};

/** Colors available to all players without level requirements */
export const FREE_COLORS: string[] = [
  '#ffffff', // White (default)
  '#666666', // Gray
  '#8B4513', // Brown
  '#556B2F', // Olive
  '#4682B4', // Steel Blue
  '#8B0000', // Dark Red
  '#2F4F4F', // Dark Slate
  '#DAA520', // Goldenrod
];

/** Tutorial step progression */
export type TutorialStep = 'move' | 'gather' | 'craft' | 'build' | 'complete';

export const TUTORIAL_STEPS: TutorialStep[] = ['move', 'gather', 'craft', 'build', 'complete'];

export const TUTORIAL_HINTS: Record<TutorialStep, { title: string; hint: string; key?: string }> = {
  move: {
    title: 'Movement',
    hint: 'Use WASD to move and mouse to look around.',
    key: 'WASD',
  },
  gather: {
    title: 'Gathering',
    hint: 'Hit a tree or rock with left click to gather resources.',
    key: 'LMB',
  },
  craft: {
    title: 'Crafting',
    hint: 'Press C to open crafting and make your first tool.',
    key: 'C',
  },
  build: {
    title: 'Building',
    hint: 'Press B to enter building mode and place a foundation.',
    key: 'B',
  },
  complete: {
    title: 'Ready',
    hint: 'Tutorial complete! The wasteland awaits.',
  },
};
