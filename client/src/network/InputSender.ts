// ─── Input Sender ───
// Samples local input state at the server tick rate and sends it to the server.
// Manages sequence numbers for client-side prediction reconciliation.

import { TICK_RATE } from '@shared/constants/game';
import { ClientMessage, type InputPayload } from '@shared/types/network';
import { InputManager } from '../engine/InputManager';
import { usePlayerStore } from '../stores/usePlayerStore';
import { socketClient } from './SocketClient';

// ─── State ───

let inputManager: InputManager | null = null;
let sendIntervalId: ReturnType<typeof setInterval> | null = null;
let sequenceNumber = 0;
let playerYaw = 0; // radians, updated by mouse movement

// Action queue for discrete events (attacks, interactions)
// These are consumed on the next input send and then cleared
let pendingPrimaryAction = false;
let pendingSecondaryAction = false;

// ─── Input History (for client-side prediction reconciliation) ───

export interface InputRecord {
  seq: number;
  payload: InputPayload;
  timestamp: number;
}

const inputHistory: InputRecord[] = [];
const MAX_HISTORY = 128;

// ─── Public API ───

/** Start sampling and sending input at the tick rate */
export function startInputSender(): void {
  inputManager = InputManager.getInstance();
  sequenceNumber = 0;
  playerYaw = 0;
  inputHistory.length = 0;

  const intervalMs = 1000 / TICK_RATE;
  sendIntervalId = setInterval(sampleAndSend, intervalMs);
}

/** Stop sending input */
export function stopInputSender(): void {
  if (sendIntervalId !== null) {
    clearInterval(sendIntervalId);
    sendIntervalId = null;
  }
  if (inputManager) {
    inputManager.dispose();
    inputManager = null;
  }
  inputHistory.length = 0;
}

/** Queue a primary action (attack/harvest) for the next tick */
export function queuePrimaryAction(): void {
  pendingPrimaryAction = true;
}

/** Queue a secondary action (place/interact) for the next tick */
export function queueSecondaryAction(): void {
  pendingSecondaryAction = true;
}

/** Update player yaw from mouse movement (called by camera/controller) */
export function setPlayerYaw(yaw: number): void {
  playerYaw = yaw;
}

/** Get the player yaw */
export function getPlayerYaw(): number {
  return playerYaw;
}

/** Get input history for client-side prediction reconciliation */
export function getInputHistory(): InputRecord[] {
  return inputHistory;
}

/** Remove acknowledged inputs (server has confirmed up to this seq) */
export function acknowledgeInput(seq: number): void {
  const idx = inputHistory.findIndex((r) => r.seq > seq);
  if (idx === -1) {
    // All inputs acknowledged
    inputHistory.length = 0;
  } else if (idx > 0) {
    inputHistory.splice(0, idx);
  }
}

// ─── Internal ───

function sampleAndSend(): void {
  if (!inputManager || !socketClient.connected) return;

  const kb = inputManager.keybinds;

  // Sample movement keys
  const forward =
    (inputManager.isKeyDown(kb.moveForward) ? 1 : 0) -
    (inputManager.isKeyDown(kb.moveBackward) ? 1 : 0);
  const right =
    (inputManager.isKeyDown(kb.moveRight) ? 1 : 0) - (inputManager.isKeyDown(kb.moveLeft) ? 1 : 0);

  const jump = inputManager.isKeyDown(kb.jump);
  const crouch = inputManager.isKeyDown(kb.crouch);
  const sprint = inputManager.isKeyDown(kb.sprint);

  // ── Gather (Shift held = continuous primaryAction) ──
  const gatherHeld = inputManager.isKeyDown(kb.gather);

  // ── Attack/Interact (F pressed = one-shot primary+secondary) ──
  const attackPressed = inputManager.isKeyPressed(kb.attack);

  // Consume queued actions — LMB/RMB still work as mouse fallbacks
  const primaryAction =
    pendingPrimaryAction ||
    inputManager.isMouseButtonDown(0) ||
    gatherHeld ||
    attackPressed;
  const secondaryAction =
    pendingSecondaryAction ||
    inputManager.isMouseButtonDown(2) ||
    attackPressed;
  pendingPrimaryAction = false;
  pendingSecondaryAction = false;

  // Get selected hotbar slot
  const selectedSlot = usePlayerStore.getState().hotbarIndex;

  const seq = ++sequenceNumber;

  const payload: InputPayload = {
    seq,
    forward,
    right,
    jump,
    crouch,
    sprint,
    rotation: playerYaw,
    primaryAction,
    secondaryAction,
    selectedSlot,
  };

  // Store in history for prediction reconciliation
  inputHistory.push({
    seq,
    payload,
    timestamp: performance.now(),
  });

  // Trim history if it gets too long
  if (inputHistory.length > MAX_HISTORY) {
    inputHistory.splice(0, inputHistory.length - MAX_HISTORY);
  }

  // Send to server
  socketClient.emit(ClientMessage.Input, payload);
}
