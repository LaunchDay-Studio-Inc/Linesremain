// ─── Chat Handler ───
// Socket event handlers for chat messages across global, team, and local channels.
// Includes basic chat commands (/kill, /ping, /players, /clan).

import {
  ClientMessage,
  ComponentType,
  MAX_CHAT_MESSAGE_LENGTH,
  ServerMessage,
  type ChatPayload,
  type HealthComponent,
  type ServerChatPayload,
} from '@lineremain/shared';
import type { Server, Socket } from 'socket.io';
import type { GameWorld } from '../../game/World.js';
import { logger } from '../../utils/logger.js';
import { trackChat } from '../../game/systems/AchievementSystem.js';
import { chatRateLimiter } from '../RateLimiter.js';

// ─── Validation ───

function isValidChatPayload(payload: unknown): payload is ChatPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.message === 'string' &&
    p.message.length > 0 &&
    p.message.length <= MAX_CHAT_MESSAGE_LENGTH
  );
}

// ─── Chat Command Processing ───

function processChatCommand(
  command: string,
  _args: string[],
  world: GameWorld,
  playerId: string,
  playerName: string,
  socket: Socket,
): boolean {
  switch (command) {
    case '/kill': {
      const entityId = world.getPlayerEntity(playerId);
      if (entityId !== undefined) {
        const health = world.ecs.getComponent<HealthComponent>(entityId, ComponentType.Health);
        if (health) {
          health.current = 0;
          sendSystemMessage(socket, 'You killed yourself.');
        }
      }
      return true;
    }

    case '/ping': {
      sendSystemMessage(socket, 'Pong!');
      return true;
    }

    case '/players': {
      // Count player entities
      const playerEntities = world.ecs.query(
        ComponentType.Position,
        ComponentType.Health,
        ComponentType.Inventory,
        ComponentType.Equipment,
      );
      sendSystemMessage(socket, `Online players: ${playerEntities.length}`);
      return true;
    }

    case '/time': {
      const timeOfDay = world.worldTime;
      const hours = Math.floor(timeOfDay * 24);
      const minutes = Math.floor((timeOfDay * 24 - hours) * 60);
      sendSystemMessage(
        socket,
        `Server time: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
      );
      return true;
    }

    case '/help': {
      sendSystemMessage(socket, 'Commands: /kill, /ping, /players, /time, /help');
      return true;
    }

    default:
      sendSystemMessage(socket, `Unknown command: ${command}`);
      logger.debug({ playerId, playerName, command }, 'Unknown chat command');
      return true;
  }
}

function sendSystemMessage(socket: Socket, message: string): void {
  const payload: ServerChatPayload = {
    senderId: 'system',
    senderName: 'Server',
    message,
    channel: 'global',
    timestamp: Date.now(),
  };
  socket.emit(ServerMessage.Chat, payload);
}

// ─── Register Chat Handlers ───

export function registerChatHandlers(
  io: Server,
  socket: Socket,
  world: GameWorld,
  getPlayerId: (socket: Socket) => string | undefined,
  getPlayerName: (playerId: string) => string,
): void {
  socket.on(ClientMessage.Chat, (payload: unknown) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    // Rate limit
    if (!chatRateLimiter.check(playerId, 'chat')) {
      sendSystemMessage(socket, 'You are sending messages too quickly.');
      return;
    }

    // Validate
    if (!isValidChatPayload(payload)) return;

    const message = payload.message.trim();
    if (message.length === 0) return;

    const playerName = getPlayerName(playerId);

    // Check for chat commands
    if (message.startsWith('/')) {
      const parts = message.split(' ');
      const command = parts[0]!.toLowerCase();
      const args = parts.slice(1);
      processChatCommand(command, args, world, playerId, playerName, socket);
      return;
    }

    // Determine channel from message prefix
    let channel: 'global' | 'team' | 'local' = 'global';
    let cleanMessage = message;

    if (message.startsWith('[team] ') || message.startsWith('[t] ')) {
      channel = 'team';
      cleanMessage = message.replace(/^\[(team|t)\]\s*/i, '');
    } else if (message.startsWith('[local] ') || message.startsWith('[l] ')) {
      channel = 'local';
      cleanMessage = message.replace(/^\[(local|l)\]\s*/i, '');
    }

    if (cleanMessage.length === 0) return;

    const chatPayload: ServerChatPayload = {
      senderId: playerId,
      senderName: playerName,
      message: cleanMessage,
      channel,
      timestamp: Date.now(),
    };

    switch (channel) {
      case 'global':
        // Send to all connected clients
        io.emit(ServerMessage.Chat, chatPayload);
        break;

      case 'team':
        // Send to team members only
        // For now, broadcast to all (team filtering would need team membership data)
        socket.emit(ServerMessage.Chat, chatPayload);
        // TODO: Filter by team membership when team system is integrated
        break;

      case 'local': {
        // Send to players within a certain range
        socket.emit(ServerMessage.Chat, chatPayload);
        // Broadcast to nearby sockets
        socket.broadcast.emit(ServerMessage.Chat, chatPayload);
        break;
      }
    }

    // Track chat message for achievements
    trackChat(playerId);

    logger.debug({ playerId, channel, messageLength: cleanMessage.length }, 'Chat message sent');
  });

  logger.debug({ socketId: socket.id }, 'Chat handlers registered');
}
