// ─── Level Up Notification ───
// Full-screen level up celebration overlay.

import { getStarColor } from '@shared/constants/progression';
import React from 'react';
import { useAchievementStore } from '../../stores/useAchievementStore';
import '../../styles/progression.css';

export const LevelUpNotification: React.FC = () => {
  const notification = useAchievementStore((s) => s.levelUpNotification);

  if (!notification) return null;

  const color = getStarColor(notification.newLevel);

  return (
    <div className="level-up-notification">
      <div className="level-up-notification__text">Level Up!</div>
      <div className="level-up-notification__level" style={{ color }}>
        {notification.newLevel}
      </div>
    </div>
  );
};
