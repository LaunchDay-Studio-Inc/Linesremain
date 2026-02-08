// ─── Achievement Toast ───
// Displays achievement unlock notifications as animated toasts.

import React from 'react';
import { useAchievementStore } from '../../stores/useAchievementStore';
import '../../styles/progression.css';

export const AchievementToast: React.FC = () => {
  const toasts = useAchievementStore((s) => s.toasts);
  const dismissToast = useAchievementStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="achievement-toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="achievement-toast" onClick={() => dismissToast(toast.id)}>
          <div className="achievement-toast__icon">{toast.achievement.icon}</div>
          <div className="achievement-toast__content">
            <div className="achievement-toast__label">Achievement Unlocked</div>
            <div className="achievement-toast__name">{toast.achievement.name}</div>
            <div className="achievement-toast__desc">{toast.achievement.description}</div>
            <div className="achievement-toast__xp">+{toast.achievement.xpReward} XP</div>
          </div>
        </div>
      ))}
    </div>
  );
};
