// ─── Damage Direction ───

import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/hud.css';

interface DirectionIndicator {
  id: number;
  angle: number;
}

const MAX_INDICATORS = 3;
const INDICATOR_DURATION = 1500;

export const DamageDirection: React.FC = () => {
  const health = usePlayerStore((s) => s.health);
  const [indicators, setIndicators] = useState<DirectionIndicator[]>([]);
  const prevHealthRef = useRef(health);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Cleanup all pending timeouts on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const prev = prevHealthRef.current;
    prevHealthRef.current = health;

    // Trigger indicator when health decreases
    if (health < prev) {
      const id = Date.now();
      const angle = Math.floor(Math.random() * 360);

      setIndicators((curr) => {
        const next = [...curr, { id, angle }];
        // Keep only the most recent indicators up to the max
        if (next.length > MAX_INDICATORS) {
          return next.slice(next.length - MAX_INDICATORS);
        }
        return next;
      });

      // Remove indicator after duration
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setIndicators((curr) => curr.filter((ind) => ind.id !== id));
      }, INDICATOR_DURATION);
      timersRef.current.add(timer);
    }
  }, [health]);

  if (indicators.length === 0) return null;

  return (
    <>
      {indicators.map((indicator) => (
        <div className="dmg-dir" key={indicator.id}>
          <div className="dmg-dir__wedge" style={{ transform: `rotate(${indicator.angle}deg)` }} />
        </div>
      ))}
    </>
  );
};
