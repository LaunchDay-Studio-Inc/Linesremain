// ─── Container Panel ───

import { HOTBAR_SLOTS, PLAYER_INVENTORY_SLOTS } from '@shared/constants/game';
import { ITEM_REGISTRY } from '@shared/constants/items';
import type { ItemStack } from '@shared/types/items';
import React from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/panels.css';
import { getItemIconName } from '../../utils/itemIcons';
import { GameIcon } from '../common/GameIcon';
import { Tooltip, useTooltip } from '../common/Tooltip';

interface ContainerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  containerName: string;
  containerSlots: (ItemStack | null)[];
  onTakeAll?: () => void;
}

export const ContainerPanel: React.FC<ContainerPanelProps> = ({
  isOpen,
  onClose,
  containerName,
  containerSlots,
  onTakeAll,
}) => {
  const inventory = usePlayerStore((s) => s.inventory);
  const { tooltipState, showTooltip, hideTooltip, moveTooltip } = useTooltip();

  if (!isOpen) return null;

  const playerSlots = inventory.slice(0, HOTBAR_SLOTS + PLAYER_INVENTORY_SLOTS);

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 640 }}>
        <div className="panel__header">
          <span className="panel__title">{containerName}</span>
          <button className="panel__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="container-layout">
          {/* Container Side */}
          <div className="container-section">
            <div className="container-section__title">{containerName}</div>
            <div className="inv-grid">
              {containerSlots.map((item, i) => {
                const def = item ? ITEM_REGISTRY[item.itemId] : undefined;

                return (
                  <div
                    key={`c-${i}`}
                    className="inv-slot"
                    onMouseEnter={(e) => {
                      if (item) showTooltip(item, e.clientX, e.clientY);
                    }}
                    onMouseMove={(e) => moveTooltip(e.clientX, e.clientY)}
                    onMouseLeave={hideTooltip}
                  >
                    {item && (
                      <>
                        <span className="inv-slot__icon">
                          <GameIcon name={getItemIconName(item.itemId, def?.category)} size={20} />
                        </span>
                        {item.quantity > 1 && (
                          <span className="inv-slot__qty">{item.quantity}</span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {onTakeAll && (
              <button className="container-take-all" onClick={onTakeAll}>
                Take All
              </button>
            )}
          </div>

          {/* Player Inventory Side */}
          <div className="container-section">
            <div className="container-section__title">Your Inventory</div>
            <div className="inv-grid">
              {playerSlots.map((item, i) => {
                const def = item ? ITEM_REGISTRY[item.itemId] : undefined;

                return (
                  <div
                    key={`p-${i}`}
                    className="inv-slot"
                    onMouseEnter={(e) => {
                      if (item) showTooltip(item, e.clientX, e.clientY);
                    }}
                    onMouseMove={(e) => moveTooltip(e.clientX, e.clientY)}
                    onMouseLeave={hideTooltip}
                  >
                    {item && (
                      <>
                        <span className="inv-slot__icon">
                          <GameIcon name={getItemIconName(item.itemId, def?.category)} size={20} />
                        </span>
                        {item.quantity > 1 && (
                          <span className="inv-slot__qty">{item.quantity}</span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Tooltip {...tooltipState} />
      </div>
    </div>
  );
};
