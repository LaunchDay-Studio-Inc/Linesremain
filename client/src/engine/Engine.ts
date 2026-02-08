// ─── Three.js Engine ───

import * as THREE from 'three';

const FIXED_DT = 1 / 60;
const MAX_FRAME_SKIP = 5;

export type UpdateCallback = (dt: number) => void;
export type RenderCallback = (interpolation: number) => void;

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private accumulator = 0;
  private lastTime = 0;
  private animFrameId: number | null = null;
  private running = false;

  private onUpdateCb: UpdateCallback | null = null;
  private onRenderCb: RenderCallback | null = null;

  // FPS counter
  private frameCount = 0;
  private fpsAccumulator = 0;
  private currentFPS = 0;

  constructor(canvas: HTMLCanvasElement) {
    // ── Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    // ── Scene ──
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    // ── Camera ──
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.5, 400);
    this.camera.position.set(0, 20, 30);
    this.camera.lookAt(0, 0, 0);

    // ── Resize ──
    window.addEventListener('resize', this.handleResize);
  }

  // ── Callbacks ──

  onUpdate(cb: UpdateCallback): void {
    this.onUpdateCb = cb;
  }

  onRender(cb: RenderCallback): void {
    this.onRenderCb = cb;
  }

  // ── Loop ──

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.loop(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    this.animFrameId = requestAnimationFrame(this.loop);

    const frameDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Track FPS
    this.frameCount++;
    this.fpsAccumulator += frameDelta;
    if (this.fpsAccumulator >= 1) {
      this.currentFPS = this.frameCount;
      this.frameCount = 0;
      this.fpsAccumulator -= 1;
    }

    // Clamp to avoid spiral of death
    this.accumulator += Math.min(frameDelta, MAX_FRAME_SKIP * FIXED_DT);

    // Fixed-timestep updates
    while (this.accumulator >= FIXED_DT) {
      try {
        this.onUpdateCb?.(FIXED_DT);
      } catch (err) {
        console.error('[Engine] Error in update callback:', err);
      }
      this.accumulator -= FIXED_DT;
    }

    // Render with interpolation
    const interpolation = this.accumulator / FIXED_DT;
    try {
      this.onRenderCb?.(interpolation);
    } catch (err) {
      console.error('[Engine] Error in render callback:', err);
    }
    this.renderer.render(this.scene, this.camera);
  };

  // ── Resize ──

  private handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  // ── Accessors ──

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getFPS(): number {
    return this.currentFPS;
  }

  // ── Cleanup ──

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
