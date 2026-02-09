// ─── Gather Progress ───

import React from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/hud.css';

export const GatherProgress: React.FC = () => {
  const gatherProgress = usePlayerStore((s) => s.gatherProgress);

  if (gatherProgress <= 0) return null;

  return (
    <div className="gather-bar">
      <div className="gather-bar__fill" style={{ width: `${gatherProgress * 100}%` }} />
    </div>
  );
};
