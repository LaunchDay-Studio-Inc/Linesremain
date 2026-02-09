// ─── Pickup Notifications ───
// Shows floating "+N ItemName" text on the HUD when items are added to inventory.

import { ITEM_REGISTRY } from '@shared/constants/items';
import type { ItemStack } from '@shared/types/items';
import { ItemCategory } from '@shared/types/items';
import React, { useEffect, useRef, useState } from 'react';
import type { SoundName } from '../../engine/AudioManager';
import { AudioManager } from '../../engine/AudioManager';
import { usePlayerStore } from '../../stores/usePlayerStore';

interface PickupNotification {
  id: number;
  text: string;
  createdAt: number;
}

const NOTIFICATION_DURATION = 2500; // ms
let nextId = 0;

// Epic items: HQM Ore (5), C4 (62), Rocket (63), Assault Rifle (50)
const EPIC_ITEM_IDS = new Set([5, 50, 62, 63]);

function getPickupSound(itemId: number): SoundName {
  if (EPIC_ITEM_IDS.has(itemId)) return 'pickupEpic';
  const def = ITEM_REGISTRY[itemId];
  if (!def) return 'pickup';
  const cat = def.category;
  if (
    cat === ItemCategory.WeaponMelee ||
    cat === ItemCategory.WeaponRanged ||
    cat === ItemCategory.Armor ||
    cat === ItemCategory.Ammo
  ) {
    return 'pickupRare';
  }
  return 'pickup';
}

export const PickupNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<PickupNotification[]>([]);
  const prevInventoryRef = useRef<(ItemStack | null)[]>([]);
  const inventory = usePlayerStore((s) => s.inventory);

  useEffect(() => {
    const prev = prevInventoryRef.current;
    // Skip initial mount — no diff to show
    if (prev.length === 0) {
      prevInventoryRef.current = inventory;
      return;
    }

    // Compute item count diffs
    const prevCounts = new Map<number, number>();
    for (const slot of prev) {
      if (slot) prevCounts.set(slot.itemId, (prevCounts.get(slot.itemId) ?? 0) + slot.quantity);
    }

    const currCounts = new Map<number, number>();
    for (const slot of inventory) {
      if (slot) currCounts.set(slot.itemId, (currCounts.get(slot.itemId) ?? 0) + slot.quantity);
    }

    const newNotifs: PickupNotification[] = [];
    for (const [itemId, currQty] of currCounts) {
      const prevQty = prevCounts.get(itemId) ?? 0;
      const diff = currQty - prevQty;
      if (diff > 0) {
        const def = ITEM_REGISTRY[itemId];
        const name = def?.name ?? `Item #${itemId}`;
        newNotifs.push({
          id: nextId++,
          text: `+${diff} ${name}`,
          createdAt: Date.now(),
        });
        // Play rarity-based pickup sound
        AudioManager.getInstance().play(getPickupSound(itemId));
      }
    }

    if (newNotifs.length > 0) {
      setNotifications((n) => [...n, ...newNotifs].slice(-6));
    }

    prevInventoryRef.current = inventory;
  }, [inventory]);

  // Auto-remove expired notifications
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setNotifications((n) => n.filter((notif) => now - notif.createdAt < NOTIFICATION_DURATION));
    }, 200);
    return () => clearInterval(timer);
  }, [notifications.length]);

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 100,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        pointerEvents: 'none',
        zIndex: 15,
      }}
    >
      {notifications.map((notif) => {
        const age = Date.now() - notif.createdAt;
        const fadeProgress = Math.max(0, Math.min(1, (age - NOTIFICATION_DURATION + 500) / 500));

        return (
          <div
            key={notif.id}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#2ECC71',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
              fontFamily: 'var(--font-ui)',
              opacity: 1 - fadeProgress,
              transform: `translateY(${-fadeProgress * 10}px)`,
              transition: 'opacity 0.3s ease, transform 0.3s ease',
            }}
          >
            {notif.text}
          </div>
        );
      })}
    </div>
  );
};
