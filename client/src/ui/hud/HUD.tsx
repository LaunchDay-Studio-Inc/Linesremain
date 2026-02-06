// ─── HUD Container ───

import React from 'react';
import { HealthBar } from './HealthBar';
import { Hotbar } from './Hotbar';
import { Minimap } from './Minimap';
import { Crosshair } from './Crosshair';
import { ChatBox } from './ChatBox';
import { StatusEffects } from './StatusEffects';
import { DamageIndicator } from './DamageIndicator';
import '../../styles/hud.css';

export const HUD: React.FC = () => {
  return (
    <div className="hud-container">
      <HealthBar />
      <Hotbar />
      <Minimap />
      <Crosshair />
      <ChatBox />
      <StatusEffects />
      <DamageIndicator />
    </div>
  );
};