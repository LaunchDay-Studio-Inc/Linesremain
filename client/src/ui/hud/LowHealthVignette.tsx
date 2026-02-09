// ─── Low Health Vignette ───
// Persistent, slowly pulsing red border overlay when health < 25%.

import React from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/hud.css';

export const LowHealthVignette: React.FC = () => {
  const isLow = usePlayerStore((s) => s.health < 25);

  if (!isLow) return null;

  return (
    <div className="low-health">
      <div className="low-health__overlay" />
    </div>
  );
};
