// ─── Narrative Constants ───
// Simple, grounded text for UI. No lore dumps — just flavor.

import type { BodyType } from '../types/customization.js';

// ─── Character Taglines ───
// One-liner shown on character select. Short, punchy, gameplay-relevant.

export const CHARACTER_TAGLINES: Record<BodyType, string> = {
  striker: 'Balanced all-rounder. Good at everything, great at nothing.',
  guardian: 'Slow and tough. Built to take hits and hold ground.',
  phantom: 'Tall and fast. Hard to hit, easy to kill.',
  ember: 'Small and quick. Gets in, does damage, gets out.',
  titan: 'Massive. Hits like a truck. Moves like one too.',
  wraith: 'Thin and angular. Fragile but deadly at range.',
  sage: 'Standard build. Crafts faster and learns quicker.',
  forge: 'Stocky powerhouse. Cheaper crafting, stronger tools.',
  drift: 'Born for water. Swims twice as fast, never drowns.',
  apex: 'Team leader. Buffs nearby allies, weaker alone.',
  spark: 'Tiny and bouncy. Jumps highest, finds loot easier.',
  shade: 'Night specialist. Sees in the dark, slow in sunlight.',
  iron: 'Walking fortress. Nearly immovable. Sinks in water.',
  echo: 'Support build. Heals allies faster, weak in melee.',
};

// ─── Character Playstyle Labels ───

export const CHARACTER_ROLES: Record<BodyType, string> = {
  striker: 'All-Rounder',
  guardian: 'Tank',
  phantom: 'Scout',
  ember: 'Melee DPS',
  titan: 'Brute',
  wraith: 'Ranged DPS',
  sage: 'Scholar',
  forge: 'Crafter',
  drift: 'Aquatic',
  apex: 'Commander',
  spark: 'Explorer',
  shade: 'Infiltrator',
  iron: 'Fortress',
  echo: 'Support',
};

// ─── Gameplay Tips ───

export const GAMEPLAY_TIPS: string[] = [
  'Hit trees for wood. Hit rocks for stone. Hit players for trouble.',
  'Build a base before nightfall. Seriously.',
  'Sleeping bags save your spawn point. Place one early.',
  'Crouch near a campfire to warm up at night.',
  'Tool Cupboards prevent your base from decaying.',
  'Lock your doors. Trust nobody.',
  'Night creatures are tougher but drop better loot.',
  'Teams share XP when they stick together.',
  'Higher-tier walls take more C4 to raid.',
  'Press C to craft. Press B to build. Press Tab for inventory.',
  'Stone tools break fast. Upgrade when you can.',
  'Food restores hunger. Water restores thirst. Obviously.',
  'If you die without a sleeping bag, you lose everything.',
  'The blood moon happens every few nights. Board up.',
  'You keep some blueprints across deaths. Knowledge persists.',
];
