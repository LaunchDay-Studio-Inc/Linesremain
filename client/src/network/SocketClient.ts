// ─── Socket Client ───
// Socket.IO client connection management for the game client.
// Handles connecting, disconnecting, reconnection, and event routing.

import { io, type Socket } from 'socket.io-client';
import { useGameStore } from '../stores/useGameStore';

// ─── Types ───

type MessageHandler = (data: unknown) => void;

// ─── Socket Client ───

class SocketClient {
  private socket: Socket | null = null;
  private handlers = new Map<string, MessageHandler[]>();
  private serverUrl = '';

  // ─── Connect ───

  connect(serverUrl: string, token: string): void {
    if (this.socket?.connected) {
      this.disconnect();
    }

    this.serverUrl = serverUrl;

    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.setupEventListeners();
  }

  // ─── Disconnect ───

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    useGameStore.getState().setConnected(false);
  }

  // ─── Event Listeners ───

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[SocketClient] Connected to server');
      useGameStore.getState().setConnected(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SocketClient] Disconnected:', reason);
      useGameStore.getState().setConnected(false);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[SocketClient] Connection error:', err.message);
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`[SocketClient] Reconnection attempt ${attempt}`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[SocketClient] Reconnection failed after all attempts');
      useGameStore.getState().setScreen('menu');
    });

    // Route all registered message types to handlers
    this.socket.onAny((event: string, data: unknown) => {
      const eventHandlers = this.handlers.get(event);
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          handler(data);
        }
      }
    });
  }

  // ─── Message Registration ───

  on(event: string, handler: MessageHandler): void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  off(event: string, handler: MessageHandler): void {
    const existing = this.handlers.get(event);
    if (existing) {
      const filtered = existing.filter((h) => h !== handler);
      if (filtered.length > 0) {
        this.handlers.set(event, filtered);
      } else {
        this.handlers.delete(event);
      }
    }
  }

  // ─── Send Message ───

  emit(event: string, data?: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  // ─── State ───

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  get id(): string | undefined {
    return this.socket?.id;
  }
}

// ─── Singleton ───

export const socketClient = new SocketClient();