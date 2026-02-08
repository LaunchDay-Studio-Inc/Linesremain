import type { BattlePassTier } from '../types/monetization.js';

// Battle Pass: 20 tiers per season (7-day wipe cycle)
// Free track: basic rewards at tiers 5, 10, 15, 20
// Premium track ($4.99): rewards at every tier
// CRITICAL: NO gameplay advantages. Only visual cosmetics.

export const BATTLE_PASS_PRICE_CENTS = 499;

export const BATTLE_PASS_TIERS: BattlePassTier[] = [
  {
    tier: 1,
    freeReward: null,
    premiumReward: { type: 'skin', id: 'arctic_blue' },
    xpRequired: 200,
  },
  {
    tier: 2,
    freeReward: null,
    premiumReward: { type: 'badge', id: 'season_star' },
    xpRequired: 400,
  },
  {
    tier: 3,
    freeReward: null,
    premiumReward: { type: 'skin', id: 'forest_green' },
    xpRequired: 600,
  },
  {
    tier: 4,
    freeReward: null,
    premiumReward: { type: 'accessory', id: 'aviators' },
    xpRequired: 800,
  },
  {
    tier: 5,
    freeReward: { type: 'skin', id: 'sand' },
    premiumReward: { type: 'trail', id: 'dust' },
    xpRequired: 1000,
  },
  { tier: 6, freeReward: null, premiumReward: { type: 'skin', id: 'crimson' }, xpRequired: 1300 },
  { tier: 7, freeReward: null, premiumReward: { type: 'badge', id: 'warrior' }, xpRequired: 1600 },
  {
    tier: 8,
    freeReward: null,
    premiumReward: { type: 'accessory', id: 'bandana' },
    xpRequired: 2000,
  },
  { tier: 9, freeReward: null, premiumReward: { type: 'trail', id: 'embers' }, xpRequired: 2400 },
  {
    tier: 10,
    freeReward: { type: 'badge', id: 'veteran' },
    premiumReward: { type: 'skin', id: 'midnight_purple' },
    xpRequired: 3000,
  },
  {
    tier: 11,
    freeReward: null,
    premiumReward: { type: 'death_effect', id: 'smoke_puff' },
    xpRequired: 3600,
  },
  {
    tier: 12,
    freeReward: null,
    premiumReward: { type: 'skin', id: 'toxic_green' },
    xpRequired: 4200,
  },
  {
    tier: 13,
    freeReward: null,
    premiumReward: { type: 'accessory', id: 'eyepatch' },
    xpRequired: 4800,
  },
  { tier: 14, freeReward: null, premiumReward: { type: 'trail', id: 'frost' }, xpRequired: 5500 },
  {
    tier: 15,
    freeReward: { type: 'accessory', id: 'shades' },
    premiumReward: { type: 'skin', id: 'ocean_blue' },
    xpRequired: 6200,
  },
  { tier: 16, freeReward: null, premiumReward: { type: 'badge', id: 'elite' }, xpRequired: 7000 },
  {
    tier: 17,
    freeReward: null,
    premiumReward: { type: 'death_effect', id: 'shatter' },
    xpRequired: 7800,
  },
  { tier: 18, freeReward: null, premiumReward: { type: 'skin', id: 'chrome' }, xpRequired: 8600 },
  {
    tier: 19,
    freeReward: null,
    premiumReward: { type: 'trail', id: 'lightning' },
    xpRequired: 9300,
  },
  {
    tier: 20,
    freeReward: { type: 'badge', id: 'completionist' },
    premiumReward: { type: 'skin', id: 'legendary_gold', death: 'explosion_gold' },
    xpRequired: 10000,
  },
];

export const NOTIFICATION_STYLES: Record<string, { bg: string; border: string }> = {
  info: { bg: 'rgba(74, 144, 217, 0.9)', border: '#4A90D9' },
  warning: { bg: 'rgba(243, 156, 18, 0.9)', border: '#F39C12' },
  danger: { bg: 'rgba(231, 76, 60, 0.9)', border: '#E74C3C' },
  success: { bg: 'rgba(46, 204, 113, 0.9)', border: '#2ECC71' },
  achievement: { bg: 'rgba(240, 165, 0, 0.95)', border: '#F0A500' },
  loot: { bg: 'rgba(155, 89, 182, 0.9)', border: '#9B59B6' },
};

export const LOADING_TIPS = [
  "Place a sleeping bag before exploring — it's your respawn point.",
  'Stone tools are 2x faster than bare hands.',
  'Tool cupboards prevent building decay in a 32-block radius.',
  'Night creatures are stronger during blood moons.',
  "Monuments contain the best loot — but they're guarded.",
  'You can research found items at a Research Table to learn their blueprints.',
  'Your buildings decay without a tool cupboard. Keep it stocked!',
  'Campfires provide warmth, light, and can cook raw meat.',
  'Listen for footsteps — other players might be nearby.',
  'Every line you draw may be your last. Build wisely.',
  'Craft a workbench to unlock advanced recipes.',
  'Different biomes have unique resources and dangers.',
  "Armor reduces incoming damage — don't forget to equip it.",
  'You can lock doors with code locks to protect your base.',
  'C4 explosives can breach enemy walls — raid smart.',
];

// Default store items (seed data)
export const DEFAULT_STORE_ITEMS = [
  {
    id: 'skin_arctic_blue',
    name: 'Arctic Blue',
    description: 'A cool blue stickman skin',
    category: 'skin' as const,
    priceCents: 199,
    previewData: { bodyColor: '#4A90D9' },
  },
  {
    id: 'skin_crimson',
    name: 'Crimson',
    description: 'Blood red warrior skin',
    category: 'skin' as const,
    priceCents: 199,
    previewData: { bodyColor: '#C0392B' },
  },
  {
    id: 'skin_forest',
    name: 'Forest',
    description: 'Blend into the trees',
    category: 'skin' as const,
    priceCents: 199,
    previewData: { bodyColor: '#27AE60' },
  },
  {
    id: 'skin_chrome',
    name: 'Chrome',
    description: 'Sleek metallic finish',
    category: 'skin' as const,
    priceCents: 299,
    previewData: { bodyColor: '#BDC3C7' },
  },
  {
    id: 'skin_legendary_gold',
    name: 'Legendary Gold',
    description: 'The ultimate status symbol',
    category: 'skin' as const,
    priceCents: 499,
    previewData: { bodyColor: '#F0A500' },
  },
  {
    id: 'trail_dust',
    name: 'Dust Trail',
    description: 'Leave dust in your wake',
    category: 'trail' as const,
    priceCents: 149,
    previewData: { trail: 'dust' },
  },
  {
    id: 'trail_embers',
    name: 'Ember Trail',
    description: 'Burning footsteps',
    category: 'trail' as const,
    priceCents: 249,
    previewData: { trail: 'embers' },
  },
  {
    id: 'trail_frost',
    name: 'Frost Trail',
    description: 'Leave ice in your wake',
    category: 'trail' as const,
    priceCents: 249,
    previewData: { trail: 'frost' },
  },
  {
    id: 'death_smoke',
    name: 'Smoke Puff',
    description: 'Vanish in a puff of smoke',
    category: 'death_effect' as const,
    priceCents: 199,
    previewData: { deathEffect: 'smoke_puff' },
  },
  {
    id: 'death_shatter',
    name: 'Shatter',
    description: 'Break into pieces',
    category: 'death_effect' as const,
    priceCents: 299,
    previewData: { deathEffect: 'shatter' },
  },
  {
    id: 'acc_aviators',
    name: 'Aviator Shades',
    description: 'Cool shades for a cool survivor',
    category: 'accessory' as const,
    priceCents: 149,
    previewData: { accessory: 'aviators' },
  },
  {
    id: 'acc_bandana',
    name: 'Bandana',
    description: 'Look tough',
    category: 'accessory' as const,
    priceCents: 149,
    previewData: { accessory: 'bandana' },
  },
];
