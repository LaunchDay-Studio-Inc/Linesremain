// ─── Legacy Screen ───
// Cinematic transition shown on "true death" (line death).
// Displays lineage advancement, ancestor summary, and inherited resources.

import { ClientMessage, type RespawnPayload } from '@shared/types/network';
import React, { useEffect, useState } from 'react';
import { socketClient } from '../../network/SocketClient';
import { useGameStore } from '../../stores/useGameStore';

const GOLD = '#F0A500';
const GOLD_DIM = 'rgba(240,165,0,0.6)';
const GOLD_FAINT = 'rgba(240,165,0,0.25)';

export const LegacyScreen: React.FC = () => {
  const legacyData = useGameStore((s) => s.legacyData);
  const isConnected = useGameStore((s) => s.isConnected);

  const [phase, setPhase] = useState(0);
  const [respawning, setRespawning] = useState(false);

  // Staggered phase reveals
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 6000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleContinue = () => {
    if (respawning) return;
    setRespawning(true);

    if (isConnected) {
      const payload: RespawnPayload = { spawnOption: 'random' };
      socketClient.emit(ClientMessage.Respawn, payload);
    } else {
      useGameStore.getState().setScreen('playing');
    }

    // Clear legacy data
    useGameStore.getState().setLegacyData(null);

    setTimeout(() => setRespawning(false), 5000);
  };

  const handleDisconnect = () => {
    useGameStore.getState().setLegacyData(null);
    socketClient.disconnect();
    useGameStore.getState().setScreen('menu');
  };

  // Format seconds into days
  const formatDays = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
    const hours = Math.floor(seconds / 3600);
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const mins = Math.floor(seconds / 60);
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  };

  const generation = legacyData?.generation ?? 2;
  const ancestor = legacyData?.ancestorSummary;
  const inheritedXP = legacyData?.inheritedXP ?? 0;
  const inheritedBlueprints = legacyData?.inheritedBlueprints ?? 0;

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
      }}
    >
      {/* Black backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'grayscale(100%) brightness(0.2)',
          WebkitBackdropFilter: 'grayscale(100%) brightness(0.2)',
        }}
      />

      {/* Cinematic letterbox bars */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: '#000',
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: '#000',
          zIndex: 2,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          textAlign: 'center',
          fontFamily: 'var(--font-ui)',
          maxWidth: '600px',
          padding: '0 24px',
        }}
      >
        {/* Phase 1: "YOUR LINE CONTINUES" */}
        <h1
          style={{
            fontSize: '48px',
            fontWeight: 900,
            color: GOLD,
            letterSpacing: '10px',
            textShadow: `0 0 60px ${GOLD_DIM}, 0 0 120px ${GOLD_FAINT}, 0 4px 20px rgba(0,0,0,0.8)`,
            margin: 0,
            userSelect: 'none',
            textTransform: 'uppercase',
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 1.5s ease-out, transform 1.5s ease-out',
          }}
        >
          Your Line Continues
        </h1>

        {/* Phase 2: Generation number */}
        <div
          style={{
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? 'scale(1)' : 'scale(0.8)',
            transition: 'opacity 1s ease-out, transform 1s ease-out',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: GOLD_DIM,
              letterSpacing: '6px',
              textTransform: 'uppercase',
              margin: '0 0 8px',
              userSelect: 'none',
            }}
          >
            Generation
          </p>
          <p
            style={{
              fontSize: '72px',
              fontWeight: 900,
              color: GOLD,
              margin: 0,
              userSelect: 'none',
              textShadow: `0 0 40px ${GOLD_DIM}`,
              lineHeight: 1,
            }}
          >
            {generation}
          </p>
        </div>

        {/* Phase 3: Ancestor summary */}
        {ancestor && (
          <div
            style={{
              opacity: phase >= 3 ? 1 : 0,
              transform: phase >= 3 ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 1s ease-out 0.2s, transform 1s ease-out 0.2s',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <p
              style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.6)',
                margin: 0,
                userSelect: 'none',
                lineHeight: 1.6,
              }}
            >
              Your ancestor survived{' '}
              <span style={{ color: GOLD }}>{formatDays(ancestor.survivedSeconds)}</span>, killed{' '}
              <span style={{ color: GOLD }}>{ancestor.enemiesKilled}</span> creature
              {ancestor.enemiesKilled !== 1 ? 's' : ''}, and built{' '}
              <span style={{ color: GOLD }}>{ancestor.buildingsPlaced}</span> structure
              {ancestor.buildingsPlaced !== 1 ? 's' : ''}.
            </p>
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(255,200,200,0.5)',
                margin: 0,
                userSelect: 'none',
                fontStyle: 'italic',
              }}
            >
              Cause of death: {ancestor.causeOfDeath}
            </p>

            {/* Inheritance info */}
            <div
              style={{
                marginTop: '12px',
                padding: '12px 20px',
                background: 'rgba(240,165,0,0.08)',
                border: `1px solid rgba(240,165,0,0.2)`,
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'center',
                gap: '32px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    fontSize: '11px',
                    color: GOLD_FAINT,
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    margin: '0 0 4px',
                  }}
                >
                  Inherited XP
                </p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: GOLD, margin: 0 }}>
                  {inheritedXP.toLocaleString()}
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    fontSize: '11px',
                    color: GOLD_FAINT,
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    margin: '0 0 4px',
                  }}
                >
                  Blueprints
                </p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: GOLD, margin: 0 }}>
                  {inheritedBlueprints}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Phase 4: Continue button */}
        <div
          style={{
            opacity: phase >= 4 ? 1 : 0,
            transform: phase >= 4 ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 1s ease-out, transform 1s ease-out',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginTop: '12px',
            width: '320px',
          }}
        >
          <button
            style={{
              padding: '18px 24px',
              background: respawning
                ? 'rgba(240,165,0,0.2)'
                : `linear-gradient(135deg, ${GOLD}, #CC8800)`,
              border: 'none',
              borderRadius: '8px',
              color: respawning ? GOLD_DIM : '#000',
              fontSize: '16px',
              fontWeight: 700,
              cursor: respawning ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-ui)',
              boxShadow: respawning ? 'none' : `0 0 30px rgba(240,165,0,0.3)`,
              animation: respawning ? 'none' : 'legacyPulse 2s ease-in-out infinite',
              opacity: respawning ? 0.5 : 1,
            }}
            onClick={handleContinue}
            disabled={respawning}
          >
            {respawning ? 'CONTINUING...' : 'CONTINUE YOUR LINE'}
          </button>

          <button
            style={{
              padding: '10px',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.2)',
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
      </div>

      <style>{`
        @keyframes legacyPulse {
          0%, 100% { box-shadow: 0 0 30px rgba(240,165,0,0.3); }
          50% { box-shadow: 0 0 50px rgba(240,165,0,0.5); }
        }
      `}</style>
    </div>
  );
};
