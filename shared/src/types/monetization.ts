// ─── Store Item Types ───

export type StoreCategory = 'skin' | 'accessory' | 'trail' | 'death_effect' | 'badge';

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  category: StoreCategory;
  priceCents: number;
  previewData: Record<string, string>;
  isActive: boolean;
}

// ─── Battle Pass Types ───

export interface BattlePassReward {
  type: StoreCategory;
  id: string;
  death?: string; // optional death effect paired with skin
}

export interface BattlePassTier {
  tier: number;
  freeReward: BattlePassReward | null;
  premiumReward: BattlePassReward;
  xpRequired: number;
}

export interface BattlePassState {
  seasonNumber: number;
  currentTier: number;
  xpInTier: number;
  isPremium: boolean;
  claimedFree: number[];
  claimedPremium: number[];
}

// ─── Notification Types ───

export type NotificationType = 'info' | 'warning' | 'danger' | 'success' | 'achievement' | 'loot';

export interface GameNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // ms, default 4000
  icon?: string;
}
