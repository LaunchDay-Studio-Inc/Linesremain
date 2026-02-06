// ─── App Root ───

import React from 'react';
import { useGameStore } from './stores/useGameStore';
import { MainMenu } from './ui/screens/MainMenu';
import { LoadingScreen } from './ui/screens/LoadingScreen';
import { GameCanvas } from './ui/screens/GameCanvas';

export const App: React.FC = () => {
  const screen = useGameStore((s) => s.screen);

  switch (screen) {
    case 'menu':
      return <MainMenu />;
    case 'loading':
      return <LoadingScreen />;
    case 'playing':
    case 'dead':
      return <GameCanvas />;
    default:
      return <MainMenu />;
  }
};