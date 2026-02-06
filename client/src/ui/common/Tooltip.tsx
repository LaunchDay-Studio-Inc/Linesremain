// ─── Tooltip Component ───

import React, { useState, useCallback } from 'react';
import { ITEM_REGISTRY } from '@shared/constants/items';
import type { ItemStack } from '@shared/types/items';
import '../../styles/panels.css';

interface TooltipProps {
  item: ItemStack | null;
  x: number;
  y: number;
  visible: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ item, x, y, visible }) => {
  if (!visible || !item) return null;

  const def = ITEM_REGISTRY[item.itemId];
  if (!def) return null;

  // Keep tooltip on screen
  const left = Math.min(x + 12, window.innerWidth - 270);
  const top = Math.min(y + 12, window.innerHeight - 200);

  return (
    <div className="tooltip" style={{ left, top }}>
      <div className="tooltip__name">{def.name}</div>
      <div className="tooltip__desc">{def.description}</div>
      {def.damage != null && (
        <div className="tooltip__stat">
          <span className="tooltip__stat-key">Damage</span>
          <span className="tooltip__stat-value">{def.damage}</span>
        </div>
      )}
      {def.armorReduction != null && (
        <div className="tooltip__stat">
          <span className="tooltip__stat-key">Armor</span>
          <span className="tooltip__stat-value">{def.armorReduction}</span>
        </div>
      )}
      {def.durability != null && item.durability != null && (
        <div className="tooltip__stat">
          <span className="tooltip__stat-key">Durability</span>
          <span className="tooltip__stat-value">{item.durability}/{def.durability}</span>
        </div>
      )}
      {def.healAmount != null && (
        <div className="tooltip__stat">
          <span className="tooltip__stat-key">Heals</span>
          <span className="tooltip__stat-value">+{def.healAmount} HP</span>
        </div>
      )}
      {def.hungerRestore != null && def.hungerRestore > 0 && (
        <div className="tooltip__stat">
          <span className="tooltip__stat-key">Hunger</span>
          <span className="tooltip__stat-value">+{def.hungerRestore}</span>
        </div>
      )}
      {def.thirstRestore != null && def.thirstRestore > 0 && (
        <div className="tooltip__stat">
          <span className="tooltip__stat-key">Thirst</span>
          <span className="tooltip__stat-value">+{def.thirstRestore}</span>
        </div>
      )}
      {item.quantity > 1 && (
        <div className="tooltip__stat">
          <span className="tooltip__stat-key">Quantity</span>
          <span className="tooltip__stat-value">{item.quantity}</span>
        </div>
      )}
    </div>
  );
};

// ─── Hook: useTooltip ───

export function useTooltip() {
  const [tooltipState, setTooltipState] = useState<{
    item: ItemStack | null;
    x: number;
    y: number;
    visible: boolean;
  }>({ item: null, x: 0, y: 0, visible: false });

  const showTooltip = useCallback((item: ItemStack, x: number, y: number) => {
    setTooltipState({ item, x, y, visible: true });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltipState((s) => ({ ...s, visible: false }));
  }, []);

  const moveTooltip = useCallback((x: number, y: number) => {
    setTooltipState((s) => ({ ...s, x, y }));
  }, []);

  return { tooltipState, showTooltip, hideTooltip, moveTooltip };
}