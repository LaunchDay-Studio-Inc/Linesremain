// ─── Item Icon Utility ───
// Maps item categories to emoji icons for UI display.

import { ItemCategory } from '@shared/types/items';

const CATEGORY_ICONS: Record<ItemCategory, string> = {
  [ItemCategory.Resource]: '🪨',
  [ItemCategory.Tool]: '⛏️',
  [ItemCategory.WeaponMelee]: '⚔️',
  [ItemCategory.WeaponRanged]: '🏹',
  [ItemCategory.Ammo]: '🔫',
  [ItemCategory.Armor]: '🛡️',
  [ItemCategory.Consumable]: '🍖',
  [ItemCategory.Building]: '🏗️',
  [ItemCategory.Deployable]: '📦',
  [ItemCategory.Component]: '⚙️',
  [ItemCategory.Misc]: '📎',
};

export function getItemIcon(category: ItemCategory): string {
  return CATEGORY_ICONS[category] ?? '❓';
}