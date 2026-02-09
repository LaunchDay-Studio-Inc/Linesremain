// ─── Island Minimap ───
// Pure inline SVG minimap showing Haven and Ember Isle with player
// position and portal location.

import { EMBER_ISLAND, HAVEN_ISLAND } from '@lineremain/shared';
import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { usePlayerStore } from '../../stores/usePlayerStore';

// ─── Constants ───

// Island world coordinate space: 13 chunks * 32 blocks = 416 wide, 5 chunks * 32 = 160 tall
const VIEW_WIDTH = 416;
const VIEW_HEIGHT = 160;

// Display size
const DISPLAY_WIDTH = 160;
const DISPLAY_HEIGHT = 100;

// Haven center (chunks 0-4, center at chunk 2 = block 80)
const HAVEN_CX = (HAVEN_ISLAND.minCX + HAVEN_ISLAND.maxCX) * 0.5 * 32 + 16; // 80
const HAVEN_CZ = (HAVEN_ISLAND.minCZ + HAVEN_ISLAND.maxCZ) * 0.5 * 32 + 16; // 80

// Ember center (chunks 8-12, center at chunk 10 = block 336)
const EMBER_CX = (EMBER_ISLAND.minCX + EMBER_ISLAND.maxCX) * 0.5 * 32 + 16; // 336
const EMBER_CZ = (EMBER_ISLAND.minCZ + EMBER_ISLAND.maxCZ) * 0.5 * 32 + 16; // 80

// Island ellipse radii (each island spans ~5 chunks * 32 = 160 blocks, so rx ~ half minus some margin)
const ISLAND_RX = 70;
const ISLAND_RZ = 60;

// ─── Pulse Animation SVG ───

const PULSE_ANIMATION_CSS = `
  @keyframes islandMinimapPulse {
    0%, 100% { r: 4; opacity: 1; }
    50% { r: 6; opacity: 0.6; }
  }
  @keyframes islandMinimapPortalPulse {
    0%, 100% { r: 3; opacity: 1; }
    50% { r: 5; opacity: 0.7; }
  }
`;

// ─── Styles ───

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 12,
  width: DISPLAY_WIDTH,
  height: DISPLAY_HEIGHT,
  pointerEvents: 'none',
  zIndex: 100,
  borderRadius: 8,
  overflow: 'hidden',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  contain: 'layout paint',
};

// ─── Component ───

export const IslandMinimap: React.FC = () => {
  const playerWorld = useGameStore((s) => s.playerWorld);
  const position = usePlayerStore((s) => s.position);

  if (playerWorld !== 'islands') return null;

  // Clamp player position to viewBox bounds for rendering
  const playerX = Math.max(0, Math.min(VIEW_WIDTH, position.x));
  const playerZ = Math.max(0, Math.min(VIEW_HEIGHT, position.z));

  return (
    <div style={containerStyle}>
      <svg
        width={DISPLAY_WIDTH}
        height={DISPLAY_HEIGHT}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        {/* Inject pulse animations */}
        <defs>
          <style>{PULSE_ANIMATION_CSS}</style>
          {/* Subtle radial gradient for island depth */}
          <radialGradient id="havenGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5a9c69" />
            <stop offset="100%" stopColor="#4a7c59" />
          </radialGradient>
          <radialGradient id="emberGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a05a1a" />
            <stop offset="100%" stopColor="#8b4513" />
          </radialGradient>
        </defs>

        {/* Ocean background */}
        <rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="#1a3a5c" />

        {/* Haven Island */}
        <ellipse
          cx={HAVEN_CX}
          cy={HAVEN_CZ}
          rx={ISLAND_RX}
          ry={ISLAND_RZ}
          fill="url(#havenGrad)"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth={1}
        />

        {/* Ember Isle */}
        <ellipse
          cx={EMBER_CX}
          cy={EMBER_CZ}
          rx={ISLAND_RX}
          ry={ISLAND_RZ}
          fill="url(#emberGrad)"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth={1}
        />

        {/* Portal location (golden dot on Ember Isle) */}
        <circle
          cx={EMBER_ISLAND.portalX}
          cy={EMBER_ISLAND.portalZ}
          r={3}
          fill="#f0a500"
          style={{ animation: 'islandMinimapPortalPulse 2.5s ease-in-out infinite' }}
        />

        {/* Island labels */}
        <text
          x={HAVEN_CX}
          y={HAVEN_CZ + ISLAND_RZ + 14}
          textAnchor="middle"
          fill="rgba(255, 255, 255, 0.5)"
          fontSize={12}
          fontFamily="var(--font-ui)"
          fontWeight={600}
        >
          Haven
        </text>
        <text
          x={EMBER_CX}
          y={EMBER_CZ + ISLAND_RZ + 14}
          textAnchor="middle"
          fill="rgba(255, 255, 255, 0.5)"
          fontSize={12}
          fontFamily="var(--font-ui)"
          fontWeight={600}
        >
          Ember Isle
        </text>

        {/* Player position dot */}
        <circle
          cx={playerX}
          cy={playerZ}
          r={4}
          fill="white"
          stroke="rgba(0, 0, 0, 0.5)"
          strokeWidth={1.5}
          style={{ animation: 'islandMinimapPulse 1.8s ease-in-out infinite' }}
        />
      </svg>
    </div>
  );
};
