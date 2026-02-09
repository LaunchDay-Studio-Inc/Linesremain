// ─── World Transition ───
// Renders a full-screen white flash when the player teleports between worlds.

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import '../../styles/hud.css';

import type { PlayerWorldType } from '@lineremain/shared';

export const WorldTransition: React.FC = () => {
  const playerWorld = useGameStore((s) => s.playerWorld);
  const prevWorldRef = useRef<PlayerWorldType>(playerWorld);
  const isFirstRender = useRef(true);
  const [visible, setVisible] = useState(false);
  const [transitionKey, setTransitionKey] = useState(0);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const prevWorld = prevWorldRef.current;
    prevWorldRef.current = playerWorld;

    if (playerWorld !== prevWorld) {
      setVisible(true);
      setTransitionKey((k) => k + 1);

      const timer = setTimeout(() => {
        setVisible(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [playerWorld]);

  if (!visible) return null;

  return (
    <div className="world-transition" key={transitionKey}>
      <div className="world-transition__flash" />
    </div>
  );
};
