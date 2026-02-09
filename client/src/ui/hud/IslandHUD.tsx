// ─── Island HUD ───
// Minimal HUD overlay for the island world showing island name,
// portal proximity, and exploration progress.

import { EMBER_ISLAND } from '@lineremain/shared';
import React, { useMemo } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import GameIcon from '../common/GameIcon';

// ─── Constants ───

const HAVEN_BOUNDARY_X = 160; // chunks 0-9 = Haven, 10+ = Ember
const PORTAL_PROXIMITY_RADIUS = 30;
const TOTAL_ISLAND_CHUNKS = 100;

// ─── Pulse Animation (injected once) ───

const PULSE_KEYFRAMES = `
@keyframes islandHudPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

let styleInjected = false;
function injectPulseStyle(): void {
  if (styleInjected) return;
  const style = document.createElement('style');
  style.textContent = PULSE_KEYFRAMES;
  document.head.appendChild(style);
  styleInjected = true;
}

// ─── Styles ───

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  pointerEvents: 'none',
  zIndex: 100,
  contain: 'layout paint',
};

const badgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(0, 0, 0, 0.6)',
  padding: '5px 14px',
  borderRadius: 8,
  fontFamily: 'var(--font-ui)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-primary)',
  letterSpacing: '0.5px',
  backdropFilter: 'blur(4px)',
};

const indicatorBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  background: 'rgba(0, 0, 0, 0.6)',
  padding: '3px 10px',
  borderRadius: 6,
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  backdropFilter: 'blur(4px)',
};

const portalIndicatorStyle: React.CSSProperties = {
  ...indicatorBaseStyle,
  color: 'var(--accent)',
  border: '1px solid rgba(240, 165, 0, 0.3)',
  animation: 'islandHudPulse 2s ease-in-out infinite',
};

const explorationIndicatorStyle: React.CSSProperties = {
  ...indicatorBaseStyle,
  color: 'var(--text-secondary)',
};

// ─── Component ───

export const IslandHUD: React.FC = () => {
  const playerWorld = useGameStore((s) => s.playerWorld);
  const exploredChunks = useGameStore((s) => s.exploredIslandChunks);
  const position = usePlayerStore((s) => s.position);

  // Inject pulse CSS on first render
  React.useEffect(() => {
    injectPulseStyle();
  }, []);

  // Determine which island the player is on
  const isHaven = position.x < HAVEN_BOUNDARY_X;
  const islandName = isHaven ? 'Haven' : 'Ember Isle';

  // Check portal proximity (Ember Isle only)
  const portalDistance = useMemo(() => {
    const dx = position.x - EMBER_ISLAND.portalX;
    const dz = position.z - EMBER_ISLAND.portalZ;
    return Math.sqrt(dx * dx + dz * dz);
  }, [position.x, position.z]);

  const isNearPortal = !isHaven && portalDistance <= PORTAL_PROXIMITY_RADIUS;

  // Exploration percentage
  const explorationPercent = Math.min(
    100,
    Math.round((exploredChunks / TOTAL_ISLAND_CHUNKS) * 100),
  );

  if (playerWorld !== 'islands') return null;

  return (
    <div style={containerStyle}>
      {/* Island Name Badge */}
      <div style={badgeStyle}>
        <GameIcon
          name={isHaven ? 'island' : 'volcano'}
          size={16}
          color={isHaven ? 'var(--success)' : 'var(--danger)'}
        />
        {islandName}
      </div>

      {/* Portal Proximity Indicator */}
      {isNearPortal && (
        <div style={portalIndicatorStyle}>
          <GameIcon name="portal" size={14} color="var(--accent)" />
          Portal Nearby
        </div>
      )}

      {/* Exploration Progress */}
      <div style={explorationIndicatorStyle}>
        <GameIcon name="footprint" size={14} color="var(--text-secondary)" />
        {explorationPercent}% explored
      </div>
    </div>
  );
};
