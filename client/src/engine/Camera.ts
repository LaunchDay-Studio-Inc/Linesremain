// ─── Third-Person Camera Controller ───

import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3();
  private currentPosition = new THREE.Vector3();
  private desiredPosition = new THREE.Vector3();

  // Orbit parameters
  private azimuth = 0; // degrees
  private elevation = 20; // degrees
  private distance = 20;

  // Limits
  private readonly minElevation = 15;
  private readonly maxElevation = 80;
  private readonly minDistance = 10;
  private readonly maxDistance = 50;

  // Smoothing
  private readonly lerpFactor = 0.1;

  // Input state — any mouse button can orbit
  private orbitButton = -1; // which button is currently orbiting (-1 = none)
  private lastMouseX = 0;
  private lastMouseY = 0;
  private readonly orbitSensitivity = 0.3;

  private canvas: HTMLCanvasElement | null = null;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.currentPosition.copy(camera.position);
  }

  // ── Attach to canvas for orbit input ──

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mouseleave', this.onMouseLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  detach(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas = null;
  }

  // ── Public API ──

  setTarget(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
  }

  update(_dt: number): void {
    // Compute desired camera position from spherical coordinates
    const elevRad = this.elevation * DEG2RAD;
    const azimRad = this.azimuth * DEG2RAD;

    this.desiredPosition.set(
      this.target.x + this.distance * Math.cos(elevRad) * Math.sin(azimRad),
      this.target.y + this.distance * Math.sin(elevRad),
      this.target.z + this.distance * Math.cos(elevRad) * Math.cos(azimRad),
    );

    // Smooth follow
    this.currentPosition.lerp(this.desiredPosition, this.lerpFactor);
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.target);
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getAzimuth(): number {
    return this.azimuth;
  }

  rotateAzimuth(degrees: number): void {
    this.azimuth += degrees;
    if (this.azimuth > 360) this.azimuth -= 360;
    if (this.azimuth < -360) this.azimuth += 360;
  }

  rotateElevation(degrees: number): void {
    this.elevation += degrees;
    this.elevation = Math.max(this.minElevation, Math.min(this.maxElevation, this.elevation));
  }

  // ── Input Handlers ──

  private onMouseDown = (e: MouseEvent): void => {
    if (this.orbitButton >= 0) return; // already orbiting
    this.orbitButton = e.button;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.orbitButton < 0) return;

    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    this.azimuth -= dx * this.orbitSensitivity;
    this.elevation += dy * this.orbitSensitivity;

    // Wrap azimuth
    if (this.azimuth > 360) this.azimuth -= 360;
    if (this.azimuth < -360) this.azimuth += 360;

    // Clamp elevation
    this.elevation = Math.max(this.minElevation, Math.min(this.maxElevation, this.elevation));
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === this.orbitButton) {
      this.orbitButton = -1;
    }
  };

  private onMouseLeave = (): void => {
    this.orbitButton = -1;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const zoomStep = e.deltaY > 0 ? 2 : -2;
    this.distance = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.distance + zoomStep),
    );
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };
}
