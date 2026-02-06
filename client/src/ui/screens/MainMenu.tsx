// ─── Main Menu Screen ───

import React, { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';

type AuthMode = 'login' | 'register';

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

export const MainMenu: React.FC = () => {
  const setAuth = useGameStore((s) => s.setAuth);
  const setScreen = useGameStore((s) => s.setScreen);

  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const body =
        mode === 'login'
          ? { email, password }
          : { username, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as AuthResponse;

      if (!res.ok || isErrorResponse(json)) {
        const msg = isErrorResponse(json) ? json.error.message : 'Authentication failed';
        setError(msg);
        return;
      }

      setAuth(json.accessToken, json.player.username);
      setScreen('loading');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.overlay} />

      <div style={styles.content}>
        {/* Title */}
        <h1 style={styles.title}>LINEREMAIN</h1>
        <p style={styles.subtitle}>Draw your last line.</p>

        {/* Auth Form */}
        <div style={styles.formCard}>
          {/* Mode Tabs */}
          <div style={styles.tabs}>
            <button
              style={{
                ...styles.tab,
                ...(mode === 'login' ? styles.tabActive : {}),
              }}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
            >
              Login
            </button>
            <button
              style={{
                ...styles.tab,
                ...(mode === 'register' ? styles.tabActive : {}),
              }}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            {mode === 'register' && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
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
              style={styles.input}
              required
              autoComplete="email"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
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
                style={styles.input}
                required
                minLength={8}
                autoComplete="new-password"
              />
            )}

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Enter World'
                  : 'Create Account'}
            </button>
          </form>
        </div>
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
    background: 'linear-gradient(135deg, var(--bg-dark) 0%, #1A1A2E 50%, var(--bg-dark) 100%)',
    fontFamily: 'var(--font-ui)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
    pointerEvents: 'none',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  title: {
    fontSize: '64px',
    fontWeight: 900,
    color: 'var(--accent)',
    letterSpacing: '8px',
    textShadow: '0 0 40px var(--accent-glow)',
    margin: 0,
    userSelect: 'none',
  },
  subtitle: {
    fontSize: '16px',
    color: 'var(--text-muted)',
    letterSpacing: '4px',
    textTransform: 'uppercase',
    margin: 0,
    userSelect: 'none',
  },
  formCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    padding: '32px',
    width: '360px',
    backdropFilter: 'blur(10px)',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    padding: '4px',
  },
  tab: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '6px',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: 'rgba(240,165,0,0.2)',
    color: 'var(--accent)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    padding: '12px 16px',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'var(--font-ui)',
  },
  error: {
    color: 'var(--danger-light)',
    fontSize: '13px',
    margin: 0,
    textAlign: 'center',
  },
  submitBtn: {
    padding: '14px',
    background: 'linear-gradient(135deg, var(--accent), #E09400)',
    border: 'none',
    borderRadius: '8px',
    color: 'var(--bg-dark)',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    marginTop: '8px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-ui)',
  },
};
