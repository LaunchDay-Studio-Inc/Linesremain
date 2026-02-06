// ─── Inventory Panel ───

import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { ITEM_REGISTRY } from '@shared/constants/items';
import { HOTBAR_SLOTS, PLAYER_INVENTORY_SLOTS } from '@shared/constants/game';
import { EquipSlot } from '@shared/types/items';
import { getItemIcon } from '../../utils/itemIcons';
import { Tooltip, useTooltip } from '../common/Tooltip';
import { DragDropProvider, useDragDrop } from '../common/DragDrop';
import '../../styles/panels.css';

const EQUIP_SLOTS: { slot: EquipSlot; label: string }[] = [
  { slot: EquipSlot.Head, label: 'Head' },
  { slot: EquipSlot.Chest, label: 'Chest' },
  { slot: EquipSlot.Legs, label: 'Legs' },
  { slot: EquipSlot.Feet, label: 'Feet' },
];

export const InventoryPanel: React.FC = () => {
  const inventoryOpen = useUIStore((s) => s.inventoryOpen);
  const toggleInventory = useUIStore((s) => s.toggleInventory);

  if (!inventoryOpen) return null;

  return (
    <div className="panel-backdrop" onClick={toggleInventory}>
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 480 }}>
        <div className="panel__header">
          <span className="panel__title">Inventory</span>
          <button className="panel__close" onClick={toggleInventory}>✕</button>
        </div>
        <DragDropProvider>
          <InventoryContent />
        </DragDropProvider>
      </div>
    </div>
  );
};

// ─── Inner Content ───

const InventoryContent: React.FC = () => {
  const inventory = usePlayerStore((s) => s.inventory);
  const equipment = usePlayerStore((s) => s.equipment);
  const { tooltipState, showTooltip, hideTooltip, moveTooltip } = useTooltip();
  const { startDrag, endDrag, updatePosition } = useDragDrop();

  // Hotbar = first HOTBAR_SLOTS, main inventory = remaining
  const hotbarItems = inventory.slice(0, HOTBAR_SLOTS);
  const mainItems = inventory.slice(HOTBAR_SLOTS, HOTBAR_SLOTS + PLAYER_INVENTORY_SLOTS);

  return (
    <div
      style={{ display: 'flex', gap: 20 }}
      onMouseMove={updatePosition}
      onMouseUp={endDrag}
    >
      {/* Equipment Slots */}
      <div className="equip-slots">
        {EQUIP_SLOTS.map(({ slot, label }) => {
          const item = equipment[slot] ?? null;
          const def = item ? ITEM_REGISTRY[item.itemId] : undefined;
          const icon = def ? getItemIcon(def.category) : '';

          return (
            <div
              key={slot}
              className={`equip-slot${item ? ' equip-slot--has-item' : ''}`}
              onMouseEnter={(e) => {
                if (item) showTooltip(item, e.clientX, e.clientY);
              }}
              onMouseMove={(e) => moveTooltip(e.clientX, e.clientY)}
              onMouseLeave={hideTooltip}
            >
              {item ? (
                <span style={{ fontSize: 20 }}>{icon}</span>
              ) : (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                  {label.charAt(0)}
                </span>
              )}
              <span className="equip-slot__label">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Main Grid + Hotbar */}
      <div>
        {/* Main Inventory Grid (4 rows × 6 cols = 24 slots) */}
        <div className="inv-grid" style={{ marginBottom: 12 }}>
          {mainItems.map((item, i) => {
            const slotIndex = HOTBAR_SLOTS + i;
            const def = item ? ITEM_REGISTRY[item.itemId] : undefined;
            const icon = def ? getItemIcon(def.category) : '';

            return (
              <div
                key={slotIndex}
                className="inv-slot"
                onMouseDown={(e) => {
                  if (item) startDrag(item, slotIndex, 'inventory', e);
                }}
                onMouseEnter={(e) => {
                  if (item) showTooltip(item, e.clientX, e.clientY);
                }}
                onMouseMove={(e) => moveTooltip(e.clientX, e.clientY)}
                onMouseLeave={hideTooltip}
              >
                {item && (
                  <>
                    <span className="inv-slot__icon">{icon}</span>
                    {item.quantity > 1 && (
                      <span className="inv-slot__qty">{item.quantity}</span>
                    )}
                    {def?.durability != null && item.durability != null && (
                      <div className="inv-slot__durability">
                        <div
                          className="inv-slot__durability-fill"
                          style={{ width: `${(item.durability / def.durability) * 100}%` }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Hotbar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              marginBottom: 4,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Hotbar
          </div>
          <div className="inv-grid" style={{ gridTemplateColumns: `repeat(${HOTBAR_SLOTS}, 50px)` }}>
            {hotbarItems.map((item, i) => {
              const def = item ? ITEM_REGISTRY[item.itemId] : undefined;
              const icon = def ? getItemIcon(def.category) : '';

              return (
                <div
                  key={i}
                  className="inv-slot"
                  onMouseDown={(e) => {
                    if (item) startDrag(item, i, 'hotbar', e);
                  }}
                  onMouseEnter={(e) => {
                    if (item) showTooltip(item, e.clientX, e.clientY);
                  }}
                  onMouseMove={(e) => moveTooltip(e.clientX, e.clientY)}
                  onMouseLeave={hideTooltip}
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
      </div>

      <Tooltip {...tooltipState} />
    </div>
  );
};