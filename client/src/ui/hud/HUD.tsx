// ─── HUD Container ───

import React from 'react';
import '../../styles/hud.css';
import { AchievementPanel } from '../panels/AchievementPanel';
import { CustomizationPanel } from '../panels/CustomizationPanel';
import { JournalPanel } from '../panels/JournalPanel';
import { LeaderboardPanel } from '../panels/LeaderboardPanel';
import { AchievementToast } from './AchievementToast';
import { BiomeIndicator } from './BiomeIndicator';
import { ChatBox } from './ChatBox';
import { Compass } from './Compass';
import { Crosshair } from './Crosshair';
import { DamageIndicator } from './DamageIndicator';
import { HealthBar } from './HealthBar';
import { Hotbar } from './Hotbar';
import { IslandHUD } from './IslandHUD';
import { IslandMinimap } from './IslandMinimap';
import { LevelUpNotification } from './LevelUpNotification';
import { Minimap } from './Minimap';
import { NotificationToast } from './NotificationToast';
import { PickupNotifications } from './PickupNotifications';
import { RaidAlertPanel } from './RaidAlertPanel';
import { ReconnectOverlay } from './ReconnectOverlay';
import { StatusEffects } from './StatusEffects';
import { TutorialOverlay } from './TutorialOverlay';
import { WipeWarningHUD } from './WipeWarningHUD';
import { XPBar } from './XPBar';

export const HUD: React.FC = () => {
  return (
    <div className="hud-container">
      <HealthBar />
      <Hotbar />
      <XPBar />
      <Minimap />
      <Crosshair />
      <Compass />
      <BiomeIndicator />
      <ChatBox />
      <StatusEffects />
      <DamageIndicator />
      <PickupNotifications />
      <ReconnectOverlay />
      <AchievementToast />
      <LevelUpNotification />
      <TutorialOverlay />
      <RaidAlertPanel />
      <WipeWarningHUD />
      <JournalPanel />
      <AchievementPanel />
      <CustomizationPanel />
      <LeaderboardPanel />
      <NotificationToast />
      <IslandHUD />
      <IslandMinimap />
    </div>
  );
};
