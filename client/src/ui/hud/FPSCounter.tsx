// ─── FPS Counter (Debug Overlay) ───

import React, { useEffect, useRef, useState } from 'react';

interface DebugStats {
  fps: number;
  drawCalls: number;
  triangles: number;
}

/**
 * Lightweight FPS counter that reads renderer.info each second.
 * Displayed as a fixed overlay in the top-left corner.
 */
export const FPSCounter: React.FC<{
  getRenderer: () => THREE.WebGLRenderer | null;
  visible?: boolean;
}> = ({ getRenderer, visible = true }) => {
  const [stats, setStats] = useState<DebugStats>({ fps: 0, drawCalls: 0, triangles: 0 });
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef(0);

  useEffect(() => {
    if (!visible) return;

    const tick = () => {
      frameCountRef.current++;
      const now = performance.now();

      if (now - lastTimeRef.current >= 1000) {
        const renderer = getRenderer();
        setStats({
          fps: frameCountRef.current,
          drawCalls: renderer?.info.render.calls ?? 0,
          triangles: renderer?.info.render.triangles ?? 0,
        });
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getRenderer, visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.5,
        textShadow: '0 1px 3px rgba(0,0,0,0.9)',
        pointerEvents: 'none',
        zIndex: 100,
        background: 'rgba(0,0,0,0.4)',
        padding: '4px 8px',
        borderRadius: 4,
      }}
    >
      <div>FPS: {stats.fps}</div>
      <div>Draw Calls: {stats.drawCalls}</div>
      <div>Triangles: {stats.triangles.toLocaleString()}</div>
    </div>
  );
};

// Need the THREE import for the type
import type * as THREE from 'three';
