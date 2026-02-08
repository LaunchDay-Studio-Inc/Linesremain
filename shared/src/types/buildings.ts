// ─── Building Types ───

export enum BuildingPieceType {
  Foundation = 'Foundation',
  FoundationTriangle = 'FoundationTriangle',
  Wall = 'Wall',
  HalfWall = 'HalfWall',
  Doorway = 'Doorway',
  WindowFrame = 'WindowFrame',
  Floor = 'Floor',
  FloorTriangle = 'FloorTriangle',
  Stairs = 'Stairs',
  Roof = 'Roof',
  Door = 'Door',
  WallFrame = 'WallFrame',
  FloorGrill = 'FloorGrill',
  Fence = 'Fence',
  Pillar = 'Pillar',
  Campfire = 'Campfire',
}

export enum BuildingTier {
  Twig = 0,
  Wood = 1,
  Stone = 2,
  Metal = 3,
  Armored = 4,
}

export interface SnapPoint {
  position: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  compatibleTypes: BuildingPieceType[];
}

export interface UpgradeCost {
  itemId: number;
  quantity: number;
}

