// ─── Crosshair ───

import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import '../../styles/hud.css';

export const Crosshair: React.FC = () => {
  const cursorLocked = useUIStore((s) => s.cursorLocked);

  if (!cursorLocked) return null;

  return (
    <div className="crosshair">
      <div className="crosshair__line crosshair__line--top" />
      <div className="crosshair__line crosshair__line--bottom" />
      <div className="crosshair__line crosshair__line--left" />
      <div className="crosshair__line crosshair__line--right" />
    </div>
  );
};