// ─── World Event Types ───

export enum WorldEventType {
  BloodMoon = 'blood_moon',
  SupplyDrop = 'supply_drop',
  Fog = 'fog',
}

export interface BiomeAtmosphereData {
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientTint: string;
  particleType: 'none' | 'snow' | 'dust' | 'fireflies' | 'blizzard' | 'ash' | 'spores';
  particleDensity: number; // 0-1
  mood: 'peaceful' | 'tense' | 'eerie' | 'melancholy';
}
