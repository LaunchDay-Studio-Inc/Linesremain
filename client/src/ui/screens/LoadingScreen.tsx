// ─── Loading Screen ───

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';

export const LoadingScreen: React.FC = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 100;
        }
        const next = prev + Math.random() * 15 + 5;
        return Math.min(next, 100);
      });
    }, 150);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (progress >= 100 && !doneRef.current) {
      doneRef.current = true;
      const timeout = setTimeout(() => {
        setScreen('playing');
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [progress, setScreen]);

  const displayProgress = Math.min(Math.round(progress), 100);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h2 style={styles.title}>Loading world...</h2>

        <div style={styles.barOuter}>
          <div
            style={{
              ...styles.barInner,
              width: `${displayProgress}%`,
            }}
          />
        </div>

        <p style={styles.percentage}>{displayProgress}%</p>
      </div>
    </div>
  );
};

// ── Inline Styles ──

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-dark)',
    fontFamily: 'var(--font-ui)',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    width: '400px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
    margin: 0,
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  barOuter: {
    width: '100%',
    height: '6px',
    background: 'var(--border-subtle)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  barInner: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
    borderRadius: '3px',
    transition: 'width 0.2s ease-out',
  },
  percentage: {
    fontSize: '14px',
    color: 'var(--text-faint)',
    margin: 0,
    fontVariantNumeric: 'tabular-nums',
  },
};
