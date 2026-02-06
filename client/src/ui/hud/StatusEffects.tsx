// ─── Status Effects ───

import React, { useState, useMemo } from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/hud.css';

interface StatusEffect {
  id: string;
  icon: string;
  label: string;
  active: boolean;
}

export const StatusEffects: React.FC = () => {
  const health = usePlayerStore((s) => s.health);
  const hunger = usePlayerStore((s) => s.hunger);
  const thirst = usePlayerStore((s) => s.thirst);
  const temperature = usePlayerStore((s) => s.temperature);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const activeEffects = useMemo<StatusEffect[]>(() => {
    const effects: StatusEffect[] = [
      { id: 'bleeding', icon: '🩸', label: 'Bleeding', active: health < 20 },
      { id: 'cold', icon: '🥶', label: 'Cold', active: temperature < 35 },
      { id: 'hot', icon: '🥵', label: 'Overheating', active: temperature > 39 },
      { id: 'starving', icon: '😫', label: 'Starving', active: hunger < 50 },
      { id: 'dehydrated', icon: '🏜️', label: 'Dehydrated', active: thirst < 25 },
      { id: 'wellfed', icon: '😊', label: 'Well Fed', active: hunger > 400 && thirst > 200 },
    ];
    return effects.filter((e) => e.active);
  }, [health, hunger, thirst, temperature]);

  if (activeEffects.length === 0) return null;

  return (
    <div className="status-effects">
      {activeEffects.map((effect) => (
        <div
          key={effect.id}
          className="status-effect"
          onMouseEnter={() => setHoveredId(effect.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {effect.icon}
          {hoveredId === effect.id && (
            <div className="status-effect__tooltip">{effect.label}</div>
          )}
        </div>
      ))}
    </div>
  );
};