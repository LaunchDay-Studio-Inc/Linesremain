// ─── Reconnect Overlay ───
// Shows a centered overlay when the client loses connection to the server.

import React from 'react';
import { useGameStore } from '../../stores/useGameStore';

export const ReconnectOverlay: React.FC = () => {
  const isConnected = useGameStore((s) => s.isConnected);
  const isOffline = useGameStore((s) => s.isOffline);
  const screen = useGameStore((s) => s.screen);

  // Only show when disconnected while actively playing (and not in offline mode)
  if (isConnected || isOffline || screen !== 'playing') return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 100,
        pointerEvents: 'all',
      }}
    >
      <div
        style={{
          color: '#fff',
          fontSize: '24px',
          fontFamily: 'var(--font-ui)',
          textAlign: 'center',
          padding: '32px 48px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      >
        <div style={{ marginBottom: '12px' }}>Connection lost</div>
        <div style={{ fontSize: '14px', opacity: 0.7 }}>Attempting to reconnect...</div>
      </div>
    </div>
  );
};
