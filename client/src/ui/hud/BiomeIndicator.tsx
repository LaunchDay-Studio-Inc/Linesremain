// ─── Biome Indicator ───
// Displays the current biome name as a subtle HUD overlay.

import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';

export const BiomeIndicator: React.FC = () => {
  const currentBiome = usePlayerStore((s) => s.currentBiome);
  const [displayBiome, setDisplayBiome] = useState(currentBiome);
  const [opacity, setOpacity] = useState(0);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Fade in new biome name
    setDisplayBiome(currentBiome);
    setOpacity(1);

    // Fade out after 3 seconds
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setOpacity(0.4);
    }, 3000);

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [currentBiome]);

  if (!displayBiome) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 36,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.4)',
        color: '#ddd',
        fontFamily: 'monospace',
        fontSize: '11px',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        padding: '3px 10px',
        borderRadius: '3px',
        pointerEvents: 'none',
        opacity,
        transition: 'opacity 1s ease',
        zIndex: 100,
      }}
    >
      {displayBiome}
    </div>
  );
};
