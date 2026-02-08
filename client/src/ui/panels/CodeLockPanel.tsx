// ─── Code Lock Panel ───
// Panel for setting or entering 4-digit codes on locked doors.

import { ClientMessage } from '@shared/types/network';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { socketClient } from '../../network/SocketClient';
import '../../styles/panels.css';

interface CodeLockPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: number;
  isOwner: boolean;
}

const DIGIT_COUNT = 4;

export const CodeLockPanel: React.FC<CodeLockPanelProps> = ({
  isOpen,
  onClose,
  entityId,
  isOwner,
}) => {
  const [digits, setDigits] = useState<string[]>(Array(DIGIT_COUNT).fill(''));
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input when panel opens
  useEffect(() => {
    if (isOpen) {
      setDigits(Array(DIGIT_COUNT).fill(''));
      setError(null);
      // Small delay so the DOM is ready
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleDigitChange = useCallback((index: number, value: string) => {
    // Only allow single digits
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setError(null);

    // Auto-advance to next input
    if (digit && index < DIGIT_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  const handleSubmit = useCallback(() => {
    const code = digits.join('');
    if (code.length !== DIGIT_COUNT) {
      setError('Enter all 4 digits');
      return;
    }

    if (isOwner) {
      socketClient.emit(ClientMessage.SetLockCode, { entityId, code });
    } else {
      socketClient.emit(ClientMessage.EnterLockCode, { entityId, code });
    }

    onClose();
  }, [digits, isOwner, entityId, onClose]);

  if (!isOpen) return null;

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div
        className="panel"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 320, maxWidth: 380 }}
      >
        <div className="panel__header">
          <span className="panel__title">{isOwner ? 'Set Lock Code' : 'Enter Lock Code'}</span>
          <button className="panel__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* Lock icon */}
          <div
            style={{
              fontSize: 32,
              color: isOwner ? 'var(--accent)' : 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            {isOwner ? '\u{1F513}' : '\u{1F512}'}
          </div>

          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {isOwner
              ? 'Set a 4-digit code to secure this door. Share it only with teammates.'
              : 'Enter the 4-digit code to unlock this door.'}
          </div>

          {/* Digit inputs */}
          <div style={{ display: 'flex', gap: 10 }}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                style={{
                  width: 48,
                  height: 56,
                  textAlign: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                  fontFamily: 'var(--font-ui)',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: `2px solid ${digit ? 'var(--accent)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  outline: 'none',
                  caretColor: 'var(--accent)',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)';
                }}
                onBlur={(e) => {
                  if (!digit) {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--danger)',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            className="craft-btn"
            onClick={handleSubmit}
            disabled={digits.some((d) => !d)}
            style={{ maxWidth: 240 }}
          >
            {isOwner ? 'Set Code' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
};
