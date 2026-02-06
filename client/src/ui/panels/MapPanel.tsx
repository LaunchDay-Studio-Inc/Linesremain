// ─── Map Panel ───

import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/panels.css';

export const MapPanel: React.FC = () => {
  const mapOpen = useUIStore((s) => s.mapOpen);
  const toggleMap = useUIStore((s) => s.toggleMap);
  const position = usePlayerStore((s) => s.position);

  if (!mapOpen) return null;

  return (
    <div className="panel-backdrop" onClick={toggleMap}>
      <div className="panel map-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel__header">
          <span className="panel__title">Map</span>
          <button className="panel__close" onClick={toggleMap}>✕</button>
        </div>

        <div className="map-canvas-wrap">
          <div className="map-placeholder">MAP</div>

          {/* Player marker */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
              boxShadow: '0 0 8px var(--accent-glow)',
            }}
          />

          <div className="map-coords">
            {Math.round(position.x)}, {Math.round(position.y)}, {Math.round(position.z)}
          </div>
        </div>
      </div>
    </div>
  );
};