// ─── Damage Indicator ───

import React, { useEffect, useState, useRef } from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/hud.css';

export const DamageIndicator: React.FC = () => {
  const health = usePlayerStore((s) => s.health);
  const [flashes, setFlashes] = useState<number[]>([]);
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

    // Trigger flash when health decreases
    if (health < prev) {
      const id = Date.now();
      setFlashes((f) => [...f, id]);

      // Remove flash after animation completes
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setFlashes((f) => f.filter((fId) => fId !== id));
      }, 500);
      timersRef.current.add(timer);
    }
  }, [health]);

  if (flashes.length === 0) return null;

  return (
    <div className="damage-indicator">
      {flashes.map((id) => (
        <div key={id} className="damage-vignette" />
      ))}
    </div>
  );
};