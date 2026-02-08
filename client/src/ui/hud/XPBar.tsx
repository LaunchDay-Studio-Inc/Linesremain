// ─── XP Bar ───
// Compact XP progress bar displayed above the hotbar.

import React from 'react';
import { useAchievementStore } from '../../stores/useAchievementStore';
import '../../styles/progression.css';

export const XPBar: React.FC = () => {
  const level = useAchievementStore((s) => s.level);
  const xp = useAchievementStore((s) => s.xp);
  const xpProgress = useAchievementStore((s) => s.xpProgress);
  const starColor = useAchievementStore((s) => s.starColor);

  return (
    <div className="xp-bar-container">
      <div className="xp-bar">
        <div
          className="xp-bar__fill"
          style={{ width: `${xpProgress * 100}%`, background: starColor }}
        />
      </div>
      <div className="xp-bar__label">
        <span className="xp-bar__level" style={{ color: starColor }}>
          Lv.{level}
        </span>
        <span className="xp-bar__xp">{xp} XP</span>
      </div>
    </div>
  );
};
