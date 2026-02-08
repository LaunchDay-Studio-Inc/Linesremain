// ─── Customization Panel ───
// Player customization with live preview: body color, accessories, trails, death effects.

import type { LevelReward } from '@shared/constants/progression';
import { LEVEL_REWARDS } from '@shared/constants/progression';
import type { PlayerCustomization } from '@shared/types/customization';
import { BODY_TYPES, BODY_TYPE_DEFINITIONS, FREE_COLORS } from '@shared/types/customization';
import { ClientMessage } from '@shared/types/network';
import React, { useCallback, useMemo, useState } from 'react';
import { socketClient } from '../../network/SocketClient';
import { useAchievementStore } from '../../stores/useAchievementStore';
import { useUIStore } from '../../stores/useUIStore';
import '../../styles/panels.css';
import '../../styles/progression.css';

export const CustomizationPanel: React.FC = () => {
  const isOpen = useUIStore((s) => s.customizationOpen);
  const toggle = useUIStore((s) => s.toggleCustomization);
  const customization = useAchievementStore((s) => s.customization);
  const level = useAchievementStore((s) => s.level);
  const setCustomization = useAchievementStore((s) => s.setCustomization);

  const [draft, setDraft] = useState<PlayerCustomization>({ ...customization });

  // Get unlocked rewards based on level
  const unlockedRewards = useMemo(() => LEVEL_REWARDS.filter((r) => r.level <= level), [level]);

  const getRewardsByType = useCallback(
    (type: LevelReward['type']) => unlockedRewards.filter((r) => r.type === type),
    [unlockedRewards],
  );

  const applyCustomization = useCallback(() => {
    setCustomization(draft);
    socketClient.emit(ClientMessage.Customize, {
      bodyColor: draft.bodyColor,
      bodyType: draft.bodyType,
      accessory: draft.accessory,
      trail: draft.trail,
      deathEffect: draft.deathEffect,
      title: draft.title,
    });
  }, [draft, setCustomization]);

  if (!isOpen) return null;

  const colorRewards = getRewardsByType('body_color');
  const accessoryRewards = getRewardsByType('accessory');
  const trailRewards = getRewardsByType('trail');
  const deathEffectRewards = getRewardsByType('death_effect');
  const titleRewards = getRewardsByType('title');

  return (
    <div className="panel-backdrop" onClick={toggle}>
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 480 }}>
        <div className="panel__header">
          <span className="panel__title">Customize</span>
          <button className="panel__close" onClick={toggle}>
            X
          </button>
        </div>

        {/* Body Type */}
        <div className="custom-section">
          <div className="custom-section__title">Body Type</div>
          <div
            className="custom-option-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}
          >
            {BODY_TYPES.map((type) => {
              const def = BODY_TYPE_DEFINITIONS[type];
              return (
                <button
                  key={type}
                  className={`custom-option ${draft.bodyType === type ? 'custom-option--selected' : ''}`}
                  onClick={() => setDraft({ ...draft, bodyType: type })}
                  title={def.description}
                  style={{ padding: '6px 4px', fontSize: '10px' }}
                >
                  {def.displayName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body Color */}
        <div className="custom-section">
          <div className="custom-section__title">Body Color</div>
          <div className="custom-color-grid">
            {FREE_COLORS.map((color) => (
              <button
                key={color}
                className={`custom-color-swatch ${draft.bodyColor === color ? 'custom-color-swatch--selected' : ''}`}
                style={{ background: color }}
                onClick={() => setDraft({ ...draft, bodyColor: color })}
              />
            ))}
            {colorRewards.map((r) => (
              <button
                key={r.value}
                className={`custom-color-swatch ${draft.bodyColor === r.value ? 'custom-color-swatch--selected' : ''}`}
                style={{ background: r.value }}
                title={`${r.name} (Level ${r.level})`}
                onClick={() => setDraft({ ...draft, bodyColor: r.value })}
              />
            ))}
          </div>
        </div>

        {/* Accessory */}
        <div className="custom-section">
          <div className="custom-section__title">Accessory</div>
          <div className="custom-option-grid">
            <button
              className={`custom-option ${draft.accessory === 'none' ? 'custom-option--selected' : ''}`}
              onClick={() => setDraft({ ...draft, accessory: 'none' })}
            >
              None
            </button>
            {accessoryRewards.map((r) => (
              <button
                key={r.value}
                className={`custom-option ${draft.accessory === r.value ? 'custom-option--selected' : ''}`}
                onClick={() => setDraft({ ...draft, accessory: r.value })}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Trail */}
        <div className="custom-section">
          <div className="custom-section__title">Trail</div>
          <div className="custom-option-grid">
            <button
              className={`custom-option ${draft.trail === 'none' ? 'custom-option--selected' : ''}`}
              onClick={() => setDraft({ ...draft, trail: 'none' })}
            >
              None
            </button>
            {trailRewards.map((r) => (
              <button
                key={r.value}
                className={`custom-option ${draft.trail === r.value ? 'custom-option--selected' : ''}`}
                onClick={() => setDraft({ ...draft, trail: r.value })}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Death Effect */}
        <div className="custom-section">
          <div className="custom-section__title">Death Effect</div>
          <div className="custom-option-grid">
            <button
              className={`custom-option ${draft.deathEffect === 'none' ? 'custom-option--selected' : ''}`}
              onClick={() => setDraft({ ...draft, deathEffect: 'none' })}
            >
              None
            </button>
            {deathEffectRewards.map((r) => (
              <button
                key={r.value}
                className={`custom-option ${draft.deathEffect === r.value ? 'custom-option--selected' : ''}`}
                onClick={() => setDraft({ ...draft, deathEffect: r.value })}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="custom-section">
          <div className="custom-section__title">Title</div>
          <div className="custom-option-grid">
            <button
              className={`custom-option ${draft.title === 'none' ? 'custom-option--selected' : ''}`}
              onClick={() => setDraft({ ...draft, title: 'none' })}
            >
              None
            </button>
            {titleRewards.map((r) => (
              <button
                key={r.value}
                className={`custom-option ${draft.title === r.value ? 'custom-option--selected' : ''}`}
                onClick={() => setDraft({ ...draft, title: r.value })}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Apply button */}
        <button className="craft-btn" onClick={applyCustomization}>
          Apply Changes
        </button>
      </div>
    </div>
  );
};
