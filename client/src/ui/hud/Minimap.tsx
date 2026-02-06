// ─── Minimap ───

import React from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/hud.css';

export const Minimap: React.FC = () => {
  const position = usePlayerStore((s) => s.position);

  return (
    <div className="minimap">
      <span className="minimap__label">MAP</span>
      <span className="minimap__coords">
        {Math.round(position.x)}, {Math.round(position.y)}, {Math.round(position.z)}
      </span>
    </div>
  );
};