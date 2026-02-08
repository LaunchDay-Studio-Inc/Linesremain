// ─── Death Screen ───
// Thematic death overlay: "YOUR LINE ENDS HERE"

import { ClientMessage, type RespawnPayload } from '@shared/types/network';
import React, { useEffect, useState } from 'react';
import { socketClient } from '../../network/SocketClient';
import { useGameStore } from '../../stores/useGameStore';

export const DeathScreen: React.FC = () => {
  const [respawning, setRespawning] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const isConnected = useGameStore((s) => s.isConnected);

  useEffect(() => {
    const timer = setTimeout(() => setFadeIn(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const handleRespawn = (option: 'random' | 'bag') => {
    if (respawning) return;
    setRespawning(true);

    if (isConnected) {
      const payload: RespawnPayload = { spawnOption: option };
      socketClient.emit(ClientMessage.Respawn, payload);
    } else {
      useGameStore.getState().setScreen('playing');
    }

    setTimeout(() => setRespawning(false), 5000);
  };

  const handleDisconnect = () => {
    socketClient.disconnect();
    useGameStore.getState().setScreen('menu');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        pointerEvents: 'auto',
        opacity: fadeIn ? 1 : 0,
        transition: 'opacity 1.5s ease-in',
      }}
    >
      {/* Grayscale + desaturation filter on game behind */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backdropFilter: 'grayscale(80%) brightness(0.4)',
          WebkitBackdropFilter: 'grayscale(80%) brightness(0.4)',
        }}
      />

      {/* Red vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(80,0,0,0.3) 0%, rgba(40,0,0,0.85) 100%)',
          pointerEvents: 'none',
          animation: 'vignetteBreath 3s ease-in-out infinite',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          textAlign: 'center',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontSize: '64px',
            fontWeight: 900,
            color: '#CC3333',
            letterSpacing: '8px',
            textShadow:
              '0 0 60px rgba(200,0,0,0.6), 0 0 120px rgba(200,0,0,0.3), 0 4px 20px rgba(0,0,0,0.8)',
            margin: 0,
            userSelect: 'none',
            textTransform: 'uppercase',
          }}
        >
          YOUR LINE ENDS HERE
        </h1>

        {/* Death cause */}
        <p
          style={{
            fontSize: '16px',
            color: 'rgba(255,180,180,0.7)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            margin: 0,
            userSelect: 'none',
          }}
        >
          The world claimed another soul.
        </p>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginTop: '24px',
            width: '320px',
          }}
        >
          <button
            style={{
              padding: '18px 24px',
              background: respawning
                ? 'rgba(200,150,50,0.3)'
                : 'linear-gradient(135deg, #CC6600, #CC3333)',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 700,
              cursor: respawning ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-ui)',
              boxShadow: respawning ? 'none' : '0 0 20px rgba(200,100,0,0.3)',
              animation: respawning ? 'none' : 'respawnPulse 2s ease-in-out infinite',
              opacity: respawning ? 0.5 : 1,
            }}
            onClick={() => handleRespawn('random')}
            disabled={respawning}
          >
            {respawning ? 'RESPAWNING...' : 'RESPAWN'}
          </button>

          <button
            style={{
              padding: '14px 24px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: 'rgba(255,200,200,0.8)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: respawning ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-ui)',
              opacity: respawning ? 0.5 : 1,
            }}
            onClick={() => handleRespawn('bag')}
            disabled={respawning}
          >
            Respawn at Sleeping Bag
          </button>

          <button
            style={{
              padding: '10px',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,200,200,0.35)',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-ui)',
              marginTop: '4px',
            }}
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>

        {/* Footer text */}
        <p
          style={{
            fontSize: '12px',
            color: 'rgba(255,200,200,0.25)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            margin: '16px 0 0',
            userSelect: 'none',
            fontStyle: 'italic',
          }}
        >
          Everything you carried now lies where you fell.
        </p>
      </div>

      <style>{`
        @keyframes vignetteBreath {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        @keyframes respawnPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(200,100,0,0.3); }
          50% { box-shadow: 0 0 30px rgba(200,100,0,0.5); }
        }
      `}</style>
    </div>
  );
};
