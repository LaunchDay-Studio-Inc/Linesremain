// ─── App Root ───

import React, { useEffect, useRef } from 'react';
import { startInputSender, stopInputSender } from './network/InputSender';
import { initializeMessageHandlers } from './network/MessageHandler';
import { socketClient } from './network/SocketClient';
import { useGameStore } from './stores/useGameStore';
import { CharacterSelect } from './ui/screens/CharacterSelect';
import { DeathScreen } from './ui/screens/DeathScreen';
import { GameCanvas } from './ui/screens/GameCanvas';
import { LegacyScreen } from './ui/screens/LegacyScreen';
import { LoadingScreen } from './ui/screens/LoadingScreen';
import { MainMenu } from './ui/screens/MainMenu';

// ─── Network Initialization ───

let networkInitialized = false;

function initializeNetwork(): void {
  if (networkInitialized) return;
  networkInitialized = true;
  initializeMessageHandlers();
}

export const App: React.FC = () => {
  const screen = useGameStore((s) => s.screen);
  const isConnected = useGameStore((s) => s.isConnected);
  const accessToken = useGameStore((s) => s.accessToken);
  const prevScreenRef = useRef(screen);

  // Initialize message handlers once on mount
  useEffect(() => {
    initializeNetwork();
  }, []);

  // Connect to server when transitioning to 'loading' with a valid token
  useEffect(() => {
    if (
      screen === 'loading' &&
      (prevScreenRef.current === 'menu' || prevScreenRef.current === 'character-select') &&
      accessToken
    ) {
      // Derive server URL from current page origin (same host)
      const serverUrl = window.location.origin;
      socketClient.connect(serverUrl, accessToken);
    }
    prevScreenRef.current = screen;
  }, [screen, accessToken]);

  // Start/stop input sender based on connection and screen state
  useEffect(() => {
    if (isConnected && (screen === 'playing' || screen === 'dead' || screen === 'legacy')) {
      startInputSender();
      return () => {
        stopInputSender();
      };
    }
  }, [isConnected, screen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopInputSender();
      socketClient.disconnect();
    };
  }, []);

  switch (screen) {
    case 'menu':
      return <MainMenu />;
    case 'character-select':
      return <CharacterSelect />;
    case 'loading':
      return <LoadingScreen />;
    case 'playing':
      return <GameCanvas />;
    case 'dead':
      return (
        <>
          <GameCanvas />
          <DeathScreen />
        </>
      );
    case 'legacy':
      return (
        <>
          <GameCanvas />
          <LegacyScreen />
        </>
      );
    default:
      return <MainMenu />;
  }
};
