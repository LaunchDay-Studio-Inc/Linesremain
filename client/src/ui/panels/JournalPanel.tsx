// ─── Journal Panel ───
// Parchment-styled popup showing journal fragment text.

import React, { useEffect, useState } from 'react';

interface JournalEntry {
  title: string;
  text: string;
}

// Singleton state for journal popup
let showJournalCallback: ((entry: JournalEntry) => void) | null = null;

export function triggerJournalPopup(title: string, text: string): void {
  showJournalCallback?.({ title, text });
}

export const JournalPanel: React.FC = () => {
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    showJournalCallback = (e) => {
      setEntry(e);
      setVisible(true);
    };
    return () => {
      showJournalCallback = null;
    };
  }, []);

  if (!visible || !entry) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 60,
        pointerEvents: 'all',
      }}
      onClick={() => setVisible(false)}
    >
      <div
        style={{
          width: '420px',
          padding: '32px 40px',
          backgroundColor: '#f4e4c1',
          borderRadius: '4px',
          border: '2px solid #8b7355',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          cursor: 'pointer',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#3a2a1a',
            marginBottom: '16px',
            borderBottom: '1px solid #c0a080',
            paddingBottom: '8px',
          }}
        >
          {entry.title}
        </div>
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '14px',
            color: '#4a3a2a',
            lineHeight: 1.8,
            fontStyle: 'italic',
          }}
        >
          &ldquo;{entry.text}&rdquo;
        </div>
        <div
          style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#8b7355',
            fontFamily: 'var(--font-ui)',
          }}
        >
          Click anywhere to close
        </div>
      </div>
    </div>
  );
};
