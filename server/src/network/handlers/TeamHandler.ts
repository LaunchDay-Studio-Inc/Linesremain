// ─── Team Handler ───
// Socket event handlers for clan/team operations: create, invite, accept, leave, kick.

import type { Server, Socket } from 'socket.io';
import type { GameWorld } from '../../game/World.js';
import {
  ClientMessage,
  ServerMessage,
  MAX_TEAM_SIZE,
  type TeamCreatePayload,
  type TeamInvitePayload,
  type TeamAcceptPayload,
  type TeamKickPayload,
} from '@lineremain/shared';
import { teamRateLimiter } from '../RateLimiter.js';
import { logger } from '../../utils/logger.js';

// ─── Response Type ───

interface TeamResponse {
  success: boolean;
  error?: string;
  teamId?: string;
}

// ─── In-memory Team Storage ───

interface TeamMember {
  playerId: string;
  playerName: string;
  isLeader: boolean;
  isOnline: boolean;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  pendingInvites: string[]; // player ids
}

const teams = new Map<string, Team>();
const playerTeamMap = new Map<string, string>(); // playerId → teamId
const pendingInviteMap = new Map<string, string[]>(); // playerId → teamId[]

let nextTeamId = 1;

// ─── Helper Functions ───

function generateTeamId(): string {
  return `team_${nextTeamId++}`;
}

function getPlayerTeam(playerId: string): Team | undefined {
  const teamId = playerTeamMap.get(playerId);
  if (!teamId) return undefined;
  return teams.get(teamId);
}

function broadcastTeamUpdate(io: Server, team: Team): void {
  const payload = {
    teamId: team.id,
    name: team.name,
    members: team.members.map((m) => ({
      playerId: m.playerId,
      playerName: m.playerName,
      isLeader: m.isLeader,
      isOnline: m.isOnline,
    })),
    pendingInvites: team.pendingInvites,
  };

  // Emit to all team members
  for (const member of team.members) {
    io.to(`player:${member.playerId}`).emit(ServerMessage.TeamUpdate, payload);
  }
}

// ─── Validation ───

function isValidTeamCreate(payload: unknown): payload is TeamCreatePayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return typeof p.name === 'string' && p.name.length >= 1 && p.name.length <= 32;
}

function isValidTeamInvite(payload: unknown): payload is TeamInvitePayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return typeof p.targetPlayerId === 'string' && p.targetPlayerId.length > 0;
}

function isValidTeamAccept(payload: unknown): payload is TeamAcceptPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return typeof p.teamId === 'string' && p.teamId.length > 0;
}

function isValidTeamKick(payload: unknown): payload is TeamKickPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return typeof p.targetPlayerId === 'string' && p.targetPlayerId.length > 0;
}

// ─── Register Team Handlers ───

export function registerTeamHandlers(
  io: Server,
  socket: Socket,
  _world: GameWorld,
  getPlayerId: (socket: Socket) => string | undefined,
  getPlayerName: (playerId: string) => string,
): void {
  // Join a socket room for the player so we can target them
  const playerId = getPlayerId(socket);
  if (playerId) {
    socket.join(`player:${playerId}`);
  }

  // ─── Create Team ───
  socket.on(ClientMessage.TeamCreate, (payload: unknown, callback?: (res: TeamResponse) => void) => {
    const pid = getPlayerId(socket);
    if (!pid) {
      callback?.({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!teamRateLimiter.check(pid, 'team_create')) {
      callback?.({ success: false, error: 'Rate limited' });
      return;
    }

    if (!isValidTeamCreate(payload)) {
      callback?.({ success: false, error: 'Invalid payload' });
      return;
    }

    // Check if player is already in a team
    if (playerTeamMap.has(pid)) {
      callback?.({ success: false, error: 'Already in a team' });
      return;
    }

    const teamId = generateTeamId();
    const team: Team = {
      id: teamId,
      name: payload.name.trim(),
      members: [{
        playerId: pid,
        playerName: getPlayerName(pid),
        isLeader: true,
        isOnline: true,
      }],
      pendingInvites: [],
    };

    teams.set(teamId, team);
    playerTeamMap.set(pid, teamId);

    callback?.({ success: true, teamId });
    broadcastTeamUpdate(io, team);

    logger.debug({ playerId: pid, teamId, teamName: team.name }, 'Team created');
  });

  // ─── Invite to Team ───
  socket.on(ClientMessage.TeamInvite, (payload: unknown, callback?: (res: TeamResponse) => void) => {
    const pid = getPlayerId(socket);
    if (!pid) {
      callback?.({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!teamRateLimiter.check(pid, 'team_invite')) {
      callback?.({ success: false, error: 'Rate limited' });
      return;
    }

    if (!isValidTeamInvite(payload)) {
      callback?.({ success: false, error: 'Invalid payload' });
      return;
    }

    const team = getPlayerTeam(pid);
    if (!team) {
      callback?.({ success: false, error: 'Not in a team' });
      return;
    }

    // Only leader can invite
    const member = team.members.find((m) => m.playerId === pid);
    if (!member?.isLeader) {
      callback?.({ success: false, error: 'Only the team leader can invite' });
      return;
    }

    // Check team size
    if (team.members.length >= MAX_TEAM_SIZE) {
      callback?.({ success: false, error: 'Team is full' });
      return;
    }

    const targetId = payload.targetPlayerId;

    // Check target isn't already in a team
    if (playerTeamMap.has(targetId)) {
      callback?.({ success: false, error: 'Player is already in a team' });
      return;
    }

    // Check for duplicate invite
    if (team.pendingInvites.includes(targetId)) {
      callback?.({ success: false, error: 'Already invited' });
      return;
    }

    // Add pending invite
    team.pendingInvites.push(targetId);

    // Track invite for target player
    const existing = pendingInviteMap.get(targetId) ?? [];
    existing.push(team.id);
    pendingInviteMap.set(targetId, existing);

    // Notify target player
    io.to(`player:${targetId}`).emit('s:team_invite', {
      teamId: team.id,
      teamName: team.name,
      inviterId: pid,
      inviterName: getPlayerName(pid),
    });

    callback?.({ success: true });
    broadcastTeamUpdate(io, team);

    logger.debug({ playerId: pid, targetId, teamId: team.id }, 'Team invite sent');
  });

  // ─── Accept Team Invite ───
  socket.on(ClientMessage.TeamAccept, (payload: unknown, callback?: (res: TeamResponse) => void) => {
    const pid = getPlayerId(socket);
    if (!pid) {
      callback?.({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!teamRateLimiter.check(pid, 'team_accept')) {
      callback?.({ success: false, error: 'Rate limited' });
      return;
    }

    if (!isValidTeamAccept(payload)) {
      callback?.({ success: false, error: 'Invalid payload' });
      return;
    }

    // Check player isn't already in a team
    if (playerTeamMap.has(pid)) {
      callback?.({ success: false, error: 'Already in a team' });
      return;
    }

    const team = teams.get(payload.teamId);
    if (!team) {
      callback?.({ success: false, error: 'Team does not exist' });
      return;
    }

    // Check if player was invited
    const inviteIdx = team.pendingInvites.indexOf(pid);
    if (inviteIdx === -1) {
      callback?.({ success: false, error: 'No pending invite' });
      return;
    }

    // Check team size
    if (team.members.length >= MAX_TEAM_SIZE) {
      callback?.({ success: false, error: 'Team is full' });
      return;
    }

    // Remove invite
    team.pendingInvites.splice(inviteIdx, 1);

    // Remove from pending invite map
    const playerInvites = pendingInviteMap.get(pid);
    if (playerInvites) {
      const idx = playerInvites.indexOf(team.id);
      if (idx !== -1) playerInvites.splice(idx, 1);
      if (playerInvites.length === 0) pendingInviteMap.delete(pid);
    }

    // Add to team
    team.members.push({
      playerId: pid,
      playerName: getPlayerName(pid),
      isLeader: false,
      isOnline: true,
    });
    playerTeamMap.set(pid, team.id);

    callback?.({ success: true, teamId: team.id });
    broadcastTeamUpdate(io, team);

    logger.debug({ playerId: pid, teamId: team.id }, 'Team invite accepted');
  });

  // ─── Leave Team ───
  socket.on(ClientMessage.TeamLeave, (_payload: unknown, callback?: (res: TeamResponse) => void) => {
    const pid = getPlayerId(socket);
    if (!pid) {
      callback?.({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!teamRateLimiter.check(pid, 'team_leave')) {
      callback?.({ success: false, error: 'Rate limited' });
      return;
    }

    const team = getPlayerTeam(pid);
    if (!team) {
      callback?.({ success: false, error: 'Not in a team' });
      return;
    }

    const memberIdx = team.members.findIndex((m) => m.playerId === pid);
    if (memberIdx === -1) {
      callback?.({ success: false, error: 'Not in team' });
      return;
    }

    const wasLeader = team.members[memberIdx]!.isLeader;

    // Remove member
    team.members.splice(memberIdx, 1);
    playerTeamMap.delete(pid);

    // If team is now empty, delete it
    if (team.members.length === 0) {
      teams.delete(team.id);
      callback?.({ success: true });
      logger.debug({ playerId: pid, teamId: team.id }, 'Team disbanded (last member left)');
      return;
    }

    // If leader left, promote the next member
    if (wasLeader && team.members.length > 0) {
      team.members[0]!.isLeader = true;
    }

    callback?.({ success: true });
    broadcastTeamUpdate(io, team);

    logger.debug({ playerId: pid, teamId: team.id }, 'Player left team');
  });

  // ─── Kick from Team ───
  socket.on(ClientMessage.TeamKick, (payload: unknown, callback?: (res: TeamResponse) => void) => {
    const pid = getPlayerId(socket);
    if (!pid) {
      callback?.({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!teamRateLimiter.check(pid, 'team_kick')) {
      callback?.({ success: false, error: 'Rate limited' });
      return;
    }

    if (!isValidTeamKick(payload)) {
      callback?.({ success: false, error: 'Invalid payload' });
      return;
    }

    const team = getPlayerTeam(pid);
    if (!team) {
      callback?.({ success: false, error: 'Not in a team' });
      return;
    }

    // Only leader can kick
    const leader = team.members.find((m) => m.playerId === pid);
    if (!leader?.isLeader) {
      callback?.({ success: false, error: 'Only the leader can kick members' });
      return;
    }

    // Can't kick yourself
    if (payload.targetPlayerId === pid) {
      callback?.({ success: false, error: 'Cannot kick yourself' });
      return;
    }

    const targetIdx = team.members.findIndex((m) => m.playerId === payload.targetPlayerId);
    if (targetIdx === -1) {
      callback?.({ success: false, error: 'Player not in team' });
      return;
    }

    // Remove from team
    team.members.splice(targetIdx, 1);
    playerTeamMap.delete(payload.targetPlayerId);

    // Notify kicked player
    io.to(`player:${payload.targetPlayerId}`).emit('s:notification', {
      type: 'warning',
      message: `You were kicked from team "${team.name}"`,
      duration: 5000,
    });

    callback?.({ success: true });
    broadcastTeamUpdate(io, team);

    logger.debug({ playerId: pid, targetId: payload.targetPlayerId, teamId: team.id }, 'Player kicked from team');
  });

  logger.debug({ socketId: socket.id }, 'Team handlers registered');
}

// ─── Exported Utilities ───

/** Called when a player disconnects to mark them offline in their team */
export function handlePlayerDisconnect(io: Server, playerId: string): void {
  const team = getPlayerTeam(playerId);
  if (!team) return;

  const member = team.members.find((m) => m.playerId === playerId);
  if (member) {
    member.isOnline = false;
    broadcastTeamUpdate(io, team);
  }
}

/** Called when a player connects to mark them online in their team */
export function handlePlayerConnect(io: Server, playerId: string): void {
  const team = getPlayerTeam(playerId);
  if (!team) return;

  const member = team.members.find((m) => m.playerId === playerId);
  if (member) {
    member.isOnline = true;
    broadcastTeamUpdate(io, team);
  }
}