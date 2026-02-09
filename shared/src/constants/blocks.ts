// ─── Block Registry ───

import type { BlockDefinition } from '../types/blocks.js';
import { BlockType } from '../types/blocks.js';

export const BLOCK_REGISTRY: Record<number, BlockDefinition> = {
  [BlockType.Air]: {
    id: BlockType.Air,
    name: 'Air',
    hardness: 0,
    transparent: true,
    textureAtlasPosition: { x: 0, y: 0 },
  },
  [BlockType.Dirt]: {
    id: BlockType.Dirt,
    name: 'Dirt',
    hardness: 2,
    toolRequired: 'shovel',
    dropItemId: undefined,
    dropQuantity: undefined,
    transparent: false,
    textureAtlasPosition: { x: 1, y: 0 },
  },
  [BlockType.Grass]: {
    id: BlockType.Grass,
    name: 'Grass',
    hardness: 2,
    toolRequired: 'shovel',
    transparent: false,
    textureAtlasPosition: { x: 2, y: 0 },
  },
  [BlockType.Stone]: {
    id: BlockType.Stone,
    name: 'Stone',
    hardness: 6,
    toolRequired: 'pickaxe',
    dropItemId: 2, // Stone resource
    dropQuantity: 3,
    transparent: false,
    textureAtlasPosition: { x: 3, y: 0 },
  },
  [BlockType.Sand]: {
    id: BlockType.Sand,
    name: 'Sand',
    hardness: 1.5,
    toolRequired: 'shovel',
    transparent: false,
    textureAtlasPosition: { x: 4, y: 0 },
  },
  [BlockType.Snow]: {
    id: BlockType.Snow,
    name: 'Snow',
    hardness: 1,
    toolRequired: 'shovel',
    transparent: false,
    textureAtlasPosition: { x: 5, y: 0 },
  },
  [BlockType.Log]: {
    id: BlockType.Log,
    name: 'Log',
    hardness: 4,
    toolRequired: 'axe',
    dropItemId: 1, // Wood resource
    dropQuantity: 5,
    transparent: false,
    textureAtlasPosition: { x: 6, y: 0 },
  },
  [BlockType.Leaves]: {
    id: BlockType.Leaves,
    name: 'Leaves',
    hardness: 0.5,
    dropItemId: 97, // Wild Berry
    dropQuantity: 1,
    transparent: true,
    textureAtlasPosition: { x: 7, y: 0 },
  },
  [BlockType.Planks]: {
    id: BlockType.Planks,
    name: 'Planks',
    hardness: 3,
    toolRequired: 'axe',
    dropItemId: 1, // Wood resource
    dropQuantity: 2,
    transparent: false,
    textureAtlasPosition: { x: 0, y: 1 },
  },
  [BlockType.Cobblestone]: {
    id: BlockType.Cobblestone,
    name: 'Cobblestone',
    hardness: 5,
    toolRequired: 'pickaxe',
    dropItemId: 2, // Stone resource
    dropQuantity: 2,
    transparent: false,
    textureAtlasPosition: { x: 1, y: 1 },
  },
  [BlockType.MetalOre]: {
    id: BlockType.MetalOre,
    name: 'Metal Ore',
    hardness: 8,
    toolRequired: 'pickaxe',
    dropItemId: 3, // Metal Ore resource
    dropQuantity: 2,
    transparent: false,
    textureAtlasPosition: { x: 2, y: 1 },
  },
  [BlockType.SulfurOre]: {
    id: BlockType.SulfurOre,
    name: 'Sulfur Ore',
    hardness: 8,
    toolRequired: 'pickaxe',
    dropItemId: 4, // Sulfur Ore resource
    dropQuantity: 2,
    transparent: false,
    textureAtlasPosition: { x: 3, y: 1 },
  },
  [BlockType.HQMOre]: {
    id: BlockType.HQMOre,
    name: 'HQM Ore',
    hardness: 12,
    toolRequired: 'pickaxe',
    dropItemId: 5, // HQM Ore resource
    dropQuantity: 1,
    transparent: false,
    textureAtlasPosition: { x: 4, y: 1 },
  },
  [BlockType.Bedrock]: {
    id: BlockType.Bedrock,
    name: 'Bedrock',
    hardness: -1, // unbreakable
    transparent: false,
    textureAtlasPosition: { x: 5, y: 1 },
  },
  [BlockType.Water]: {
    id: BlockType.Water,
    name: 'Water',
    hardness: -1,
    transparent: true,
    textureAtlasPosition: { x: 6, y: 1 },
  },
  [BlockType.Gravel]: {
    id: BlockType.Gravel,
    name: 'Gravel',
    hardness: 2,
    toolRequired: 'shovel',
    transparent: false,
    textureAtlasPosition: { x: 7, y: 1 },
  },
  [BlockType.Clay]: {
    id: BlockType.Clay,
    name: 'Clay',
    hardness: 2,
    toolRequired: 'shovel',
    transparent: false,
    textureAtlasPosition: { x: 0, y: 2 },
  },
  [BlockType.Cactus]: {
    id: BlockType.Cactus,
    name: 'Cactus',
    hardness: 1,
    dropItemId: 56, // Cactus Flesh (consumable)
    dropQuantity: 2,
    transparent: true,
    textureAtlasPosition: { x: 1, y: 2 },
  },
  [BlockType.DeadBush]: {
    id: BlockType.DeadBush,
    name: 'Dead Bush',
    hardness: 0.3,
    dropItemId: 1, // Wood
    dropQuantity: 1,
    transparent: true,
    textureAtlasPosition: { x: 2, y: 2 },
  },
  [BlockType.TallGrass]: {
    id: BlockType.TallGrass,
    name: 'Tall Grass',
    hardness: 0.2,
    dropItemId: 6, // Cloth
    dropQuantity: 1,
    transparent: true,
    textureAtlasPosition: { x: 3, y: 2 },
  },
  [BlockType.Mushroom]: {
    id: BlockType.Mushroom,
    name: 'Mushroom',
    hardness: 0.2,
    dropItemId: 55, // Mushroom consumable
    dropQuantity: 1,
    transparent: true,
    textureAtlasPosition: { x: 4, y: 2 },
  },
  [BlockType.Ice]: {
    id: BlockType.Ice,
    name: 'Ice',
    hardness: 3,
    toolRequired: 'pickaxe',
    transparent: true,
    textureAtlasPosition: { x: 5, y: 2 },
  },
  [BlockType.MossyStone]: {
    id: BlockType.MossyStone,
    name: 'Mossy Stone',
    hardness: 6,
    toolRequired: 'pickaxe',
    dropItemId: 2, // Stone resource
    dropQuantity: 3,
    transparent: false,
    textureAtlasPosition: { x: 6, y: 2 },
  },
};
