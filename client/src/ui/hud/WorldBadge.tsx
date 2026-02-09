// ─── World Badge ───
// Displays a "MAIN WORLD" badge briefly after teleporting from the islands.

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import '../../styles/hud.css';
import { GameIcon } from '../common/GameIcon';

import type { PlayerWorldType } from '@lineremain/shared';

export const WorldBadge: React.FC = () => {
  const playerWorld = useGameStore((s) => s.playerWorld);
  const prevWorldRef = useRef<PlayerWorldType>(playerWorld);
  const [visible, setVisible] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const prevWorld = prevWorldRef.current;
    prevWorldRef.current = playerWorld;

    if (playerWorld === 'main' && prevWorld === 'islands') {
      setVisible(true);
      setAnimKey((k) => k + 1);

      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [playerWorld]);

  if (!visible) return null;

  return (
    <div className="world-badge" key={animKey}>
      <GameIcon name="compass" size={16} />
      <span>MAIN WORLD</span>
    </div>
  );
};
