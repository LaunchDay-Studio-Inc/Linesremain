// ─── HUD Container ───

import React from 'react';
import '../../styles/hud.css';
import { ChatBox } from './ChatBox';
import { Crosshair } from './Crosshair';
import { DamageIndicator } from './DamageIndicator';
import { HealthBar } from './HealthBar';
import { Hotbar } from './Hotbar';
import { Minimap } from './Minimap';
import { PickupNotifications } from './PickupNotifications';
import { ReconnectOverlay } from './ReconnectOverlay';
import { StatusEffects } from './StatusEffects';
import { JournalPanel } from '../panels/JournalPanel';

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
      <PickupNotifications />
      <ReconnectOverlay />
      <JournalPanel />
    </div>
  );
};
