// ─── Hotbar ───

import { HOTBAR_SLOTS } from '@shared/constants/game';
import { ITEM_REGISTRY } from '@shared/constants/items';
import React, { useEffect } from 'react';
import { useChatStore } from '../../stores/useChatStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/hud.css';
import { getItemIconName } from '../../utils/itemIcons';
import { GameIcon } from '../common/GameIcon';
import { Tooltip, useTooltip } from '../common/Tooltip';

export const Hotbar: React.FC = () => {
  const inventory = usePlayerStore((s) => s.inventory);
  const hotbarIndex = usePlayerStore((s) => s.hotbarIndex);
  const setHotbarIndex = usePlayerStore((s) => s.setHotbarIndex);
  const { tooltipState, showTooltip, hideTooltip, moveTooltip } = useTooltip();

  // Keyboard shortcuts 1-6
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't process hotbar keys when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Don't process when chat is open
      if (useChatStore.getState().isOpen) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= HOTBAR_SLOTS) {
        setHotbarIndex(num - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setHotbarIndex]);

  // Hotbar slots are the first HOTBAR_SLOTS items in inventory
  const hotbarItems = inventory.slice(0, HOTBAR_SLOTS);

  return (
    <>
      <div className="hotbar">
        {hotbarItems.map((item, i) => {
          const def = item ? ITEM_REGISTRY[item.itemId] : undefined;

          return (
            <div
              key={i}
              className={`hotbar__slot${i === hotbarIndex ? ' hotbar__slot--active' : ''}`}
              onClick={() => setHotbarIndex(i)}
              onMouseEnter={(e) => {
                if (item) showTooltip(item, e.clientX, e.clientY);
              }}
              onMouseMove={(e) => moveTooltip(e.clientX, e.clientY)}
              onMouseLeave={hideTooltip}
            >
              <span className="hotbar__slot-key">{i + 1}</span>
              {item && (
                <>
                  <span className="hotbar__slot-icon">
                    <GameIcon name={getItemIconName(item.itemId, def?.category)} size={20} />
                  </span>
                  {item.quantity > 1 && <span className="hotbar__slot-qty">{item.quantity}</span>}
                </>
              )}
            </div>
          );
        })}
      </div>
      <Tooltip {...tooltipState} />
    </>
  );
};
