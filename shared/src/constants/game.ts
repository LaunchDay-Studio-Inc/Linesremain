// ─── Game Constants ───

// ─── Tick & Timing ───
export const TICK_RATE = 20; // server ticks per second
export const TICK_INTERVAL_MS = 1000 / TICK_RATE; // 50ms per tick
export const DAY_LENGTH_SECONDS = 600; // 10 real minutes = 1 game day
export const NIGHT_START = 0.75; // timeOfDay when night begins
export const NIGHT_END = 0.25; // timeOfDay when night ends

// ─── World & Chunks ───
export const CHUNK_SIZE_X = 32;
export const CHUNK_SIZE_Y = 64;
export const CHUNK_SIZE_Z = 32;
export const WORLD_SIZE = 4096; // world width/depth in blocks
export const WORLD_SIZE_CHUNKS = WORLD_SIZE / CHUNK_SIZE_X; // 128 chunks per axis
export const SEA_LEVEL = 32;
export const VIEW_DISTANCE_CHUNKS = 5;
export const MAX_BUILD_HEIGHT = CHUNK_SIZE_Y - 1;

// ─── Player Movement ───
export const PLAYER_WALK_SPEED = 4.0; // blocks per second
export const PLAYER_SPRINT_SPEED = 6.5; // blocks per second
export const PLAYER_CROUCH_SPEED = 2.0; // blocks per second
export const PLAYER_SWIM_SPEED = 3.0; // blocks per second
export const PLAYER_JUMP_VELOCITY = 8.0; // initial upward velocity
export const PLAYER_HEIGHT = 1.8; // blocks
export const PLAYER_WIDTH = 0.6; // blocks
export const PLAYER_EYE_HEIGHT = 1.6; // blocks

// ─── Physics ───
export const GRAVITY = -20.0; // blocks per second²
export const TERMINAL_VELOCITY = -50.0; // blocks per second
export const FALL_DAMAGE_THRESHOLD = 4.0; // blocks fallen before damage
export const FALL_DAMAGE_PER_BLOCK = 10.0; // HP per block over threshold

// ─── Interaction ───
export const INTERACT_RANGE = 4.0; // blocks
export const BUILD_RANGE = 6.0; // blocks
export const BLOCK_BREAK_RANGE = 5.0; // blocks
export const PICKUP_RANGE = 3.0; // blocks

// ─── Inventory ───
export const PLAYER_INVENTORY_SLOTS = 30;
export const HOTBAR_SLOTS = 6;
export const CONTAINER_SLOTS_SMALL = 12;
export const CONTAINER_SLOTS_LARGE = 30;

// ─── Spawning ───
export const PLAYER_SPAWN_PROTECTION_SECONDS = 60;
export const DROPPED_ITEM_DESPAWN_SECONDS = 300; // 5 minutes
export const CORPSE_DESPAWN_SECONDS = 300; // 5 minutes

// ─── Networking ───
export const MAX_CHAT_MESSAGE_LENGTH = 256;
export const MAX_TEAM_SIZE = 8;
export const SNAPSHOT_SEND_RATE = 10; // snapshots per second
export const MAX_PENDING_CHUNKS = 8; // max concurrent chunk requests

// ─── Respawn ───
export const RESPAWN_COOLDOWN_SECONDS = 5;
