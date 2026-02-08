// ─── Map Panel ───
// Full-screen world map with biome-colored terrain, pan/zoom, markers, and cursor info.

import { BiomeType, SEA_LEVEL, WORLD_SIZE } from '@lineremain/shared';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useUIStore } from '../../stores/useUIStore';
import '../../styles/panels.css';
import { ClientTerrainGenerator } from '../../world/ClientTerrainGenerator';

// ─── Constants ───

const MAP_CANVAS_SIZE = 512; // pixel size of the terrain texture
const BLOCKS_PER_PIXEL = WORLD_SIZE / MAP_CANVAS_SIZE; // 8 blocks per pixel
const DEATH_MARKER_DURATION = 10 * 60 * 1000; // 10 minutes
const REGEN_DISTANCE = 200; // blocks moved before regenerating texture
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.5;

// Shared terrain generator for biome sampling (deterministic, seed 42)
const terrainGen = new ClientTerrainGenerator(42);

// ─── Biome Colors (matching Minimap) ───

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

// ─── Biome Display Names ───

const BIOME_DISPLAY_NAMES: Record<BiomeType, string> = {
  [BiomeType.Scorchlands]: 'Scorchlands',
  [BiomeType.AshwoodForest]: 'Ashwood Forest',
  [BiomeType.MireHollows]: 'Mire Hollows',
  [BiomeType.DrygrassPlains]: 'Drygrass Plains',
  [BiomeType.Greenhollow]: 'Greenhollow',
  [BiomeType.Mossreach]: 'Mossreach',
  [BiomeType.FrostveilPeaks]: 'Frostveil Peaks',
  [BiomeType.SnowmeltWoods]: 'Snowmelt Woods',
  [BiomeType.GlacialExpanse]: 'Glacial Expanse',
};

// ─── Component ───

export const MapPanel: React.FC = () => {
  const mapOpen = useUIStore((s) => s.mapOpen);
  const toggleMap = useUIStore((s) => s.toggleMap);
  const position = usePlayerStore((s) => s.position);
  const yaw = usePlayerStore((s) => s.yaw);
  const deathPosition = usePlayerStore((s) => s.deathPosition);
  const deathTime = usePlayerStore((s) => s.deathTime);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainTextureRef = useRef<HTMLCanvasElement | null>(null);
  const lastGenPosRef = useRef({ x: 0, z: 0 });
  const panRef = useRef({ x: 0, y: 0 }); // pan offset in pixels
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  const zoomRef = useRef(2); // default zoom level
  const [cursorInfo, setCursorInfo] = useState({ x: 0, z: 0, biome: '', visible: false });
  const [zoom, setZoom] = useState(2);
  const animFrameRef = useRef(0);

  // Generate the terrain texture (512×512, 1 pixel = 8 blocks)
  const generateTerrainTexture = useCallback(() => {
    if (!terrainTextureRef.current) {
      terrainTextureRef.current = document.createElement('canvas');
      terrainTextureRef.current.width = MAP_CANVAS_SIZE;
      terrainTextureRef.current.height = MAP_CANVAS_SIZE;
    }

    const ctx = terrainTextureRef.current.getContext('2d')!;
    const imageData = ctx.createImageData(MAP_CANVAS_SIZE, MAP_CANVAS_SIZE);
    const data = imageData.data;

    // World origin is at (0,0), world spans 0..WORLD_SIZE in both axes
    for (let px = 0; px < MAP_CANVAS_SIZE; px++) {
      for (let py = 0; py < MAP_CANVAS_SIZE; py++) {
        const wx = px * BLOCKS_PER_PIXEL;
        const wz = py * BLOCKS_PER_PIXEL;

        const biome = terrainGen.getBiome(wx, wz);

        // Height approximation for water detection (same as Minimap)
        const hash = Math.sin(wx * 0.0005 + 0.5) * 15 + 35 + Math.sin(wx * 0.003 + wz * 0.003) * 8;

        let color: [number, number, number];
        if (hash < SEA_LEVEL) {
          color = WATER_COLOR;
        } else {
          color = BIOME_COLORS[biome] ?? [68, 105, 58];
          // Subtle noise variation
          const noise = ((Math.sin(wx * 0.1 + wz * 0.13) * 43758.5453) % 1) * 10 - 5;
          color = [
            Math.max(0, Math.min(255, color[0] + noise)),
            Math.max(0, Math.min(255, color[1] + noise)),
            Math.max(0, Math.min(255, color[2] + noise)),
          ];
        }

        const idx = (py * MAP_CANVAS_SIZE + px) * 4;
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    lastGenPosRef.current = { x: position.x, z: position.z };
  }, [position.x, position.z]);

  // Draw the composited map (terrain + overlays)
  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const displayW = canvas.width;
    const displayH = canvas.height;
    const currentZoom = zoomRef.current;

    // Check if we need to regenerate terrain texture
    const dx = position.x - lastGenPosRef.current.x;
    const dz = position.z - lastGenPosRef.current.z;
    if (!terrainTextureRef.current || dx * dx + dz * dz > REGEN_DISTANCE * REGEN_DISTANCE) {
      generateTerrainTexture();
    }

    // Clear
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, displayW, displayH);

    // Draw terrain texture with zoom and pan
    if (terrainTextureRef.current) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // Center the map on player position, then apply pan
      const playerPx = position.x / BLOCKS_PER_PIXEL;
      const playerPy = position.z / BLOCKS_PER_PIXEL;

      const offsetX = displayW / 2 - playerPx * currentZoom + panRef.current.x;
      const offsetY = displayH / 2 - playerPy * currentZoom + panRef.current.y;

      ctx.drawImage(
        terrainTextureRef.current,
        offsetX,
        offsetY,
        MAP_CANVAS_SIZE * currentZoom,
        MAP_CANVAS_SIZE * currentZoom,
      );
      ctx.restore();
    }

    // ── Grid lines (chunk boundaries) ──
    const currentPan = panRef.current;
    const playerPx = position.x / BLOCKS_PER_PIXEL;
    const playerPy = position.z / BLOCKS_PER_PIXEL;
    const offsetX = displayW / 2 - playerPx * currentZoom + currentPan.x;
    const offsetY = displayH / 2 - playerPy * currentZoom + currentPan.y;

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const chunkPixels = (32 / BLOCKS_PER_PIXEL) * currentZoom; // chunk size in display pixels

    if (chunkPixels > 8) {
      // Only draw grid when zoomed in enough
      const startChunkX = Math.floor(-offsetX / chunkPixels);
      const endChunkX = Math.ceil((displayW - offsetX) / chunkPixels);
      const startChunkY = Math.floor(-offsetY / chunkPixels);
      const endChunkY = Math.ceil((displayH - offsetY) / chunkPixels);

      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const gx = offsetX + cx * chunkPixels;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, displayH);
        ctx.stroke();
      }
      for (let cy = startChunkY; cy <= endChunkY; cy++) {
        const gy = offsetY + cy * chunkPixels;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(displayW, gy);
        ctx.stroke();
      }
    }

    // ── Death marker (red X) ──
    const now = Date.now();
    if (deathPosition && deathTime && now - deathTime < DEATH_MARKER_DURATION) {
      const dpx = offsetX + (deathPosition.x / BLOCKS_PER_PIXEL) * currentZoom;
      const dpy = offsetY + (deathPosition.z / BLOCKS_PER_PIXEL) * currentZoom;

      if (dpx > -20 && dpx < displayW + 20 && dpy > -20 && dpy < displayH + 20) {
        const markerSize = 6;
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(dpx - markerSize, dpy - markerSize);
        ctx.lineTo(dpx + markerSize, dpy + markerSize);
        ctx.moveTo(dpx + markerSize, dpy - markerSize);
        ctx.lineTo(dpx - markerSize, dpy + markerSize);
        ctx.stroke();

        // Label
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#e74c3c';
        ctx.textAlign = 'center';
        ctx.fillText('DEATH', dpx, dpy - markerSize - 4);
      }
    }

    // ── Player arrow (white, pointing in look direction) ──
    const ppx = offsetX + (position.x / BLOCKS_PER_PIXEL) * currentZoom;
    const ppy = offsetY + (position.z / BLOCKS_PER_PIXEL) * currentZoom;

    const yawRad = (-yaw * Math.PI) / 180;
    const arrowLen = 10;
    const arrowWidth = 6;

    const tipX = ppx + Math.sin(yawRad) * arrowLen;
    const tipY = ppy - Math.cos(yawRad) * arrowLen;
    const baseX1 = ppx + Math.sin(yawRad + 2.5) * arrowWidth;
    const baseY1 = ppy - Math.cos(yawRad + 2.5) * arrowWidth;
    const baseX2 = ppx + Math.sin(yawRad - 2.5) * arrowWidth;
    const baseY2 = ppy - Math.cos(yawRad - 2.5) * arrowWidth;

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX1, baseY1);
    ctx.lineTo(ppx, ppy);
    ctx.lineTo(baseX2, baseY2);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Player glow
    ctx.beginPath();
    ctx.arc(ppx, ppy, 14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Coordinate axes labels ──
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('N', displayW / 2, 16);
    ctx.fillText('S', displayW / 2, displayH - 8);
    ctx.fillText('W', 12, displayH / 2 + 4);
    ctx.fillText('E', displayW - 12, displayH / 2 + 4);
  }, [position.x, position.z, yaw, deathPosition, deathTime, generateTerrainTexture]);

  // Convert canvas coordinates to world coordinates
  const canvasToWorld = useCallback(
    (canvasX: number, canvasY: number, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = (canvasX - rect.left) * scaleX;
      const py = (canvasY - rect.top) * scaleY;

      const currentZoom = zoomRef.current;
      const displayW = canvas.width;
      const displayH = canvas.height;
      const playerPxX = position.x / BLOCKS_PER_PIXEL;
      const playerPxZ = position.z / BLOCKS_PER_PIXEL;
      const offsetX = displayW / 2 - playerPxX * currentZoom + panRef.current.x;
      const offsetY = displayH / 2 - playerPxZ * currentZoom + panRef.current.y;

      const wx = ((px - offsetX) / currentZoom) * BLOCKS_PER_PIXEL;
      const wz = ((py - offsetY) / currentZoom) * BLOCKS_PER_PIXEL;

      return { x: wx, z: wz };
    },
    [position.x, position.z],
  );

  // Mouse handlers for pan and cursor
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Update cursor info
      const world = canvasToWorld(e.clientX, e.clientY, canvas);
      const biome = terrainGen.getBiome(world.x, world.z);
      const biomeName = BIOME_DISPLAY_NAMES[biome] ?? 'Unknown';
      setCursorInfo({
        x: Math.round(world.x),
        z: Math.round(world.z),
        biome: biomeName,
        visible: true,
      });

      // Handle drag-to-pan
      if (dragRef.current.dragging) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        panRef.current = {
          x: dragRef.current.startPanX + (e.clientX - dragRef.current.startX) * scaleX,
          y: dragRef.current.startPanY + (e.clientY - dragRef.current.startY) * scaleY,
        };
      }
    },
    [canvasToWorld],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    dragRef.current.dragging = false;
    setCursorInfo((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current + delta));
    if (newZoom !== zoomRef.current) {
      zoomRef.current = newZoom;
      setZoom(newZoom);
    }
  }, []);

  // Animation loop for smooth rendering
  useEffect(() => {
    if (!mapOpen) return;

    // Center pan on player initially
    panRef.current = { x: 0, y: 0 };
    zoomRef.current = 2;
    setZoom(2);

    // Generate texture immediately
    generateTerrainTexture();

    const animate = () => {
      drawMap();
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [mapOpen, drawMap, generateTerrainTexture]);

  if (!mapOpen) return null;

  return (
    <div className="panel-backdrop" onClick={toggleMap}>
      <div className="panel map-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel__header">
          <span className="panel__title">Map</span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              marginLeft: 'auto',
              marginRight: '12px',
            }}
          >
            Zoom: {zoom.toFixed(1)}x
          </span>
          <button className="panel__close" onClick={toggleMap}>
            ✕
          </button>
        </div>

        <div className="map-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={600}
            height={500}
            style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
          />

          {cursorInfo.visible && (
            <div className="map-coords" style={{ left: 12, right: 'auto' }}>
              {cursorInfo.biome} ({cursorInfo.x}, {cursorInfo.z})
            </div>
          )}

          <div className="map-coords">
            {Math.round(position.x)}, {Math.round(position.y)}, {Math.round(position.z)}
          </div>
        </div>
      </div>
    </div>
  );
};
