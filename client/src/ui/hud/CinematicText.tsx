// ─── Cinematic Text ───
// Full-width dramatic text overlay for story moments.

import React, { useEffect, useState } from 'react';

interface CinematicTextProps {
  text: string | null;
  subtitle?: string;
  duration?: number; // ms
}

export const CinematicText: React.FC<CinematicTextProps> = ({
  text,
  subtitle,
  duration = 5000,
}) => {
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!text) {
      setVisible(false);
      setOpacity(0);
      return;
    }

    setVisible(true);
    // Fade in
    requestAnimationFrame(() => setOpacity(1));

    // Fade out before duration ends
    const fadeOutTimer = setTimeout(() => setOpacity(0), duration - 1000);
    const hideTimer = setTimeout(() => setVisible(false), duration);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(hideTimer);
    };
  }, [text, duration]);

  if (!visible || !text) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 50,
        opacity,
        transition: 'opacity 1s ease-in-out',
      }}
    >
      <div
        style={{
          color: '#fff',
          fontSize: '36px',
          fontFamily: 'Georgia, serif',
          textAlign: 'center',
          textShadow: '0 0 20px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.9)',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          padding: '0 48px',
        }}
      >
        {text}
      </div>
      {subtitle && (
        <div
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '16px',
            fontFamily: 'Georgia, serif',
            textAlign: 'center',
            textShadow: '0 0 10px rgba(0,0,0,0.6)',
            marginTop: '16px',
            fontStyle: 'italic',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};
