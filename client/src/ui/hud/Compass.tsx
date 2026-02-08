// ─── Compass ───
// Horizontal compass strip showing cardinal/intercardinal directions and degree heading.

import React from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/hud.css';

// ─── Constants ───

const COMPASS_WIDTH = 220; // visible strip width in pixels
const STRIP_TOTAL = 360; // degrees in full rotation
const PX_PER_DEGREE = 2; // pixels per degree of rotation

// Cardinal and intercardinal directions at their degree positions
// 0° = North, 90° = East, 180° = South, 270° = West
const DIRECTIONS: { degree: number; label: string; major: boolean }[] = [
  { degree: 0, label: 'N', major: true },
  { degree: 45, label: 'NE', major: false },
  { degree: 90, label: 'E', major: true },
  { degree: 135, label: 'SE', major: false },
  { degree: 180, label: 'S', major: true },
  { degree: 225, label: 'SW', major: false },
  { degree: 270, label: 'W', major: true },
  { degree: 315, label: 'NW', major: false },
];

// ─── Component ───

export const Compass: React.FC = () => {
  const yaw = usePlayerStore((s) => s.yaw);

  // Normalize yaw to 0-360 range
  const heading = ((yaw % 360) + 360) % 360;

  // Build visible direction markers
  const markers: { px: number; label: string; major: boolean }[] = [];

  for (const dir of DIRECTIONS) {
    // Calculate offset from current heading
    let diff = dir.degree - heading;

    // Wrap around -180..180
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const px = diff * PX_PER_DEGREE + COMPASS_WIDTH / 2;

    // Only include if within visible strip
    if (px >= -20 && px <= COMPASS_WIDTH + 20) {
      markers.push({ px, label: dir.label, major: dir.major });
    }
  }

  // Generate tick marks every 15 degrees
  const ticks: { px: number; major: boolean }[] = [];
  for (let deg = 0; deg < 360; deg += 15) {
    let diff = deg - heading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const px = diff * PX_PER_DEGREE + COMPASS_WIDTH / 2;
    if (px >= 0 && px <= COMPASS_WIDTH) {
      ticks.push({ px, major: deg % 90 === 0 });
    }
  }

  return (
    <div className="compass">
      <div className="compass__strip">
        {/* Tick marks */}
        {ticks.map((tick, i) => (
          <div
            key={`t${i}`}
            className={`compass__tick ${tick.major ? 'compass__tick--major' : ''}`}
            style={{ left: tick.px }}
          />
        ))}

        {/* Direction labels */}
        {markers.map((m) => (
          <span
            key={m.label}
            className={`compass__label ${m.major ? 'compass__label--major' : ''}`}
            style={{ left: m.px }}
          >
            {m.label}
          </span>
        ))}

        {/* Center indicator */}
        <div className="compass__center" />
      </div>

      <span className="compass__heading">{Math.round(heading)}°</span>
    </div>
  );
};
