// ─── Death Screen ───
// Overlay shown when the player dies. Offers respawn options.

import React, { useState } from 'react';
import { socketClient } from '../../network/SocketClient';
import { useGameStore } from '../../stores/useGameStore';
import { ClientMessage, type RespawnPayload } from '@shared/types/network';

export const DeathScreen: React.FC = () => {
  const [respawning, setRespawning] = useState(false);
  const isConnected = useGameStore((s) => s.isConnected);

  const handleRespawn = (option: 'random' | 'bag') => {
    if (respawning) return;
    setRespawning(true);

    if (isConnected) {
      const payload: RespawnPayload = { spawnOption: option };
      socketClient.emit(ClientMessage.Respawn, payload);
    } else {
      // Offline mode: just go back to playing
      useGameStore.getState().setScreen('playing');
    }

    // Reset after a timeout in case server doesn't respond
    setTimeout(() => setRespawning(false), 5000);
  };

  const handleDisconnect = () => {
    socketClient.disconnect();
    useGameStore.getState().setScreen('menu');
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.vignette} />

      <div style={styles.content}>
        <h1 style={styles.title}>YOU DIED</h1>
        <p style={styles.subtitle}>Your body has been left in the world.</p>

        <div style={styles.buttons}>
          <button
            style={{
              ...styles.respawnBtn,
              ...(respawning ? styles.btnDisabled : {}),
            }}
            onClick={() => handleRespawn('random')}
            disabled={respawning}
          >
            {respawning ? 'Respawning...' : 'Respawn Random'}
          </button>

          <button
            style={{
              ...styles.bagBtn,
              ...(respawning ? styles.btnDisabled : {}),
            }}
            onClick={() => handleRespawn('bag')}
            disabled={respawning}
          >
            Respawn at Sleeping Bag
          </button>

          <button
            style={styles.disconnectBtn}
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Inline Styles ──

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    pointerEvents: 'auto',
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center, rgba(80,0,0,0.6) 0%, rgba(30,0,0,0.85) 100%)',
    pointerEvents: 'none',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    textAlign: 'center',
  },
  title: {
    fontSize: '72px',
    fontWeight: 900,
    color: '#CC3333',
    letterSpacing: '12px',
    textShadow: '0 0 60px rgba(200,0,0,0.6), 0 4px 20px rgba(0,0,0,0.8)',
    margin: 0,
    userSelect: 'none',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-ui)',
  },
  subtitle: {
    fontSize: '16px',
    color: 'rgba(255,200,200,0.7)',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    margin: 0,
    userSelect: 'none',
    fontFamily: 'var(--font-ui)',
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px',
    width: '320px',
  },
  respawnBtn: {
    padding: '16px 24px',
    background: 'linear-gradient(135deg, #CC3333, #993333)',
    border: 'none',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-ui)',
  },
  bagBtn: {
    padding: '14px 24px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: 'rgba(255,200,200,0.9)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-ui)',
  },
  disconnectBtn: {
    padding: '12px 24px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: 'rgba(255,200,200,0.5)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginTop: '8px',
    fontFamily: 'var(--font-ui)',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};