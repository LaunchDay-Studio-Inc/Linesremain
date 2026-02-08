// ─── Achievement Panel ───
// Full achievement browser with category filtering and progress display.

import type { AchievementCategory } from '@shared/constants/achievements';
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_LIST } from '@shared/constants/achievements';
import React, { useState } from 'react';
import { useAchievementStore } from '../../stores/useAchievementStore';
import { useUIStore } from '../../stores/useUIStore';
import '../../styles/panels.css';
import '../../styles/progression.css';

export const AchievementPanel: React.FC = () => {
  const isOpen = useUIStore((s) => s.achievementsOpen);
  const toggle = useUIStore((s) => s.toggleAchievements);
  const unlockedIds = useAchievementStore((s) => s.unlockedIds);
  const level = useAchievementStore((s) => s.level);
  const xp = useAchievementStore((s) => s.xp);
  const xpProgress = useAchievementStore((s) => s.xpProgress);
  const starColor = useAchievementStore((s) => s.starColor);

  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');

  if (!isOpen) return null;

  const filteredAchievements =
    selectedCategory === 'all'
      ? ACHIEVEMENT_LIST
      : ACHIEVEMENT_LIST.filter((a) => a.category === selectedCategory);

  const totalUnlocked = unlockedIds.size;
  const totalAchievements = ACHIEVEMENT_LIST.filter((a) => !a.hidden).length;

  return (
    <div className="panel-backdrop" onClick={toggle}>
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 560 }}>
        <div className="panel__header">
          <span className="panel__title">Your Lines</span>
          <button className="panel__close" onClick={toggle}>
            X
          </button>
        </div>

        {/* XP / Level display */}
        <div className="ach-level-bar">
          <div className="ach-level-info">
            <span className="ach-level-star" style={{ color: starColor }}>
              *
            </span>
            <span className="ach-level-num">Level {level}</span>
            <span className="ach-level-xp">{xp} XP</span>
          </div>
          <div className="progress-bar" style={{ marginTop: 6 }}>
            <div
              className="progress-bar__fill"
              style={{ width: `${xpProgress * 100}%`, background: starColor }}
            />
          </div>
          <div className="ach-progress-text">
            {totalUnlocked} / {totalAchievements} achievements unlocked
          </div>
        </div>

        {/* Category tabs */}
        <div className="ach-category-tabs">
          <button
            className={`ach-tab ${selectedCategory === 'all' ? 'ach-tab--active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All
          </button>
          {ACHIEVEMENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`ach-tab ${selectedCategory === cat ? 'ach-tab--active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Achievement list */}
        <div className="ach-list">
          {filteredAchievements.map((ach) => {
            const isUnlocked = unlockedIds.has(ach.id);
            const isHidden = ach.hidden && !isUnlocked;

            return (
              <div
                key={ach.id}
                className={`ach-item ${isUnlocked ? 'ach-item--unlocked' : ''} ${isHidden ? 'ach-item--hidden' : ''}`}
              >
                <div className="ach-item__icon">{isHidden ? '?' : ach.icon}</div>
                <div className="ach-item__info">
                  <div className="ach-item__name">{isHidden ? '???' : ach.name}</div>
                  <div className="ach-item__desc">
                    {isHidden ? 'Hidden achievement' : ach.description}
                  </div>
                </div>
                <div className="ach-item__xp">{isUnlocked ? 'Unlocked' : `${ach.xpReward} XP`}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
