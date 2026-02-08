// ─── Player Customization Types ───

// ─── Body Type System ───

export type BodyType =
  | 'striker'
  | 'guardian'
  | 'phantom'
  | 'ember'
  | 'titan'
  | 'wraith'
  | 'sage'
  | 'forge'
  | 'drift'
  | 'apex'
  | 'spark'
  | 'shade'
  | 'iron'
  | 'echo';

export const BODY_TYPES: BodyType[] = [
  'striker',
  'guardian',
  'phantom',
  'ember',
  'titan',
  'wraith',
  'sage',
  'forge',
  'drift',
  'apex',
  'spark',
  'shade',
  'iron',
  'echo',
];

export interface BodyTypeDefinition {
  type: BodyType;
  displayName: string;
  description: string;
  headRadius: number;
  bodyLength: number;
  armLength: number;
  legLength: number;
  lineWidth: number;
  shoulderWidth: number;
  hipWidth: number;
  hasOutline: boolean;
  headShape: 'circle' | 'oval' | 'angular' | 'square';
  accentLine: boolean;
}

export const BODY_TYPE_DEFINITIONS: Record<BodyType, BodyTypeDefinition> = {
  striker: {
    type: 'striker',
    displayName: 'Striker',
    description: 'Balanced and versatile. A natural survivor.',
    headRadius: 6,
    bodyLength: 16,
    armLength: 12,
    legLength: 14,
    lineWidth: 3,
    shoulderWidth: 3,
    hipWidth: 0,
    hasOutline: true,
    headShape: 'circle',
    accentLine: false,
  },
  guardian: {
    type: 'guardian',
    displayName: 'Guardian',
    description: 'Built to protect. Wide stance, unshakable.',
    headRadius: 6.5,
    bodyLength: 15,
    armLength: 13,
    legLength: 13,
    lineWidth: 3.5,
    shoulderWidth: 6,
    hipWidth: 2,
    hasOutline: true,
    headShape: 'square',
    accentLine: true,
  },
  phantom: {
    type: 'phantom',
    displayName: 'Phantom',
    description: 'Tall and elusive. Moves like a shadow.',
    headRadius: 5.5,
    bodyLength: 19,
    armLength: 14,
    legLength: 16,
    lineWidth: 2.5,
    shoulderWidth: 2,
    hipWidth: 0,
    hasOutline: false,
    headShape: 'oval',
    accentLine: true,
  },
  ember: {
    type: 'ember',
    displayName: 'Ember',
    description: 'Quick and fierce. Small but dangerous.',
    headRadius: 5.5,
    bodyLength: 13,
    armLength: 10,
    legLength: 12,
    lineWidth: 2.5,
    shoulderWidth: 2,
    hipWidth: 1,
    hasOutline: true,
    headShape: 'circle',
    accentLine: false,
  },
  titan: {
    type: 'titan',
    displayName: 'Titan',
    description: 'Towering presence. The wasteland trembles.',
    headRadius: 7,
    bodyLength: 17,
    armLength: 14,
    legLength: 14,
    lineWidth: 4,
    shoulderWidth: 7,
    hipWidth: 4,
    hasOutline: true,
    headShape: 'square',
    accentLine: true,
  },
  wraith: {
    type: 'wraith',
    displayName: 'Wraith',
    description: 'Sharp and angular. Cuts through the wind.',
    headRadius: 5,
    bodyLength: 18,
    armLength: 13,
    legLength: 15,
    lineWidth: 2,
    shoulderWidth: 1,
    hipWidth: 0,
    hasOutline: false,
    headShape: 'angular',
    accentLine: true,
  },
  sage: {
    type: 'sage',
    displayName: 'Sage',
    description: 'Wise proportions. Endures with grace.',
    headRadius: 6,
    bodyLength: 16,
    armLength: 12,
    legLength: 14,
    lineWidth: 3,
    shoulderWidth: 3,
    hipWidth: 2,
    hasOutline: true,
    headShape: 'oval',
    accentLine: false,
  },
  forge: {
    type: 'forge',
    displayName: 'Forge',
    description: 'Compact powerhouse. Built for crafting and combat.',
    headRadius: 6.5,
    bodyLength: 14,
    armLength: 11,
    legLength: 12,
    lineWidth: 4,
    shoulderWidth: 5,
    hipWidth: 3,
    hasOutline: true,
    headShape: 'square',
    accentLine: true,
  },
  drift: {
    type: 'drift',
    displayName: 'Drift',
    description: 'Fluid and graceful. Every move is art.',
    headRadius: 5.5,
    bodyLength: 17,
    armLength: 13,
    legLength: 15,
    lineWidth: 2.5,
    shoulderWidth: 2,
    hipWidth: 2,
    hasOutline: false,
    headShape: 'oval',
    accentLine: false,
  },
  apex: {
    type: 'apex',
    displayName: 'Apex',
    description: 'Commanding stature. Born to lead.',
    headRadius: 6.5,
    bodyLength: 18,
    armLength: 14,
    legLength: 15,
    lineWidth: 3.5,
    shoulderWidth: 5,
    hipWidth: 1,
    hasOutline: true,
    headShape: 'circle',
    accentLine: true,
  },
  spark: {
    type: 'spark',
    displayName: 'Spark',
    description: 'Small, round, and full of energy.',
    headRadius: 7,
    bodyLength: 12,
    armLength: 10,
    legLength: 11,
    lineWidth: 3,
    shoulderWidth: 2,
    hipWidth: 2,
    hasOutline: true,
    headShape: 'circle',
    accentLine: false,
  },
  shade: {
    type: 'shade',
    displayName: 'Shade',
    description: 'Mysterious silhouette. Hard to read, harder to catch.',
    headRadius: 6,
    bodyLength: 16,
    armLength: 12,
    legLength: 14,
    lineWidth: 3,
    shoulderWidth: 3,
    hipWidth: 1,
    hasOutline: false,
    headShape: 'angular',
    accentLine: true,
  },
  iron: {
    type: 'iron',
    displayName: 'Iron',
    description: 'Heavy and armored. A walking fortress.',
    headRadius: 7,
    bodyLength: 15,
    armLength: 12,
    legLength: 13,
    lineWidth: 4.5,
    shoulderWidth: 7,
    hipWidth: 5,
    hasOutline: true,
    headShape: 'square',
    accentLine: true,
  },
  echo: {
    type: 'echo',
    displayName: 'Echo',
    description: 'Sleek and minimal. Pure efficiency.',
    headRadius: 5,
    bodyLength: 17,
    armLength: 12,
    legLength: 15,
    lineWidth: 2,
    shoulderWidth: 1,
    hipWidth: 0,
    hasOutline: false,
    headShape: 'oval',
    accentLine: false,
  },
};

export interface PlayerCustomization {
  bodyColor: string; // hex color
  bodyType: BodyType;
  accessory: string | null; // 'bandana' | 'cap' | 'helmet' | 'crown' | 'horns' | null
  trail: string | null; // 'dust' | 'sparkles' | 'fire' | null
  deathEffect: string | null; // 'skull' | 'explosion' | 'fade_gold' | null
  title: string | null; // 'title_newcomer' | 'title_survivor' | etc.
}

export const DEFAULT_CUSTOMIZATION: PlayerCustomization = {
  bodyColor: '#ffffff',
  bodyType: 'striker',
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
