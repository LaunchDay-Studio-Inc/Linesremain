// ─── Input Manager (Singleton) ───

export interface KeybindMap {
  moveForward: string;
  moveBackward: string;
  moveLeft: string;
  moveRight: string;
  jump: string;
  sprint: string;
  crouch: string;
  interact: string;
  inventory: string;
  chat: string;
  map: string;
  buildMode: string;
  dropItem: string;
  reload: string;
}

const DEFAULT_KEYBINDS: KeybindMap = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  crouch: 'ControlLeft',
  interact: 'KeyE',
  inventory: 'Tab',
  chat: 'Enter',
  map: 'KeyM',
  buildMode: 'KeyB',
  dropItem: 'KeyQ',
  reload: 'KeyR',
};

// Keys that should always have their default browser behavior prevented
const PREVENT_DEFAULT_KEYS = new Set<string>([
  ...Object.values(DEFAULT_KEYBINDS),
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export class InputManager {
  private static instance: InputManager | null = null;
  private static refCount = 0;

  // Keyboard state
  private keysDown = new Set<string>();
  private keysPressed = new Set<string>();

  // Mouse state
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private mouseButtons = new Set<number>();
  private scrollDelta = 0;

  // Pointer lock
  private pointerLocked = false;

  // Keybinds
  keybinds: KeybindMap = { ...DEFAULT_KEYBINDS };

  private constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    InputManager.refCount++;
    return InputManager.instance;
  }

  // ── Pointer Lock ──

  requestPointerLock(canvas: HTMLCanvasElement): void {
    canvas.requestPointerLock();
  }

  exitPointerLock(): void {
    document.exitPointerLock();
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  // ── Keyboard Queries ──

  isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  /** Returns true only on the first frame the key is pressed */
  isKeyPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  // ── Mouse Queries ──

  getMouseDelta(): { x: number; y: number } {
    return { x: this.mouseDeltaX, y: this.mouseDeltaY };
  }

  isMouseButtonDown(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  getScrollDelta(): number {
    return this.scrollDelta;
  }

  // ── Frame Reset (call at end of each frame) ──

  resetFrameState(): void {
    this.keysPressed.clear();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.scrollDelta = 0;
  }

  // ── Event Handlers ──

  private onKeyDown = (e: KeyboardEvent): void => {
    // Don't capture game input when typing in form fields
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // Prevent default for game & navigation keys (not all keys, allow browser shortcuts)
    if (PREVENT_DEFAULT_KEYS.has(e.code)) {
      e.preventDefault();
    }

    if (!this.keysDown.has(e.code)) {
      this.keysPressed.add(e.code);
    }
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.mouseButtons.add(e.button);
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.mouseButtons.delete(e.button);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.pointerLocked) {
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    this.scrollDelta += e.deltaY;
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement !== null;
  };

  // ── Cleanup ──

  /**
   * Decrement the reference count. Only truly disposes when no consumers remain.
   * This prevents React StrictMode double-mount/unmount from destroying the singleton.
   */
  dispose(): void {
    InputManager.refCount = Math.max(0, InputManager.refCount - 1);
    if (InputManager.refCount > 0) return;

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    InputManager.instance = null;
  }
}
