// ─── Game Icon Component ───
// Premium SVG icon library for all game items, building pieces, and UI elements.

import React from 'react';

export type IconName =
  // Building
  | 'foundation'
  | 'foundation-tri'
  | 'wall'
  | 'half-wall'
  | 'doorway'
  | 'window'
  | 'wall-frame'
  | 'floor'
  | 'floor-tri'
  | 'stairs'
  | 'roof'
  | 'door'
  | 'fence'
  | 'pillar'
  // Resources
  | 'wood'
  | 'stone'
  | 'metal'
  | 'hqm'
  | 'cloth'
  | 'bone'
  | 'sulfur'
  | 'gunpowder'
  | 'fuel'
  | 'rope'
  | 'scrap'
  // Tools & Weapons
  | 'hatchet'
  | 'pickaxe'
  | 'spear'
  | 'bow'
  | 'sword'
  | 'hammer'
  // Deployables
  | 'campfire'
  | 'sleeping-bag'
  | 'research-table'
  | 'tool-cupboard'
  | 'lock'
  | 'c4'
  | 'landmine'
  | 'barricade'
  // Status
  | 'shield'
  | 'heart'
  | 'hunger'
  | 'thirst'
  | 'temperature'
  // Special
  | 'skull'
  | 'crown'
  | 'lineage'
  | 'map-pin'
  | 'compass'
  // Legacy (backward compatibility with itemIcons.ts)
  | 'metal-frags'
  | 'charcoal'
  | 'low-grade-fuel'
  | 'gun'
  | 'ammo'
  | 'meat'
  | 'mushroom'
  | 'scroll'
  | 'storage';

interface GameIconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const GameIcon: React.FC<GameIconProps> = ({
  name,
  size = 24,
  color = 'currentColor',
  className,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ flexShrink: 0, ...style }}
  >
    {ICON_PATHS[name]}
  </svg>
);

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  // ─── Building ───
  foundation: (
    <>
      <rect x="2" y="14" width="20" height="6" rx="1" />
      <line x1="8" y1="14" x2="8" y2="20" />
      <line x1="16" y1="14" x2="16" y2="20" />
      <line x1="2" y1="17" x2="22" y2="17" />
    </>
  ),
  'foundation-tri': (
    <>
      <path d="M12 14 L22 20 H2 Z" />
      <line x1="12" y1="14" x2="12" y2="20" />
    </>
  ),
  wall: (
    <>
      <rect x="3" y="2" width="18" height="20" rx="1" />
      <line x1="3" y1="8" x2="21" y2="8" />
      <line x1="3" y1="14" x2="21" y2="14" />
      <line x1="12" y1="2" x2="12" y2="8" />
      <line x1="8" y1="8" x2="8" y2="14" />
      <line x1="16" y1="8" x2="16" y2="14" />
      <line x1="12" y1="14" x2="12" y2="22" />
    </>
  ),
  'half-wall': (
    <>
      <rect x="3" y="10" width="18" height="12" rx="1" />
      <line x1="3" y1="16" x2="21" y2="16" />
      <line x1="12" y1="10" x2="12" y2="16" />
      <line x1="8" y1="16" x2="8" y2="22" />
      <line x1="16" y1="16" x2="16" y2="22" />
    </>
  ),
  doorway: (
    <>
      <rect x="3" y="2" width="18" height="20" rx="1" />
      <path d="M8 22 V12 Q8 8 12 8 Q16 8 16 12 V22" />
    </>
  ),
  window: (
    <>
      <rect x="3" y="2" width="18" height="20" rx="1" />
      <rect x="7" y="6" width="10" height="8" rx="1" />
      <line x1="12" y1="6" x2="12" y2="14" />
      <line x1="7" y1="10" x2="17" y2="10" />
    </>
  ),
  'wall-frame': (
    <>
      <rect x="3" y="2" width="18" height="20" rx="1" />
      <rect x="6" y="5" width="12" height="14" rx="1" strokeDasharray="3 2" />
    </>
  ),
  floor: (
    <>
      <path d="M2 12 L12 6 L22 12 L12 18 Z" />
      <line x1="7" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="7" y2="15" />
    </>
  ),
  'floor-tri': (
    <>
      <path d="M2 18 L12 6 L22 18 Z" />
      <line x1="12" y1="6" x2="12" y2="18" />
    </>
  ),
  stairs: (
    <>
      <path d="M4 20 H9 V14 H15 V8 H20" />
      <line x1="4" y1="20" x2="4" y2="22" />
      <line x1="9" y1="14" x2="9" y2="20" />
      <line x1="15" y1="8" x2="15" y2="14" />
    </>
  ),
  roof: (
    <>
      <path d="M2 18 L12 4 L22 18" />
      <line x1="7" y1="18" x2="7" y2="11" />
      <line x1="17" y1="18" x2="17" y2="11" />
    </>
  ),
  door: (
    <>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <circle cx="15" cy="13" r="1.5" />
      <line x1="5" y1="12" x2="8" y2="12" />
    </>
  ),
  fence: (
    <>
      <line x1="4" y1="2" x2="4" y2="22" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="20" y1="2" x2="20" y2="22" />
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <path d="M4 2 L4 0 M12 2 L12 0 M20 2 L20 0" strokeWidth={2} />
    </>
  ),
  pillar: (
    <>
      <rect x="9" y="4" width="6" height="16" />
      <rect x="6" y="2" width="12" height="3" rx="1" />
      <rect x="6" y="19" width="12" height="3" rx="1" />
    </>
  ),

  // ─── Resources ───
  wood: (
    <>
      <ellipse cx="8" cy="16" rx="5" ry="3" />
      <ellipse cx="16" cy="12" rx="5" ry="3" />
      <ellipse cx="10" cy="8" rx="5" ry="3" />
      <line x1="5" y1="16" x2="3" y2="18" />
      <line x1="13" y1="12" x2="11" y2="14" />
    </>
  ),
  stone: (
    <>
      <path d="M4 18 L2 12 L6 6 L12 4 L18 6 L22 12 L20 18 L14 20 L8 20 Z" />
      <line x1="6" y1="6" x2="12" y2="12" />
      <line x1="18" y1="6" x2="12" y2="12" />
      <line x1="12" y1="12" x2="14" y2="20" />
    </>
  ),
  metal: (
    <>
      <path d="M6 4 L10 2 L14 4 L12 10 Z" />
      <path d="M14 8 L18 6 L22 10 L18 14 Z" />
      <path d="M2 14 L8 12 L10 18 L4 20 Z" />
      <path d="M12 16 L16 14 L20 18 L14 22 Z" />
    </>
  ),
  hqm: (
    <>
      <path d="M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z" />
      <path d="M12 2 L12 22" opacity={0.4} />
      <path d="M4 7 L20 17" opacity={0.4} />
      <path d="M20 7 L4 17" opacity={0.4} />
    </>
  ),
  cloth: (
    <>
      <path d="M4 4 Q8 2 12 4 Q16 6 20 4" />
      <path d="M4 4 L4 18 Q8 22 12 18 Q16 22 20 18 L20 4" />
      <path d="M4 10 Q8 8 12 10 Q16 12 20 10" opacity={0.4} />
    </>
  ),
  bone: (
    <>
      <circle cx="5" cy="5" r="2" />
      <circle cx="7" cy="3" r="2" />
      <circle cx="17" cy="21" r="2" />
      <circle cx="19" cy="19" r="2" />
      <line x1="6" y1="6" x2="18" y2="18" strokeWidth={2.5} />
    </>
  ),
  sulfur: (
    <>
      <path d="M12 2 L16 8 L22 10 L18 16 L18 22 L12 20 L6 22 L6 16 L2 10 L8 8 Z" />
    </>
  ),
  gunpowder: (
    <>
      <circle cx="12" cy="14" r="6" />
      <path d="M12 2 L12 8" />
      <path d="M9 3 L11 8" />
      <path d="M15 3 L13 8" />
      <path d="M12 14 L12 10" strokeWidth={2} />
    </>
  ),
  fuel: (
    <>
      <rect x="6" y="8" width="12" height="14" rx="2" />
      <rect x="9" y="4" width="6" height="5" rx="1" />
      <path d="M10 12 L10 18 L14 18 L14 14 L12 12 Z" fill="currentColor" opacity={0.3} />
    </>
  ),
  rope: (
    <>
      <path d="M6 2 Q18 6 6 12 Q18 18 6 22" />
    </>
  ),
  scrap: (
    <>
      <path d="M4 6 L8 4 L12 8 L16 4 L20 6 L16 12 L20 18 L16 20 L12 16 L8 20 L4 18 L8 12 Z" />
    </>
  ),

  // ─── Tools & Weapons ───
  hatchet: (
    <>
      <line x1="6" y1="20" x2="18" y2="4" strokeWidth={2} />
      <path d="M14 4 Q20 2 22 8 L16 10 Z" fill="currentColor" opacity={0.2} />
    </>
  ),
  pickaxe: (
    <>
      <line x1="4" y1="22" x2="16" y2="6" strokeWidth={2} />
      <path d="M12 6 L22 2 L18 10 Z" fill="currentColor" opacity={0.2} />
    </>
  ),
  spear: (
    <>
      <line x1="6" y1="22" x2="18" y2="6" strokeWidth={1.8} />
      <path d="M18 6 L22 2 L16 2 Z" fill="currentColor" opacity={0.3} />
    </>
  ),
  bow: (
    <>
      <path d="M6 2 Q2 12 6 22" strokeWidth={2} />
      <line x1="6" y1="2" x2="6" y2="22" strokeWidth={0.8} />
      <line x1="6" y1="12" x2="20" y2="4" />
      <path d="M20 4 L22 2 L20 6 Z" fill="currentColor" opacity={0.3} />
    </>
  ),
  sword: (
    <>
      <line x1="8" y1="22" x2="20" y2="4" strokeWidth={2.5} />
      <line x1="6" y1="16" x2="14" y2="14" strokeWidth={2} />
      <path d="M20 4 L22 2 L18 2 Z" fill="currentColor" opacity={0.3} />
    </>
  ),
  hammer: (
    <>
      <line x1="6" y1="22" x2="14" y2="8" strokeWidth={2} />
      <rect x="10" y="3" width="12" height="7" rx="2" fill="currentColor" opacity={0.2} />
    </>
  ),

  // ─── Deployables ───
  campfire: (
    <>
      <path d="M4 20 L8 16 L6 20 L10 14 L8 20 L12 10 L14 20 L16 14 L18 20 L16 16 L20 20" />
      <path d="M12 10 Q14 6 12 2 Q10 6 12 10" fill="currentColor" opacity={0.3} />
    </>
  ),
  'sleeping-bag': (
    <>
      <path d="M4 10 Q4 6 8 6 L20 6 Q22 6 22 10 L22 16 Q22 18 20 18 L8 18 Q4 18 4 14 Z" />
      <line x1="14" y1="6" x2="14" y2="18" opacity={0.3} />
      <circle cx="9" cy="12" r="2" opacity={0.3} />
    </>
  ),
  'research-table': (
    <>
      <rect x="2" y="12" width="20" height="3" rx="1" />
      <line x1="4" y1="15" x2="4" y2="22" />
      <line x1="20" y1="15" x2="20" y2="22" />
      <circle cx="8" cy="9" r="3" />
      <path d="M14 4 L18 4 L18 12 L14 12 Z" />
      <line x1="14" y1="8" x2="18" y2="8" />
    </>
  ),
  'tool-cupboard': (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="14" x2="20" y2="14" />
      <circle cx="14" cy="5" r="1" fill="currentColor" />
      <circle cx="14" cy="11" r="1" fill="currentColor" />
      <circle cx="14" cy="17" r="1" fill="currentColor" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="11" rx="2" />
      <path d="M8 11 V7 Q8 3 12 3 Q16 3 16 7 V11" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
      <line x1="12" y1="17.5" x2="12" y2="19" />
    </>
  ),
  c4: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="3" />
      <rect x="8" y="9" width="8" height="3" rx="1" fill="currentColor" opacity={0.3} />
      <circle cx="12" cy="15" r="1" fill="currentColor" />
      <path d="M12 6 L12 2 L16 2" />
    </>
  ),
  landmine: (
    <>
      <ellipse cx="12" cy="16" rx="8" ry="4" />
      <path d="M8 12 Q12 8 16 12" />
      <circle cx="12" cy="13" r="1.5" fill="currentColor" opacity={0.4} />
    </>
  ),
  barricade: (
    <>
      <line x1="2" y1="22" x2="12" y2="4" strokeWidth={2} />
      <line x1="22" y1="22" x2="12" y2="4" strokeWidth={2} />
      <line x1="2" y1="22" x2="22" y2="22" strokeWidth={2} />
      <line x1="5" y1="16" x2="19" y2="16" />
      <line x1="8" y1="10" x2="16" y2="10" />
    </>
  ),

  // ─── Status ───
  heart: (
    <>
      <path
        d="M12 21 C12 21 3 14 3 8.5 C3 5 5.5 3 8 3 C9.7 3 11.3 4 12 5.5 C12.7 4 14.3 3 16 3 C18.5 3 21 5 21 8.5 C21 14 12 21 12 21Z"
        fill="currentColor"
        opacity={0.3}
      />
    </>
  ),
  shield: (
    <>
      <path d="M12 2 L20 6 L20 12 Q20 18 12 22 Q4 18 4 12 L4 6 Z" />
      <path d="M12 8 L12 16" opacity={0.3} />
      <path d="M8 12 L16 12" opacity={0.3} />
    </>
  ),
  hunger: (
    <>
      <path d="M8 2 L8 10 Q8 14 12 14 Q16 14 16 10 L16 2" />
      <line x1="12" y1="14" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
      <line x1="12" y1="2" x2="12" y2="10" strokeWidth={0.8} opacity={0.3} />
    </>
  ),
  thirst: (
    <>
      <path d="M12 2 Q6 10 6 14 Q6 20 12 22 Q18 20 18 14 Q18 10 12 2 Z" />
      <path d="M10 16 Q12 18 14 16" opacity={0.4} />
    </>
  ),
  temperature: (
    <>
      <path d="M10 2 L10 14 Q7 15 7 18 Q7 22 12 22 Q17 22 17 18 Q17 15 14 14 L14 2 Z" />
      <circle cx="12" cy="18" r="2.5" fill="currentColor" opacity={0.3} />
      <line x1="12" y1="18" x2="12" y2="7" strokeWidth={2} opacity={0.3} />
    </>
  ),

  // ─── Special ───
  skull: (
    <>
      <circle cx="12" cy="9" r="7" />
      <circle cx="9" cy="8" r="2" fill="currentColor" opacity={0.4} />
      <circle cx="15" cy="8" r="2" fill="currentColor" opacity={0.4} />
      <path d="M9 14 L10 16 L12 14 L14 16 L15 14" />
      <line x1="9" y1="16" x2="9" y2="22" />
      <line x1="12" y1="16" x2="12" y2="22" />
      <line x1="15" y1="16" x2="15" y2="22" />
    </>
  ),
  crown: (
    <>
      <path d="M3 18 L3 8 L7 12 L12 4 L17 12 L21 8 L21 18 Z" />
      <rect x="3" y="18" width="18" height="3" rx="1" />
      <circle cx="7" cy="14" r="1" fill="currentColor" opacity={0.3} />
      <circle cx="12" cy="12" r="1" fill="currentColor" opacity={0.3} />
      <circle cx="17" cy="14" r="1" fill="currentColor" opacity={0.3} />
    </>
  ),
  lineage: (
    <>
      <circle cx="12" cy="5" r="3" />
      <line x1="12" y1="8" x2="12" y2="14" />
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="18" cy="17" r="2.5" />
      <line x1="12" y1="14" x2="6" y2="14.5" />
      <line x1="12" y1="14" x2="18" y2="14.5" />
      <line x1="6" y1="19.5" x2="6" y2="22" />
      <line x1="18" y1="19.5" x2="18" y2="22" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M12 2 Q6 2 6 8 Q6 14 12 22 Q18 14 18 8 Q18 2 12 2 Z" />
      <circle cx="12" cy="8" r="3" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2 L14 6 L12 4 L10 6 Z" fill="currentColor" opacity={0.5} />
      <path d="M12 12 L8 18 L12 16 L16 18 Z" fill="currentColor" opacity={0.3} />
      <path d="M12 12 L16 6 L12 8 L8 6 Z" fill="currentColor" opacity={0.15} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity={0.4} />
    </>
  ),

  // ─── Legacy (backward compatibility) ───
  'metal-frags': (
    <>
      <path d="M4 14l3-4 4 2-2 4z" />
      <path d="M13 10l4-4 3 3-4 4z" />
      <path d="M10 19l2-4 4 1-1 4z" />
    </>
  ),
  charcoal: (
    <>
      <ellipse cx="8" cy="15" rx="5" ry="4" />
      <ellipse cx="16" cy="16" rx="4" ry="3" />
      <ellipse cx="13" cy="10" rx="4" ry="3" />
    </>
  ),
  'low-grade-fuel': (
    <>
      <rect x="6" y="6" width="12" height="14" rx="1" />
      <line x1="6" y1="10" x2="18" y2="10" />
      <path d="M10 6V4h4v2" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </>
  ),
  gun: (
    <>
      <path d="M3 9h14a2 2 0 0 1 2 2v1H5" />
      <path d="M8 12v6a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6" />
      <line x1="17" y1="9" x2="21" y2="9" />
    </>
  ),
  ammo: (
    <>
      <path d="M10 6a2 2 0 0 1 4 0v4h-4z" />
      <rect x="9" y="10" width="6" height="8" rx="0.5" />
    </>
  ),
  meat: (
    <>
      <path d="M10 4a5 5 0 0 1 5 5c0 2-1 3-3 4l-4 6" />
      <circle cx="14" cy="8" r="4" />
      <line x1="6" y1="16" x2="8" y2="14" strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  mushroom: (
    <>
      <path d="M4 14a8 8 0 0 1 16 0z" />
      <rect x="10" y="14" width="4" height="7" rx="1" />
    </>
  ),
  scroll: (
    <>
      <path d="M8 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 0-4H8" />
      <line x1="10" y1="8" x2="16" y2="8" />
      <line x1="10" y1="11" x2="16" y2="11" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </>
  ),
  storage: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="1" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="10" y1="10" x2="10" y2="15" />
      <line x1="14" y1="10" x2="14" y2="15" />
    </>
  ),
};

export default GameIcon;
