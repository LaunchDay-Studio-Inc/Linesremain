// ─── Progress Bar Component ───

import React from 'react';
import '../../styles/panels.css';

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  label?: string;
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  color = 'var(--accent)',
  label,
  animated = true,
}) => {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div>
      {label && <div className="progress-bar__label">{label}</div>}
      <div className="progress-bar">
        <div
          className="progress-bar__fill"
          style={{
            width: `${clampedValue}%`,
            background: color,
            transition: animated ? 'width 0.3s ease' : 'none',
          }}
        />
      </div>
    </div>
  );
};