// ─── Minimap ───
// Renders a circular top-down view of nearby terrain using real biome data,
// with player direction arrow and death marker.

import { BiomeType, SEA_LEVEL } from '@lineremain/shared';
import React, { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import '../../styles/hud.css';
import { ClientTerrainGenerator } from '../../world/ClientTerrainGenerator';

// ─── Constants ───

const MINIMAP_SIZE = 140;
const MINIMAP_RADIUS = MINIMAP_SIZE / 2 - 2;
const MINIMAP_SCALE = 2; // world blocks per pixel
const UPDATE_INTERVAL = 500; // ms between terrain redraws
const DEATH_MARKER_DURATION = 10 * 60 * 1000; // 10 minutes in ms

// Shared terrain generator for biome sampling (deterministic, seed 42)
const terrainGen = new ClientTerrainGenerator(42);

// ─── Biome Colors (top-down map view) ───

const BIOME_COLORS: Record<BiomeType, [number, number, number]> = {
  [BiomeType.Scorchlands]: [194, 154, 80],
  [BiomeType.AshwoodForest]: [72, 90, 60],
  [BiomeType.MireHollows]: [55, 82, 55],
  [BiomeType.DrygrassPlains]: [140, 142, 80],
  [BiomeType.Greenhollow]: [68, 105, 58],
  [BiomeType.Mossreach]: [50, 95, 65],
  [BiomeType.FrostveilPeaks]: [180, 190, 200],
  [BiomeType.SnowmeltWoods]: [130, 150, 155],
  [BiomeType.GlacialExpanse]: [195, 210, 225],
};

const WATER_COLOR: [number, number, number] = [35, 72, 118];

// ─── Component ───

export const Minimap: React.FC = () => {
  const position = usePlayerStore((s) => s.position);
  const yaw = usePlayerStore((s) => s.yaw);
  const deathPosition = usePlayerStore((s) => s.deathPosition);
  const deathTime = usePlayerStore((s) => s.deathTime);
  const generation = useGameStore((s) => s.lineage?.generation ?? 1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTerrainPosRef = useRef({ x: 0, z: 0 });
  const lastTerrainTimeRef = useRef(0);

  // Draw terrain to an offscreen canvas (throttled)
  const drawTerrain = useCallback((cx: number, cz: number) => {
    if (!terrainCanvasRef.current) {
      terrainCanvasRef.current = document.createElement('canvas');
      terrainCanvasRef.current.width = MINIMAP_SIZE;
      terrainCanvasRef.current.height = MINIMAP_SIZE;
    }

    const ctx = terrainCanvasRef.current.getContext('2d')!;
    const imageData = ctx.createImageData(MINIMAP_SIZE, MINIMAP_SIZE);
    const data = imageData.data;

    // Sample biomes for each pixel
    for (let px = 0; px < MINIMAP_SIZE; px++) {
      for (let py = 0; py < MINIMAP_SIZE; py++) {
        const wx = cx + (px - MINIMAP_SIZE / 2) * MINIMAP_SCALE;
        const wz = cz + (py - MINIMAP_SIZE / 2) * MINIMAP_SCALE;

        const biome = terrainGen.getBiome(wx, wz);
        // Approximate height to detect water
        const distFromCenter = Math.sqrt(
          (px - MINIMAP_SIZE / 2) ** 2 + (py - MINIMAP_SIZE / 2) ** 2,
        );

        // Simple height approximation using continental noise hash
        const hash = Math.sin(wx * 0.0005 + 0.5) * 15 + 35 + Math.sin(wx * 0.003 + wz * 0.003) * 8;

        let color: [number, number, number];
        if (hash < SEA_LEVEL) {
          color = WATER_COLOR;
        } else {
          color = BIOME_COLORS[biome] ?? [68, 105, 58];
          // Add subtle noise variation
          const noise = ((Math.sin(wx * 0.1 + wz * 0.13) * 43758.5453) % 1) * 12 - 6;
          color = [
            Math.max(0, Math.min(255, color[0] + noise)),
            Math.max(0, Math.min(255, color[1] + noise)),
            Math.max(0, Math.min(255, color[2] + noise)),
          ];
        }

        // Apply circular mask (fade edges smoothly)
        let alpha = 255;
        if (distFromCenter > MINIMAP_RADIUS - 4) {
          alpha = Math.max(0, (MINIMAP_RADIUS - distFromCenter) / 4) * 255;
        }

        const idx = (py * MINIMAP_SIZE + px) * 4;
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
        data[idx + 3] = distFromCenter <= MINIMAP_RADIUS ? alpha : 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  // Main draw function — composites terrain + overlays
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = position.x;
    const cz = position.z;
    const now = Date.now();

    // Only redraw terrain if player moved enough or enough time passed
    const dx = cx - lastTerrainPosRef.current.x;
    const dz = cz - lastTerrainPosRef.current.z;
    if (
      dx * dx + dz * dz > 100 || // moved >10 blocks
      now - lastTerrainTimeRef.current > UPDATE_INTERVAL ||
      lastTerrainTimeRef.current === 0
    ) {
      drawTerrain(cx, cz);
      lastTerrainPosRef.current = { x: cx, z: cz };
      lastTerrainTimeRef.current = now;
    }

    // Clear and draw terrain
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    if (terrainCanvasRef.current) {
      ctx.drawImage(terrainCanvasRef.current, 0, 0);
    }

    // ── Death marker ──
    if (deathPosition && deathTime && now - deathTime < DEATH_MARKER_DURATION) {
      const dpx = MINIMAP_SIZE / 2 + (deathPosition.x - cx) / MINIMAP_SCALE;
      const dpy = MINIMAP_SIZE / 2 + (deathPosition.z - cz) / MINIMAP_SCALE;
      const dist = Math.sqrt((dpx - MINIMAP_SIZE / 2) ** 2 + (dpy - MINIMAP_SIZE / 2) ** 2);

      if (dist < MINIMAP_RADIUS - 4) {
        // Red X for death
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dpx - 4, dpy - 4);
        ctx.lineTo(dpx + 4, dpy + 4);
        ctx.moveTo(dpx + 4, dpy - 4);
        ctx.lineTo(dpx - 4, dpy + 4);
        ctx.stroke();
      }
    }

    // ── Circle border ──
    ctx.beginPath();
    ctx.arc(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, MINIMAP_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Player arrow (pointing in look direction) ──
    const centerX = MINIMAP_SIZE / 2;
    const centerY = MINIMAP_SIZE / 2;

    // Camera azimuth: 0° = North (-Z), increases clockwise
    // On minimap: up = North (-Z), right = East (+X)
    const yawRad = (-yaw * Math.PI) / 180;
    const arrowLen = 7;
    const arrowWidth = 4;

    // Arrow tip direction
    const tipX = centerX + Math.sin(yawRad) * arrowLen;
    const tipY = centerY - Math.cos(yawRad) * arrowLen;

    // Arrow base (two points perpendicular to direction)
    const baseX1 = centerX + Math.sin(yawRad + 2.5) * arrowWidth;
    const baseY1 = centerY - Math.cos(yawRad + 2.5) * arrowWidth;
    const baseX2 = centerX + Math.sin(yawRad - 2.5) * arrowWidth;
    const baseY2 = centerY - Math.cos(yawRad - 2.5) * arrowWidth;

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX1, baseY1);
    ctx.lineTo(centerX, centerY); // notch
    ctx.lineTo(baseX2, baseY2);
    ctx.closePath();
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Cardinal directions ──
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('N', MINIMAP_SIZE / 2, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('S', MINIMAP_SIZE / 2, MINIMAP_SIZE - 10);
    ctx.fillText('W', 10, MINIMAP_SIZE / 2);
    ctx.fillText('E', MINIMAP_SIZE - 10, MINIMAP_SIZE / 2);
  }, [position.x, position.z, yaw, deathPosition, deathTime, drawTerrain]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="minimap">
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE, borderRadius: '50%' }}
      />
      <span className="minimap__coords">
        {Math.round(position.x)}, {Math.round(position.y)}, {Math.round(position.z)}
      </span>
      {generation > 1 && (
        <span
          style={{
            display: 'block',
            textAlign: 'center',
            fontSize: '10px',
            fontWeight: 600,
            color: '#F0A500',
            letterSpacing: '1px',
            marginTop: '2px',
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          GEN {generation}
        </span>
      )}
    </div>
  );
};
