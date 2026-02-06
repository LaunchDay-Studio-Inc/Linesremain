// ─── Health Bars ───

import React from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import {
  MAX_HEALTH,
  MAX_HUNGER,
  MAX_THIRST,
} from '@shared/constants/survival';
import '../../styles/hud.css';

export const HealthBar: React.FC = () => {
  const health = usePlayerStore((s) => s.health);
  const hunger = usePlayerStore((s) => s.hunger);
  const thirst = usePlayerStore((s) => s.thirst);
  const temperature = usePlayerStore((s) => s.temperature);

  const healthPct = Math.max(0, Math.min(100, (health / MAX_HEALTH) * 100));
  const hungerPct = Math.max(0, Math.min(100, (hunger / MAX_HUNGER) * 100));
  const thirstPct = Math.max(0, Math.min(100, (thirst / MAX_THIRST) * 100));

  // Temperature: map 30-44 range to 0-100 display
  const tempNorm = Math.max(0, Math.min(100, ((temperature - 30) / 14) * 100));
  const tempClass =
    temperature < 35
      ? 'stat-bar__fill--temp-cold'
      : temperature > 39
        ? 'stat-bar__fill--temp-hot'
        : 'stat-bar__fill--temp-normal';

  return (
    <div className="health-bars">
      <StatBar
        icon="❤️"
        pct={healthPct}
        fillClass="stat-bar__fill--health"
        label={`${Math.round(health)}/${MAX_HEALTH}`}
        low={healthPct < 25}
      />
      <StatBar
        icon="🍗"
        pct={hungerPct}
        fillClass="stat-bar__fill--hunger"
        label={`${Math.round(hunger)}/${MAX_HUNGER}`}
        low={hungerPct < 25}
      />
      <StatBar
        icon="💧"
        pct={thirstPct}
        fillClass="stat-bar__fill--thirst"
        label={`${Math.round(thirst)}/${MAX_THIRST}`}
        low={thirstPct < 25}
      />
      <StatBar
        icon="🌡️"
        pct={tempNorm}
        fillClass={tempClass}
        label={`${temperature.toFixed(1)}°C`}
        low={temperature < 35 || temperature > 39}
      />
    </div>
  );
};

// ─── Individual Stat Bar ───

interface StatBarProps {
  icon: string;
  pct: number;
  fillClass: string;
  label: string;
  low: boolean;
}

const StatBar: React.FC<StatBarProps> = ({ icon, pct, fillClass, label, low }) => (
  <div className={`stat-bar${low ? ' stat-bar--low' : ''}`}>
    <span className="stat-bar__icon">{icon}</span>
    <div className="stat-bar__track">
      <div className={`stat-bar__fill ${fillClass}`} style={{ width: `${pct}%` }} />
      <span className="stat-bar__label">{label}</span>
    </div>
  </div>
);