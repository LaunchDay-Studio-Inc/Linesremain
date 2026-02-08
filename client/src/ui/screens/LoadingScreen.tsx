// ─── Loading Screen ───
// Shows real loading progress driven by connection and snapshot events.

import { LOADING_TIPS } from '@shared/constants/monetization';
import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';

// ─── Component ───

export const LoadingScreen: React.FC = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const loadingProgress = useGameStore((s) => s.loadingProgress);
  const loadingStage = useGameStore((s) => s.loadingStage);
  const isOffline = useGameStore((s) => s.isOffline);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * LOADING_TIPS.length));
  const tipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  // Offline mode: auto-complete loading
  useEffect(() => {
    if (isOffline) {
      useGameStore.getState().setLoadingProgress(100, 'Ready.');
    }
  }, [isOffline]);

  // Rotate tips
  useEffect(() => {
    tipIntervalRef.current = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 3000);
    return () => {
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    };
  }, []);

  // Transition when progress hits 100
  useEffect(() => {
    if (loadingProgress >= 100 && !doneRef.current) {
      doneRef.current = true;
      const timeout = setTimeout(() => setScreen('playing'), 500);
      return () => clearTimeout(timeout);
    }
  }, [loadingProgress, setScreen]);

  const displayProgress = Math.min(Math.round(loadingProgress), 100);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #0A0A1A 0%, #1A1A3E 100%)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          width: '450px',
          padding: '40px',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <h1
            style={{
              fontSize: '48px',
              fontWeight: 900,
              letterSpacing: '10px',
              margin: 0,
              background: 'linear-gradient(180deg, #F0A500 0%, #FF6B35 50%, #C0392B 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 8px rgba(240, 165, 0, 0.3))',
            }}
          >
            LINEREMAIN
          </h1>
        </div>

        {/* Stage label */}
        <p
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            margin: 0,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          {loadingStage}
        </p>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: '4px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${displayProgress}%`,
              background: 'linear-gradient(90deg, #F0A500, #FF6B35)',
              borderRadius: '2px',
              transition: 'width 0.3s ease-out',
              boxShadow: '0 0 10px rgba(240, 165, 0, 0.4)',
            }}
          />
        </div>

        {/* Percentage */}
        <p
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.35)',
            margin: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {displayProgress}%
        </p>

        {/* Tip */}
        <div
          style={{
            marginTop: '40px',
            textAlign: 'center',
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'rgba(240, 165, 0, 0.5)',
              letterSpacing: '1px',
            }}
          >
            TIP:
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
            {LOADING_TIPS[tipIndex]}
          </span>
        </div>
      </div>
    </div>
  );
};
