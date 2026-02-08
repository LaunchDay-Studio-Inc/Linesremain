// ─── Main Menu Screen ───
// Polished main menu with parallax background, gradient title, and full navigation.

import React, { useEffect, useRef, useState } from 'react';
import { musicSystem } from '../../engine/MusicSystem';
import { useAchievementStore } from '../../stores/useAchievementStore';
import { useGameStore } from '../../stores/useGameStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useUIStore } from '../../stores/useUIStore';

type AuthMode = 'login' | 'register';
type MenuView = 'auth' | 'main';

interface AuthSuccessResponse {
  accessToken: string;
  refreshToken: string;
  player: {
    id: string;
    username: string;
    customization: unknown;
  };
}

interface AuthErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

type AuthResponse = AuthSuccessResponse | AuthErrorResponse;

function isErrorResponse(res: AuthResponse): res is AuthErrorResponse {
  return 'error' in res;
}

// ─── Parallax Background ───

const ParallaxBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let animId: number;
    const draw = () => {
      time += 0.002;
      const w = canvas.width;
      const h = canvas.height;

      // Sky gradient (day/night cycle)
      const cycle = (Math.sin(time * 2) + 1) / 2;
      const skyR1 = Math.round(10 + 30 * cycle);
      const skyG1 = Math.round(10 + 90 * cycle);
      const skyB1 = Math.round(30 + 150 * cycle);
      const skyR2 = Math.round(20 + 100 * cycle);
      const skyG2 = Math.round(15 + 145 * cycle);
      const skyB2 = Math.round(40 + 180 * cycle);
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, `rgb(${skyR1},${skyG1},${skyB1})`);
      grad.addColorStop(1, `rgb(${skyR2},${skyG2},${skyB2})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Stars (visible at night)
      const starAlpha = Math.max(0, 1 - cycle * 2);
      if (starAlpha > 0) {
        ctx.fillStyle = `rgba(255,255,255,${starAlpha * 0.8})`;
        for (let i = 0; i < 60; i++) {
          const sx = (i * 137.5 + time * 5) % w;
          const sy = (i * 97.3) % (h * 0.5);
          ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
        }
      }

      // Clouds
      ctx.fillStyle = `rgba(200,210,230,${0.15 + cycle * 0.15})`;
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 300 + time * 30) % (w + 200)) - 100;
        const cy = 60 + i * 40;
        const s = 60 + i * 10;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
        ctx.arc(cx + s * 0.35, cy - s * 0.15, s * 0.4, 0, Math.PI * 2);
        ctx.arc(cx + s * 0.7, cy, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mountains (back layer)
      const mAlpha = cycle;
      ctx.fillStyle = `rgb(${Math.round(30 + 30 * mAlpha)},${Math.round(30 + 50 * mAlpha)},${Math.round(50 + 50 * mAlpha)})`;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) {
        const y =
          h * 0.45 -
          (Math.sin((x + time * 8) * 0.003) * 60 +
            Math.sin((x + time * 8) * 0.008) * 40 +
            Math.sin((x + time * 8) * 0.002) * 50) *
            0.6;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Mountains (front layer)
      ctx.fillStyle = `rgb(${Math.round(20 + 25 * mAlpha)},${Math.round(25 + 40 * mAlpha)},${Math.round(35 + 40 * mAlpha)})`;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) {
        const y =
          h * 0.55 -
          (Math.sin((x + time * 15) * 0.004) * 50 +
            Math.sin((x + time * 15) * 0.01) * 30 +
            Math.sin((x + time * 15) * 0.0025) * 45) *
            0.8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Trees
      ctx.fillStyle = `rgb(${Math.round(15 + 10 * mAlpha)},${Math.round(20 + 30 * mAlpha)},${Math.round(25 + 5 * mAlpha)})`;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const treeH =
          20 + Math.sin((x + time * 25) * 0.08) * 15 + Math.sin((x + time * 25) * 0.2) * 8;
        ctx.lineTo(x, h * 0.65 - Math.max(0, treeH));
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Ground
      ctx.fillStyle = `rgb(${Math.round(10 + 20 * mAlpha)},${Math.round(12 + 28 * mAlpha)},${Math.round(18 + 7 * mAlpha)})`;
      ctx.fillRect(0, h * 0.78, w, h * 0.22);

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
};

// ─── Component ───

export const MainMenu: React.FC = () => {
  const setAuth = useGameStore((s) => s.setAuth);
  const setScreen = useGameStore((s) => s.setScreen);
  const playerName = useGameStore((s) => s.playerName);
  const accessToken = useGameStore((s) => s.accessToken);

  const [mode, setMode] = useState<AuthMode>('login');
  const [view, setView] = useState<MenuView>(accessToken ? 'main' : 'auth');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) setView('main');
  }, [accessToken]);

  // Start menu music on mount
  useEffect(() => {
    const settings = useSettingsStore.getState();
    musicSystem.setVolume(settings.musicVolume / 100);
    musicSystem.setEnabled(settings.musicEnabled);
    musicSystem.setMood('menu');
    // Init on first click (AudioContext requires user gesture)
    const initAudio = () => {
      musicSystem.init();
      musicSystem.setMood('menu');
    };
    window.addEventListener('click', initAudio, { once: true });
    // Drive music system updates on menu screen
    let lastTime = performance.now();
    let rafId: number;
    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      musicSystem.update(dt);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('click', initAudio);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { username, email, password };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as AuthResponse;
      if (!res.ok || isErrorResponse(json)) {
        setError(isErrorResponse(json) ? json.error.message : 'Authentication failed');
        return;
      }
      setAuth(json.accessToken, json.player.username);
      setView('main');
    } catch {
      setError('Server unavailable. Use "Play Offline" below.');
    } finally {
      setLoading(false);
    }
  };

  const menuButtons = [
    { id: 'play', label: 'PLAY', primary: true },
    { id: 'settings', label: 'SETTINGS', primary: false },
    { id: 'leaderboard', label: 'LEADERBOARD', primary: false },
    { id: 'achievements', label: 'ACHIEVEMENTS', primary: false },
  ];

  const handleMenuClick = (id: string) => {
    if (id === 'play') {
      const customization = useAchievementStore.getState().customization;
      if (customization.bodyType) {
        setScreen('loading');
      } else {
        setScreen('character-select');
      }
    } else if (id === 'settings') {
      useUIStore.getState().toggleSettings();
    } else if (id === 'leaderboard') {
      useUIStore.getState().toggleLeaderboard();
    } else if (id === 'achievements') {
      useUIStore.getState().toggleAchievements();
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '12px 16px',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e0e0e0',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'var(--font-ui)',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', fontFamily: 'var(--font-ui)' }}>
      <ParallaxBackground />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '16px',
        }}
      >
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h1
            style={{
              fontSize: '80px',
              fontWeight: 900,
              letterSpacing: '12px',
              background: 'linear-gradient(180deg, #F0A500 0%, #FF6B35 50%, #C0392B 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              userSelect: 'none',
              filter: 'drop-shadow(0 4px 12px rgba(240, 165, 0, 0.4))',
              animation: 'titlePulse 4s ease-in-out infinite',
            }}
          >
            LINEREMAIN
          </h1>
          <p
            style={{
              fontSize: '16px',
              letterSpacing: '6px',
              color: '#A08060',
              textTransform: 'uppercase',
              margin: '8px 0 0',
              userSelect: 'none',
            }}
          >
            DRAW YOUR LAST LINE
          </p>
        </div>

        {view === 'auth' ? (
          <div
            style={{
              background: 'rgba(10, 10, 20, 0.85)',
              border: '1px solid rgba(240, 165, 0, 0.2)',
              borderRadius: '12px',
              padding: '32px',
              width: '360px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '24px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '8px',
                padding: '4px',
              }}
            >
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: 'none',
                    borderRadius: '6px',
                    background: mode === m ? 'rgba(240,165,0,0.2)' : 'transparent',
                    color: mode === m ? '#F0A500' : 'rgba(255,255,255,0.4)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'var(--font-ui)',
                    textTransform: 'capitalize',
                  }}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {mode === 'register' && (
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={inputStyle}
                  required
                  minLength={3}
                  maxLength={20}
                  autoComplete="username"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                required
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {mode === 'register' && (
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={inputStyle}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              )}
              {error && (
                <p style={{ color: '#E74C3C', fontSize: '13px', margin: 0, textAlign: 'center' }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                style={{
                  padding: '14px',
                  background: 'linear-gradient(135deg, #F0A500, #E09400)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#0A0A14',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '8px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-ui)',
                }}
                disabled={loading}
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Enter World' : 'Create Account'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0 16px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              <span
                style={{
                  padding: '0 12px',
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: '13px',
                  letterSpacing: '2px',
                }}
              >
                OR
              </span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <button
              style={{
                width: '100%',
                padding: '14px',
                background:
                  hoveredBtn === 'offline' ? 'rgba(240,165,0,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${hoveredBtn === 'offline' ? '#F0A500' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '8px',
                color: hoveredBtn === 'offline' ? '#F0A500' : 'rgba(255,255,255,0.4)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-ui)',
              }}
              onMouseEnter={() => setHoveredBtn('offline')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => {
                useGameStore.getState().setOffline(true);
                const customization = useAchievementStore.getState().customization;
                if (customization.bodyType) {
                  setScreen('playing');
                } else {
                  setScreen('character-select');
                }
              }}
            >
              Play Offline
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              width: '320px',
              alignItems: 'center',
            }}
          >
            {playerName && (
              <p
                style={{
                  color: 'rgba(240,165,0,0.8)',
                  fontSize: '14px',
                  letterSpacing: '2px',
                  margin: '0 0 12px',
                  textTransform: 'uppercase',
                }}
              >
                Welcome, {playerName}
              </p>
            )}
            {menuButtons.map((btn) => (
              <button
                key={btn.id}
                style={{
                  width: '100%',
                  padding: btn.primary ? '18px 24px' : '14px 24px',
                  background: btn.primary
                    ? 'linear-gradient(135deg, #F0A500, #E09400)'
                    : hoveredBtn === btn.id
                      ? 'rgba(240,165,0,0.15)'
                      : 'rgba(10, 10, 20, 0.7)',
                  border: btn.primary
                    ? 'none'
                    : `1px solid ${hoveredBtn === btn.id ? 'rgba(240,165,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '8px',
                  color: btn.primary
                    ? '#0A0A14'
                    : hoveredBtn === btn.id
                      ? '#F0A500'
                      : 'rgba(255,255,255,0.7)',
                  fontSize: btn.primary ? '18px' : '14px',
                  fontWeight: btn.primary ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  letterSpacing: btn.primary ? '3px' : '2px',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-ui)',
                  backdropFilter: 'blur(4px)',
                }}
                onMouseEnter={() => setHoveredBtn(btn.id)}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => handleMenuClick(btn.id)}
              >
                {btn.label}
              </button>
            ))}
            <button
              style={{
                marginTop: '12px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.3)',
                fontSize: '12px',
                cursor: 'pointer',
                letterSpacing: '1px',
                fontFamily: 'var(--font-ui)',
              }}
              onClick={() => {
                useGameStore.getState().logout();
                setView('auth');
              }}
            >
              Log Out
            </button>
          </div>
        )}

        <p
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '24px',
            color: 'rgba(255,255,255,0.15)',
            fontSize: '11px',
            margin: 0,
          }}
        >
          v0.4.0
        </p>
      </div>

      <style>{`
        @keyframes titlePulse {
          0%, 100% { filter: drop-shadow(0 4px 12px rgba(240, 165, 0, 0.3)); }
          50% { filter: drop-shadow(0 4px 20px rgba(240, 165, 0, 0.6)); }
        }
      `}</style>
    </div>
  );
};
