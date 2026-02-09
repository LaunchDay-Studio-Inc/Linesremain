// ─── Input Manager (Singleton) ───

export interface KeybindMap {
  moveForward: string;
  moveBackward: string;
  moveLeft: string;
  moveRight: string;
  jump: string;
  sprint: string;
  crouch: string;
  gather: string;
  attack: string;
  interact: string;
  inventory: string;
  chat: string;
  map: string;
  buildMode: string;
  dropItem: string;
  reload: string;
}

export const DEFAULT_KEYBINDS: KeybindMap = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  sprint: 'AltLeft',
  crouch: 'ControlLeft',
  gather: 'ShiftLeft',
  attack: 'KeyF',
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

function rebuildPreventDefaultKeys(keybinds: KeybindMap): void {
  PREVENT_DEFAULT_KEYS.clear();
  for (const code of Object.values(keybinds)) {
    PREVENT_DEFAULT_KEYS.add(code);
  }
  PREVENT_DEFAULT_KEYS.add('ArrowUp');
  PREVENT_DEFAULT_KEYS.add('ArrowDown');
  PREVENT_DEFAULT_KEYS.add('ArrowLeft');
  PREVENT_DEFAULT_KEYS.add('ArrowRight');
}

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

  // Keybinds
  keybinds: KeybindMap = { ...DEFAULT_KEYBINDS };

  /** Apply custom keybinds and rebuild the prevent-default key set. */
  setKeybinds(binds: KeybindMap): void {
    this.keybinds = { ...binds };
    rebuildPreventDefaultKeys(this.keybinds);
  }

  // Element-level keyboard attachment (for iframe focus issues)
  private attachedElement: HTMLElement | null = null;

  private constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('blur', this.onBlur);
  }

  static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    InputManager.refCount++;
    return InputManager.instance;
  }

  /**
   * Attach keyboard listeners directly to an element.
   * Critical for iframe environments (e.g., Codespaces) where window-level
   * keyboard events may not fire when the iframe lacks focus.
   */
  attachToElement(el: HTMLElement): void {
    this.attachedElement = el;
    el.addEventListener('keydown', this.onKeyDown);
    el.addEventListener('keyup', this.onKeyUp);
  }

  /**
   * Remove keyboard listeners from the attached element.
   */
  detachFromElement(): void {
    if (this.attachedElement) {
      this.attachedElement.removeEventListener('keydown', this.onKeyDown);
      this.attachedElement.removeEventListener('keyup', this.onKeyUp);
      this.attachedElement = null;
    }
  }

  // ── Keyboard Queries ──

  isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  /** Returns true only on the first frame the key is pressed */
  isKeyPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  /** Returns the last key that is currently pressed (for debugging) */
  getLastPressedKey(): string {
    const keys = Array.from(this.keysDown);
    return keys.length > 0 ? keys[keys.length - 1]! : '';
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
    // Clear stuck Meta keys — macOS doesn't reliably fire keyup for Meta
    if (e.code !== 'MetaLeft' && e.code !== 'MetaRight') {
      this.keysDown.delete('MetaLeft');
      this.keysDown.delete('MetaRight');
    }

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
    this.mouseDeltaX += e.movementX;
    this.mouseDeltaY += e.movementY;
  };

  private onWheel = (e: WheelEvent): void => {
    this.scrollDelta += e.deltaY;
  };

  private onBlur = (): void => {
    this.keysDown.clear();
    this.keysPressed.clear();
    this.mouseButtons.clear();
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
    window.removeEventListener('blur', this.onBlur);
    this.detachFromElement();
    InputManager.instance = null;
  }
}
