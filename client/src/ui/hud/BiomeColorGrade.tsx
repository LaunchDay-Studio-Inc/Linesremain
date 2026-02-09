// ─── Biome Color Grade ───
// Subtle full-screen CSS overlay that tints the view based on current biome.

import React, { useMemo } from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/hud.css';

const BIOME_TINTS: Record<string, string> = {
  Scorchlands: 'rgba(80, 60, 20, 0.04)',
  'Ashwood Forest': 'rgba(20, 60, 20, 0.03)',
  'Mire Hollows': 'rgba(30, 40, 20, 0.05)',
  'Drygrass Plains': 'rgba(80, 70, 40, 0.03)',
  Greenhollow: 'transparent',
  Mossreach: 'rgba(20, 50, 30, 0.03)',
  'Frostveil Peaks': 'rgba(40, 50, 80, 0.04)',
  'Snowmelt Woods': 'rgba(40, 50, 80, 0.03)',
  'Glacial Expanse': 'rgba(40, 50, 80, 0.04)',
};

export const BiomeColorGrade: React.FC = () => {
  const currentBiome = usePlayerStore((s) => s.currentBiome);

  const color = useMemo(() => BIOME_TINTS[currentBiome] ?? 'transparent', [currentBiome]);

  if (color === 'transparent') return null;

  return <div className="biome-grade" style={{ backgroundColor: color }} />;
};
