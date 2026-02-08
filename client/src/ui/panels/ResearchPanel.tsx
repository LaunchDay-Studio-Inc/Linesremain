// ─── Research Panel ───
// Panel for using the research table to learn item blueprints.

import { HOTBAR_SLOTS, PLAYER_INVENTORY_SLOTS } from '@shared/constants/game';
import { ITEM_REGISTRY } from '@shared/constants/items';
import { ClientMessage } from '@shared/types/network';
import React, { useCallback, useMemo, useState } from 'react';
import { socketClient } from '../../network/SocketClient';
import { useEndgameStore } from '../../stores/useEndgameStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/panels.css';
import { getItemIcon } from '../../utils/itemIcons';

const SCRAP_ITEM_ID = 96;
const RESEARCH_COST = 100;

interface ResearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: number;
}

export const ResearchPanel: React.FC<ResearchPanelProps> = ({ isOpen, onClose, entityId }) => {
  const inventory = usePlayerStore((s) => s.inventory);
  const researchProgress = useEndgameStore((s) => s.researchProgress);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const playerSlots = inventory.slice(0, HOTBAR_SLOTS + PLAYER_INVENTORY_SLOTS);

  // Count scrap in player inventory
  const scrapCount = useMemo(() => {
    let total = 0;
    for (const slot of inventory) {
      if (slot && slot.itemId === SCRAP_ITEM_ID) {
        total += slot.quantity;
      }
    }
    return total;
  }, [inventory]);

  const selectedItem = selectedSlot !== null ? playerSlots[selectedSlot] : null;
  const selectedDef = selectedItem ? ITEM_REGISTRY[selectedItem.itemId] : null;

  const isResearching =
    researchProgress !== null &&
    researchProgress.entityId === entityId &&
    !researchProgress.isComplete;

  const canResearch =
    selectedSlot !== null && selectedItem !== null && scrapCount >= RESEARCH_COST && !isResearching;

  const handleStartResearch = useCallback(() => {
    if (selectedSlot === null || !canResearch) return;
    socketClient.emit(ClientMessage.ResearchStart, {
      entityId,
      itemSlot: selectedSlot,
    });
  }, [selectedSlot, canResearch, entityId]);

  const handleCancelResearch = useCallback(() => {
    socketClient.emit(ClientMessage.ResearchCancel, { entityId });
  }, [entityId]);

  const handleClose = useCallback(() => {
    setSelectedSlot(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const progressPercent = isResearching ? Math.round(researchProgress!.progress * 100) : 0;

  return (
    <div className="panel-backdrop" onClick={handleClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 440 }}>
        <div className="panel__header">
          <span className="panel__title">Research Table</span>
          <button className="panel__close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {/* Inventory selection */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontWeight: 700,
              }}
            >
              Select Item to Research
            </div>

            <div className="inv-grid">
              {playerSlots.map((item, i) => {
                const def = item ? ITEM_REGISTRY[item.itemId] : undefined;
                const icon = def ? getItemIcon(def.category) : '';
                const isSelected = selectedSlot === i;

                return (
                  <div
                    key={`r-${i}`}
                    className={`inv-slot${isSelected ? ' inv-slot--selected' : ''}`}
                    onClick={() => {
                      if (item && !isResearching) {
                        setSelectedSlot(i === selectedSlot ? null : i);
                      }
                    }}
                    style={isResearching ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
                  >
                    {item && (
                      <>
                        <span className="inv-slot__icon">{icon}</span>
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

          {/* Research detail */}
          <div
            style={{
              width: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: 8,
            }}
          >
            {/* Selected item display */}
            <div
              style={{
                width: 64,
                height: 64,
                border: '2px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              {selectedDef ? getItemIcon(selectedDef.category) : '?'}
            </div>

            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text-primary)',
                textAlign: 'center',
              }}
            >
              {selectedDef?.name ?? 'No item selected'}
            </div>

            {/* Scrap cost */}
            <div
              style={{
                fontSize: 12,
                color: scrapCount >= RESEARCH_COST ? 'var(--success)' : 'var(--danger)',
                fontWeight: 600,
              }}
            >
              Scrap: {scrapCount} / {RESEARCH_COST}
            </div>

            {/* Research progress or start button */}
            {isResearching ? (
              <>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--accent)',
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  Researching{researchProgress!.itemName ? ` ${researchProgress!.itemName}` : ''}...
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%' }}>
                  <div className="progress-bar">
                    <div
                      className="progress-bar__fill"
                      style={{
                        width: `${progressPercent}%`,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      marginTop: 4,
                    }}
                  >
                    {progressPercent}%
                  </div>
                </div>

                {/* Cancel button */}
                <button
                  className="craft-btn"
                  onClick={handleCancelResearch}
                  style={{
                    background: 'rgba(231, 76, 60, 0.2)',
                    border: '1px solid rgba(231, 76, 60, 0.4)',
                    color: 'var(--danger-light)',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {researchProgress?.isComplete && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--success)',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  >
                    Blueprint learned!
                  </div>
                )}

                <button className="craft-btn" onClick={handleStartResearch} disabled={!canResearch}>
                  Start Research
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
