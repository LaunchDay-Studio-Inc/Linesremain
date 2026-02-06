// ─── App Root ───

import React, { useEffect, useRef } from 'react';
import { useGameStore } from './stores/useGameStore';
import { MainMenu } from './ui/screens/MainMenu';
import { LoadingScreen } from './ui/screens/LoadingScreen';
import { GameCanvas } from './ui/screens/GameCanvas';
import { DeathScreen } from './ui/screens/DeathScreen';
import { socketClient } from './network/SocketClient';
import { initializeMessageHandlers } from './network/MessageHandler';
import { startInputSender, stopInputSender } from './network/InputSender';

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
    if (screen === 'loading' && prevScreenRef.current === 'menu' && accessToken) {
      // Derive server URL from current page origin (same host)
      const serverUrl = window.location.origin;
      socketClient.connect(serverUrl, accessToken);
    }
    prevScreenRef.current = screen;
  }, [screen, accessToken]);

  // Start/stop input sender based on connection and screen state
  useEffect(() => {
    if (isConnected && (screen === 'playing' || screen === 'dead')) {
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
    default:
      return <MainMenu />;
  }
};