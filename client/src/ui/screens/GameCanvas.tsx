// ─── Game Canvas ───
// Wires up the full game session: Engine, ChunkManager, Player Controller,
// Particle System, Animation System, Camera, Sky, Water, and FPS Counter.

import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  DAY_LENGTH_SECONDS,
  SEA_LEVEL,
} from '@shared/constants/game';
import { HAVEN_ISLAND } from '@shared/constants/islands';
import { BuildingPieceType, BuildingTier } from '@shared/types/buildings';
import {
  ClientMessage,
  ServerMessage,
  type CinematicTextPayload,
  type InputPayload,
  type JournalFoundPayload,
  type WorldChangePayload,
  type WorldEventPayload,
} from '@shared/types/network';
import { IslandTerrainGenerator } from '@shared/world/IslandTerrainGenerator';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { generateSpriteSheet } from '../../assets/SpriteGenerator';
import { AudioManager } from '../../engine/AudioManager';
import { CameraController } from '../../engine/Camera';
import { Engine } from '../../engine/Engine';
import { InputManager } from '../../engine/InputManager';
import { musicSystem } from '../../engine/MusicSystem';
import { ParticleSystem } from '../../engine/ParticleSystem';
import { BuildingPreview } from '../../entities/BuildingPreview';
import { BuildingRenderer } from '../../entities/BuildingRenderer';
import { ItemDropRenderer } from '../../entities/ItemDropRenderer';
import { LocalPlayerController } from '../../entities/LocalPlayerController';
import { LootBagRenderer } from '../../entities/LootBagRenderer';
import { NPCRenderer } from '../../entities/NPCRenderer';
import { PlayerRenderer } from '../../entities/PlayerRenderer';
import { ResourceNodeRenderer } from '../../entities/ResourceNodeRenderer';
import { SupplyDropRenderer } from '../../entities/SupplyDropRenderer';
import {
  getEntities,
  getLastServerTick,
  getLocalPlayerEntityId,
  setOnBlockChanged,
  worldTimeState,
} from '../../network/MessageHandler';
import { socketClient } from '../../network/SocketClient';
import { useAchievementStore } from '../../stores/useAchievementStore';
import { useChatStore } from '../../stores/useChatStore';
import { useEndgameStore } from '../../stores/useEndgameStore';
import { useGameStore } from '../../stores/useGameStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useUIStore } from '../../stores/useUIStore';
import { AnimationSystem } from '../../systems/AnimationSystem';
import { BlockInteraction } from '../../systems/BlockInteraction';
import { CombatEffects, type EntityHealthState } from '../../systems/CombatEffects';
import { EntityInterpolation } from '../../systems/EntityInterpolation';
import { LightingSystem } from '../../systems/LightingSystem';
import { BiomeParticleSystem } from '../../world/BiomeParticleSystem';
import { BiomeTracker } from '../../world/BiomeTracker';
import { ChunkManager } from '../../world/ChunkManager';
import { ClientTerrainGenerator } from '../../world/ClientTerrainGenerator';
import { SkyRenderer } from '../../world/SkyRenderer';
import { WaterRenderer } from '../../world/WaterRenderer';
import { WeatherSystem } from '../../world/WeatherSystem';
import { CinematicText } from '../hud/CinematicText';
import { FPSCounter } from '../hud/FPSCounter';
import { HUD } from '../hud/HUD';
import { BuildingPanel } from '../panels/BuildingPanel';
import { CodeLockPanel } from '../panels/CodeLockPanel';
import { ContainerPanel } from '../panels/ContainerPanel';
import { CraftingPanel } from '../panels/CraftingPanel';
import { InventoryPanel } from '../panels/InventoryPanel';
import { triggerJournalPopup } from '../panels/JournalPanel';
import { MapPanel } from '../panels/MapPanel';
import { ResearchPanel } from '../panels/ResearchPanel';
import { SettingsPanel } from '../panels/SettingsPanel';

// ─── Component ───

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const buildingPreviewRef = useRef<BuildingPreview | null>(null);
  const chunkManagerRef = useRef<ChunkManager | null>(null);
  const playerControllerRef = useRef<LocalPlayerController | null>(null);
  const toggleInventory = useUIStore((s) => s.toggleInventory);
  const toggleCrafting = useUIStore((s) => s.toggleCrafting);
  const toggleMap = useUIStore((s) => s.toggleMap);
  const toggleBuildingMode = useUIStore((s) => s.toggleBuildingMode);
  const toggleSettings = useUIStore((s) => s.toggleSettings);
  const closeAll = useUIStore((s) => s.closeAll);

  // Settings
  const showDebug = useSettingsStore((s) => s.showDebug);

  // Endgame panel state
  const codeLockPrompt = useEndgameStore((s) => s.codeLockPrompt);
  const setCodeLockPrompt = useEndgameStore((s) => s.setCodeLockPrompt);
  const containerOpen = useEndgameStore((s) => s.containerOpen);
  const setContainerOpen = useEndgameStore((s) => s.setContainerOpen);
  const researchProgress = useEndgameStore((s) => s.researchProgress);

  // Cinematic text overlay state
  const [cinematicData, setCinematicData] = useState<{
    text: string;
    subtitle?: string;
    duration: number;
    key: number;
  }>({ text: '', subtitle: undefined, duration: 5000, key: 0 });

  // Debug state for diagnosing input issues in iframe environments
  const [debugState, setDebugState] = useState<{
    hasFocus: boolean;
    lastKey: string;
  }>({ hasFocus: false, lastKey: '' });

  // Building panel callbacks
  const handleSelectPiece = useCallback((pieceType: BuildingPieceType, tier: BuildingTier) => {
    buildingPreviewRef.current?.activate(pieceType, tier);
  }, []);

  const handleCancelPreview = useCallback(() => {
    buildingPreviewRef.current?.deactivate();
  }, []);

  // Stable callback for FPS counter
  const getRenderer = useCallback(() => engineRef.current?.getRenderer() ?? null, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Initialize Engine ──
    const engine = new Engine(canvas);
    engineRef.current = engine;

    const scene = engine.getScene();
    const camera = engine.getCamera();

    // ── Camera Controller ──
    const cameraController = new CameraController(camera);
    cameraController.attach(canvas);

    // ── Input Manager ──
    const input = InputManager.getInstance();
    // Attach keyboard listeners directly to canvas (critical for iframe environments)
    input.attachToElement(canvas);
    // Apply persisted keybinds
    input.setKeybinds(useSettingsStore.getState().keybinds);

    // ── Sky Renderer (replaces manual lighting — handles sky dome, sun/moon, ambient, fog) ──
    const skyRenderer = new SkyRenderer(scene);
    skyRenderer.update(0.35); // Start at morning

    // ── Terrain Generators ──
    // Start with island world; switch to main world on teleport
    const islandGenerator = new IslandTerrainGenerator(42);
    const mainGenerator = new ClientTerrainGenerator(42);
    let activeGenerator: { generateChunk(cx: number, cz: number): Uint8Array } = islandGenerator;
    let playerWorld: 'islands' | 'main' = 'islands';

    // ── Chunk Manager (voxel terrain) ──
    const chunkManager = new ChunkManager(scene, 4);

    // Set up local chunk generation — routes through activeGenerator
    chunkManager.setChunkRequestCallback((cx, cz) => {
      const data = activeGenerator.generateChunk(cx, cz);
      chunkManager.onChunkDataReceived(cx, cz, data);
    });

    // Wire server block updates to the chunk manager
    setOnBlockChanged((wx, wy, wz, bt) => chunkManager.onBlockChanged(wx, wy, wz, bt));

    // ── Water Renderer (animated shader water planes) ──
    const waterRenderer = new WaterRenderer(scene);

    // ── Weather System (rain, clouds, fog adjustments) ──
    const weatherSystem = new WeatherSystem(scene);

    // ── Particle System ──
    const particleSystem = new ParticleSystem(scene);

    // ── Animation System ──
    const animationSystem = new AnimationSystem();

    // ── Block Interaction System ──
    const blockInteraction = new BlockInteraction(scene, camera, chunkManager, particleSystem);

    // ── Building Preview ──
    const buildingPreview = new BuildingPreview(scene, camera);
    buildingPreviewRef.current = buildingPreview;
    chunkManagerRef.current = chunkManager;

    // ── Building Renderer (placed buildings: foundations, walls, campfires, sleeping bags, etc.) ──
    const buildingRenderer = new BuildingRenderer(scene);

    // ── NPC Renderer (creatures: passive animals, hostiles, neutrals) ──
    const npcRenderer = new NPCRenderer(scene);

    // ── Combat Effects (floating damage numbers, blood particles) ──
    const combatEffects = new CombatEffects(scene, particleSystem);

    // ── Entity Interpolation (smooth remote entity movement) ──
    const entityInterpolation = new EntityInterpolation();

    // ── Biome Tracker (biome-specific atmosphere transitions) ──
    const biomeTracker = new BiomeTracker(mainGenerator);

    // ── Biome Particle System (biome-specific ambient particles) ──
    const biomeParticleSystem = new BiomeParticleSystem(scene);

    // ── Dynamic Lighting System (flickering campfire/torch point lights) ──
    const lightingSystem = new LightingSystem(scene);

    // Wire lighting system to building renderer for campfire point lights
    buildingRenderer.setLightingSystem(lightingSystem);

    // ── Resource Node Renderer (stone, metal ore, sulfur ore clusters) ──
    const resourceNodeRenderer = new ResourceNodeRenderer(scene);

    // ── Supply Drop Renderer (falling crates with smoke trails) ──
    const supplyDropRenderer = new SupplyDropRenderer(scene);

    // ── Item Drop Renderer (loot bags, dropped items from NPC kills) ──
    const itemDropRenderer = new ItemDropRenderer(scene);

    // ── Loot Bag Renderer (player death bags, lootable containers) ──
    const lootBagRenderer = new LootBagRenderer(scene);

    // ── Remote Player Tracking ──
    const remotePlayerRenderers = new Map<number, PlayerRenderer>();
    let lastFedTick = 0;
    let inputSeq = 0;
    let inputTimer = 0;
    let lastBiomeName = '';
    const INPUT_SEND_INTERVAL = 1 / 20; // Send input 20 times per second

    // ── Adaptive Quality (auto-reduce render distance on low FPS) ──
    let lowFpsTimer = 0;
    let fpsFrameCount = 0;
    let fpsAccum = 0;

    // ── Reusable vectors (zero-allocation per frame) ──
    const _playerVec = new THREE.Vector3();
    const _lightingVec = new THREE.Vector3();
    const _biomeParticleVec = new THREE.Vector3();
    const _npcVec = new THREE.Vector3();
    const _interpVec = new THREE.Vector3();

    // ── Reusable collections (avoid per-frame allocation) ──
    const _activeNpcIds = new Set<number>();
    const _activeBuildingIds = new Set<number>();
    const _activeResourceNodeIds = new Set<number>();
    const _activeRemotePlayerIds = new Set<number>();
    const _activeHealthIds = new Set<number>();
    const _activeItemDropIds = new Set<number>();
    const _activeLootBagIds = new Set<number>();
    const _healthStates: EntityHealthState[] = [];
    const _npcEntityData = new Map<
      number,
      {
        position: { x: number; y: number; z: number };
        health?: { current: number; max: number };
      }
    >();

    // ── Throttle counters ──
    let debugThrottleCounter = 0;
    let healthPruneCounter = 0;
    let _lastSentYaw = 0;
    let _settingsCacheCounter = 0;
    let _cachedSettings = useSettingsStore.getState();
    const isOffline = useGameStore.getState().isOffline;

    // ── View distance squared for entity culling ──
    const VIEW_DIST_SQ = 4 * CHUNK_SIZE_X * (4 * CHUNK_SIZE_X);

    // ── Player Sprite & Renderer ──
    const customization = useAchievementStore.getState().customization;
    const { canvas: spriteCanvas, config: spriteConfig } = generateSpriteSheet(
      customization.bodyColor || '#ffffff',
      customization.accessory || 'none',
      customization.bodyType || 'striker',
    );
    const playerRenderer = new PlayerRenderer(spriteCanvas, spriteConfig);
    playerRenderer.addToScene(scene);
    animationSystem.register('local', playerRenderer);

    // ── Player Controller ──
    const playerController = new LocalPlayerController(
      input,
      cameraController,
      playerRenderer,
      chunkManager,
      camera,
    );
    playerControllerRef.current = playerController;

    // Wire particle system into player controller for footstep dust
    playerController.setParticleSystem(particleSystem);

    // ── Generate spawn chunk and find a dry-land spawn position ──
    const findSurfaceY = (chunkData: Uint8Array, lx: number, lz: number): number => {
      for (let y = CHUNK_SIZE_Y - 1; y >= 0; y--) {
        const idx = lx + lz * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
        const block = chunkData[idx]!;
        if (block !== 0 && block !== 14) {
          // not air, not water
          return y;
        }
      }
      return 0;
    };

    // Spawn at Haven Island center
    let spawnX = HAVEN_ISLAND.spawnX;
    let spawnZ = HAVEN_ISLAND.spawnZ;
    const spawnCX = Math.floor(spawnX / CHUNK_SIZE_X);
    const spawnCZ = Math.floor(spawnZ / CHUNK_SIZE_Z);
    const spawnChunkData = activeGenerator.generateChunk(spawnCX, spawnCZ);
    chunkManager.onChunkDataReceived(spawnCX, spawnCZ, spawnChunkData);
    const localX = ((spawnX % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const localZ = ((spawnZ % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    const surfaceY = findSurfaceY(spawnChunkData, localX, localZ);
    let spawnY = surfaceY + 2.5;

    // If surface is below sea level (underwater), search outward for dry land
    if (surfaceY < SEA_LEVEL) {
      let found = false;
      searchLoop: for (let radius = 1; radius <= 6; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            // Only check the ring perimeter, not the interior
            if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
            const cx = spawnCX + dx;
            const cz = spawnCZ + dz;
            const chunkData = activeGenerator.generateChunk(cx, cz);
            chunkManager.onChunkDataReceived(cx, cz, chunkData);
            // Check center of this chunk
            const checkX = Math.floor(CHUNK_SIZE_X / 2);
            const checkZ = Math.floor(CHUNK_SIZE_Z / 2);
            const sy = findSurfaceY(chunkData, checkX, checkZ);
            if (sy >= SEA_LEVEL) {
              spawnX = cx * CHUNK_SIZE_X + checkX;
              spawnZ = cz * CHUNK_SIZE_Z + checkZ;
              spawnY = sy + 2.5;
              found = true;
              break searchLoop;
            }
          }
        }
      }
      if (!found) {
        spawnY = SEA_LEVEL + 5;
      }
    }

    playerController.setPosition(spawnX, spawnY, spawnZ);

    // ── Give starter items in offline mode ──
    if (useGameStore.getState().isOffline) {
      const playerStore = usePlayerStore.getState();
      const starterInv: (import('@shared/types/items').ItemStack | null)[] = Array(
        playerStore.inventory.length,
      ).fill(null);
      starterInv[0] = { itemId: 1, quantity: 50 }; // Wood
      starterInv[1] = { itemId: 2, quantity: 30 }; // Stone
      starterInv[2] = { itemId: 22, quantity: 1 }; // Stone Hatchet
      playerStore.setInventory(starterInv);
    }

    // Sync water planes with initially loaded chunks
    waterRenderer.syncWithChunks(chunkManager.getLoadedChunkKeys());

    // ── Day/night cycle state ──
    let worldTime = 0.35; // Start at morning

    // ── UI keybinds ──
    const handleUIKeys = (e: KeyboardEvent) => {
      // Don't process game keybinds when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        return;
      }

      // Don't process letter keys when chat is open
      const chatOpen = useChatStore.getState().isOpen;

      if (e.key === 'Tab') {
        e.preventDefault();
        toggleInventory();
      } else if (e.key === 'Escape') {
        closeAll();
      } else if (e.key === 'F1') {
        e.preventDefault();
        toggleSettings();
      } else if (!chatOpen) {
        // Only process letter keybinds when chat is closed
        if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) {
          toggleCrafting();
        } else if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey) {
          toggleMap();
        } else if ((e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.metaKey) {
          toggleBuildingMode();
        } else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
          buildingPreview.rotate();
        } else if (e.key >= '1' && e.key <= '6') {
          usePlayerStore.getState().setHotbarIndex(parseInt(e.key) - 1);
        }
      }
    };
    window.addEventListener('keydown', handleUIKeys);

    // ── Click Handling (building placement, focus, audio init) ──
    const audio = AudioManager.getInstance();
    const handleClick = (e: MouseEvent) => {
      // Don't capture clicks on interactive UI elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      // Re-focus canvas so keyboard events (WASD) are received
      canvas.focus();

      if (buildingPreview.active && buildingPreview.isValid) {
        // Place building piece
        const data = buildingPreview.getPlacementData();
        if (data) {
          if (!useGameStore.getState().isOffline) {
            socketClient.emit(ClientMessage.BuildPlace, {
              pieceType: data.pieceType,
              tier: data.tier,
              position: data.position,
              rotation: data.rotation,
            });
          }
          AudioManager.getInstance().play('blockPlace');
        }
      }
      // Initialize audio on first user gesture
      audio.init();
      musicSystem.init();
    };
    canvas.addEventListener('click', handleClick);
    // Fallback: window mousedown catches clicks that land on HUD overlay divs
    const handleWindowMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }
      // Focus canvas if click landed on an overlay div
      if (target !== canvas) {
        canvas.focus();
      }
      audio.init();
      musicSystem.init();
    };
    window.addEventListener('mousedown', handleWindowMouseDown);

    // Prevent context menu so right-click can place blocks
    const handleContextMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('contextmenu', handleContextMenu);

    // ── World Event Socket Handlers ──
    const handleWorldEvent = (data: unknown) => {
      const payload = data as WorldEventPayload;
      if (payload.eventType === 'blood_moon') {
        skyRenderer.setBloodMoon(payload.active);
      } else if (payload.eventType === 'supply_drop' && payload.active && payload.position) {
        const dropId = `drop_${payload.position.x}_${payload.position.z}`;
        supplyDropRenderer.addDrop(dropId, payload.position);
      } else if (payload.eventType === 'fog') {
        weatherSystem.setWeather(payload.active ? 'cloudy' : 'clear');
      }
    };

    const handleJournalFound = (data: unknown) => {
      const payload = data as JournalFoundPayload;
      triggerJournalPopup(payload.title, payload.text);
    };

    const handleCinematicText = (data: unknown) => {
      const payload = data as CinematicTextPayload;
      setCinematicData((prev) => ({
        text: payload.text,
        subtitle: payload.subtitle,
        duration: payload.duration,
        key: prev.key + 1,
      }));
    };

    const handleWorldChange = (data: unknown) => {
      const payload = data as WorldChangePayload;
      if (payload.world === playerWorld) return; // already in this world
      playerWorld = payload.world;
      if (playerWorld === 'main') {
        activeGenerator = mainGenerator;
      } else {
        activeGenerator = islandGenerator;
      }
      // Clear all loaded chunks so they regenerate with the new terrain
      chunkManager.clearAll();
    };

    // Only register socket event listeners when not in offline mode
    if (!useGameStore.getState().isOffline) {
      socketClient.on(ServerMessage.WorldEvent, handleWorldEvent);
      socketClient.on(ServerMessage.JournalFound, handleJournalFound);
      socketClient.on(ServerMessage.CinematicText, handleCinematicText);
      socketClient.on(ServerMessage.WorldChange, handleWorldChange);
    }

    // ── Game Loop ──
    engine.onUpdate((dt) => {
      // Recover canvas focus if lost (critical for iframe environments like Codespaces)
      if (document.activeElement !== canvas) {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          canvas.focus();
        }
      }

      // Update debug state for diagnostics overlay (throttled to ~1/sec)
      debugThrottleCounter++;
      if (debugThrottleCounter >= 60) {
        debugThrottleCounter = 0;
        setDebugState({
          hasFocus: document.activeElement === canvas,
          lastKey: input.getLastPressedKey(),
        });
      }

      // Player update
      playerController.update(dt);

      // Update chunks around player
      const pos = playerController.getPosition();
      chunkManager.update(pos.x, pos.z);

      // Offline tutorial step detection
      if (isOffline) {
        const achStore = useAchievementStore.getState();
        if (!achStore.tutorialComplete) {
          const step = achStore.tutorialStep;
          if (step === 'move') {
            const dist = Math.sqrt((pos.x - spawnX) ** 2 + (pos.z - spawnZ) ** 2);
            if (dist > 5) achStore.setTutorialStep('gather');
          }
        }
      }

      // Sync water planes with loaded chunks
      waterRenderer.syncWithChunks(chunkManager.getLoadedChunkKeys());
      waterRenderer.update(dt);

      // Day/night cycle — sync with server time, interpolate between broadcasts
      if (!isOffline) {
        const serverTime = worldTimeState.timeOfDay;
        let diff = serverTime - worldTime;
        // Handle wrapping (e.g., 0.99 → 0.01)
        if (diff > 0.5) diff -= 1;
        if (diff < -0.5) diff += 1;
        // Snap if too far off, otherwise blend
        if (Math.abs(diff) > 0.1) {
          worldTime = serverTime;
        } else {
          worldTime = (((worldTime + diff * 0.05 + dt / DAY_LENGTH_SECONDS) % 1) + 1) % 1;
        }
      } else {
        worldTime = (worldTime + dt / DAY_LENGTH_SECONDS) % 1;
      }
      skyRenderer.update(worldTime);
      skyRenderer.followCamera(camera);

      // Weather system update (rain, clouds follow player)
      _playerVec.set(pos.x, pos.y, pos.z);
      weatherSystem.update(dt, _playerVec);

      // Animation system
      animationSystem.update(dt);

      // ── Single-pass entity processing ──
      const entities = getEntities();
      const localPlayerId = getLocalPlayerEntityId();
      const camPos = camera.position;

      // Clear reusable collections
      _activeNpcIds.clear();
      _activeBuildingIds.clear();
      _activeResourceNodeIds.clear();
      _activeRemotePlayerIds.clear();
      _activeHealthIds.clear();
      _activeItemDropIds.clear();
      _activeLootBagIds.clear();
      _healthStates.length = 0;
      _npcEntityData.clear();

      // Determine if we should feed interpolation this frame
      const currentTick = getLastServerTick();
      const feedInterpolation = currentTick > lastFedTick;
      let interpNow = 0;
      if (feedInterpolation) {
        lastFedTick = currentTick;
        interpNow = Date.now();
      }

      for (const [entityId, entity] of entities) {
        const entPos = entity.components['Position'] as
          | { x: number; y: number; z: number }
          | undefined;
        if (!entPos) continue;

        const isLocalPlayer = entityId === localPlayerId;
        const npcType = entity.components['NPCType'] as
          | { creatureType?: string; isBoss?: boolean }
          | undefined;
        const isNPC = !!npcType?.creatureType;
        const entHealth = entity.components['Health'] as
          | { current: number; max: number }
          | undefined;

        // Health tracking (for combat effects)
        if (entHealth) {
          _activeHealthIds.add(entityId);
          _healthStates.push({
            entityId,
            position: entPos,
            health: entHealth,
            isNPC,
            isPlayer: !isNPC,
          });
        }

        if (isLocalPlayer) continue;

        // Skip entities beyond view distance
        const dx = entPos.x - camPos.x;
        const dz = entPos.z - camPos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > VIEW_DIST_SQ) continue;

        // Interpolation snapshots
        if (feedInterpolation) {
          const rot = entity.components['Rotation'] as { yaw?: number } | undefined;
          _interpVec.set(entPos.x, entPos.y, entPos.z);
          entityInterpolation.addSnapshot(String(entityId), interpNow, _interpVec, rot?.yaw ?? 0);
        }

        // NPC processing
        if (isNPC) {
          _activeNpcIds.add(entityId);
          if (!npcRenderer.hasNPC(entityId)) {
            _npcVec.set(entPos.x, entPos.y, entPos.z);
            npcRenderer.addNPC(entityId, npcType!.creatureType!, _npcVec, npcType!.isBoss ?? false);
          }
          _npcEntityData.set(entityId, { position: entPos, health: entHealth });
          continue;
        }

        // Building processing
        const building = entity.components['Building'] as
          | { pieceType: string; tier: string }
          | undefined;
        if (building) {
          _activeBuildingIds.add(entityId);
          if (!buildingRenderer.getMesh(entityId)) {
            const rotation = (entPos as { rotation?: number }).rotation ?? 0;
            buildingRenderer.addBuilding(
              entityId,
              building.pieceType as BuildingPieceType,
              building.tier as unknown as BuildingTier,
              entPos,
              rotation,
            );
          }
          continue;
        }

        // Resource node processing (stone, metal ore, sulfur ore)
        const resourceNode = entity.components['ResourceNode'] as
          | { resourceItemId: number; amountRemaining: number; maxAmount: number }
          | undefined;
        if (resourceNode) {
          _activeResourceNodeIds.add(entityId);
          const existingData = resourceNodeRenderer.getNodeData(entityId);
          if (!existingData) {
            resourceNodeRenderer.addNode(
              entityId,
              resourceNode.resourceItemId,
              resourceNode.amountRemaining,
              resourceNode.maxAmount,
              entPos,
            );
          } else {
            // Update depletion if amount changed
            if (existingData.amountRemaining !== resourceNode.amountRemaining) {
              resourceNodeRenderer.updateDepletion(
                entityId,
                resourceNode.amountRemaining,
                resourceNode.maxAmount,
              );
            }
          }
          continue;
        }

        // Loot bag processing (player death bags, lootable containers)
        const lootable = entity.components['Lootable'] as { isLooted: boolean } | undefined;
        if (lootable) {
          _activeLootBagIds.add(entityId);
          const isPlayerBag = !entHealth; // Player bags have no Health; loot containers do
          if (!lootBagRenderer.hasBag(entityId)) {
            _npcVec.set(entPos.x, entPos.y, entPos.z);
            lootBagRenderer.addBag(entityId, _npcVec, isPlayerBag);
          }
          continue;
        }

        // Item drop processing (individual items from NPC kills)
        const inventory = entity.components['Inventory'] as
          | { slots: ({ itemId: number; quantity: number } | null)[] }
          | undefined;
        if (inventory && !entHealth) {
          _activeItemDropIds.add(entityId);
          if (!itemDropRenderer.getDropData(entityId)) {
            // Find the first non-null item slot
            const firstItem = inventory.slots?.find((s) => s !== null);
            if (firstItem) {
              itemDropRenderer.addDrop(entityId, firstItem.itemId, firstItem.quantity, entPos);
            }
          }
          continue;
        }

        // Only treat entities with Velocity as remote players (skip sleeping bags, etc.)
        const velocity = entity.components['Velocity'];
        if (!velocity) continue;

        // Remote player processing
        _activeRemotePlayerIds.add(entityId);
        if (!remotePlayerRenderers.has(entityId)) {
          const hue = (entityId * 137) % 360;
          const color = `hsl(${hue}, 70%, 60%)`;
          const { canvas: rSprite, config: rConfig } = generateSpriteSheet(color);
          const rRenderer = new PlayerRenderer(rSprite, rConfig);
          rRenderer.addToScene(scene);
          animationSystem.register(String(entityId), rRenderer);
          remotePlayerRenderers.set(entityId, rRenderer);
        }
        const renderer = remotePlayerRenderers.get(entityId)!;
        const interpPos = entityInterpolation.getPosition(String(entityId));
        if (interpPos) {
          renderer.setPosition(interpPos.x, interpPos.y, interpPos.z);
        } else {
          renderer.setPosition(entPos.x, entPos.y, entPos.z);
        }
      }

      entityInterpolation.update(Date.now());

      // Sync NPC renderer
      npcRenderer.syncActiveEntities(_activeNpcIds);
      npcRenderer.update(dt, camera, _npcEntityData);

      // Remove stale buildings (iterate tracked meshes, not all entities)
      for (const eid of buildingRenderer.getAllMeshIds()) {
        if (!_activeBuildingIds.has(eid)) {
          buildingRenderer.removeBuilding(eid);
        }
      }

      // Remove stale resource nodes
      for (const eid of resourceNodeRenderer.getAllNodeIds()) {
        if (!_activeResourceNodeIds.has(eid)) {
          resourceNodeRenderer.removeNode(eid);
        }
      }

      // Remove stale item drops
      for (const dropId of itemDropRenderer.getAllDropIds()) {
        if (!_activeItemDropIds.has(dropId)) {
          itemDropRenderer.removeDrop(dropId);
        }
      }

      // Remove stale loot bags
      for (const bagId of lootBagRenderer.getAllBagIds()) {
        if (!_activeLootBagIds.has(bagId)) {
          lootBagRenderer.removeBag(bagId);
        }
      }

      // Remove departed remote players
      for (const [eid, rRenderer] of remotePlayerRenderers) {
        if (!_activeRemotePlayerIds.has(eid)) {
          rRenderer.removeFromScene(scene);
          rRenderer.dispose();
          animationSystem.unregister(String(eid));
          entityInterpolation.removeEntity(String(eid));
          remotePlayerRenderers.delete(eid);
        }
      }

      // Combat effects
      combatEffects.processEntityStates(_healthStates);
      combatEffects.update(dt);

      // Prune stale health tracking entries periodically (~every 5 seconds at 60fps)
      healthPruneCounter++;
      if (healthPruneCounter >= 300) {
        healthPruneCounter = 0;
        combatEffects.pruneHealthTracking(_activeHealthIds);

        // Also prune stale EntityInterpolation entries (entities no longer in server state)
        for (const interpId of entityInterpolation.getEntityIds()) {
          const numId = parseInt(interpId, 10);
          if (!isNaN(numId) && !entities.has(numId)) {
            entityInterpolation.removeEntity(interpId);
          }
        }
      }

      // Resource node rendering (billboard health bars, proximity checks)
      _playerVec.set(pos.x, pos.y, pos.z);
      resourceNodeRenderer.update(camera, _playerVec);

      // Item drop animations (bob, spin, glow)
      _playerVec.set(pos.x, pos.y, pos.z);
      itemDropRenderer.update(performance.now() / 1000, _playerVec);

      // Loot bag animations (bob, glow, proximity prompt)
      _playerVec.set(pos.x, pos.y, pos.z);
      lootBagRenderer.update(dt, camera, _playerVec);

      // Block interaction (raycast, breaking, placing)
      blockInteraction.update(dt);

      // Building preview (ghost mesh follows camera) — reuse vector
      _playerVec.set(pos.x, pos.y, pos.z);
      buildingPreview.update(chunkManager.getChunkMeshes(), _playerVec);

      // Particles
      particleSystem.update(dt);

      // Biome atmosphere tracking
      biomeTracker.update(pos.x, pos.z, dt);
      const atmosphere = biomeTracker.getCurrentAtmosphere();

      // Apply biome atmosphere to sky/fog/lighting
      skyRenderer.applyBiomeAtmosphere(
        atmosphere.fogColor,
        atmosphere.fogNear,
        atmosphere.fogFar,
        atmosphere.ambientTint,
      );

      // Track biome changes for HUD display
      const biomeName = biomeTracker.getBiomeDisplayName();
      if (biomeName !== lastBiomeName) {
        lastBiomeName = biomeName;
        usePlayerStore.getState().setCurrentBiome(biomeName);
      }

      // Biome-specific ambient particles — reuse vector
      _biomeParticleVec.set(pos.x, pos.y, pos.z);
      biomeParticleSystem.update(
        dt,
        _biomeParticleVec,
        atmosphere.particleType,
        atmosphere.particleDensity,
        worldTime,
      );

      // Procedural music system — use cached settings (re-read once per second)
      _settingsCacheCounter++;
      if (_settingsCacheCounter >= 60) {
        _settingsCacheCounter = 0;
        _cachedSettings = useSettingsStore.getState();
      }
      const settings = _cachedSettings;
      const buildingActive = buildingPreview.active;
      musicSystem.setVolume(settings.musicVolume / 100);
      musicSystem.setEnabled(settings.musicEnabled);
      musicSystem.update(dt, worldTime, false, buildingActive);

      // Apply FOV from settings
      if (camera.fov !== settings.fov) {
        camera.fov = settings.fov;
        camera.updateProjectionMatrix();
      }

      // Adaptive quality: auto-reduce render distance when FPS stays below 25
      fpsFrameCount++;
      fpsAccum += 1 / dt;
      if (fpsFrameCount >= 60) {
        const avgFps = fpsAccum / fpsFrameCount;
        if (avgFps < 25) {
          lowFpsTimer++;
          if (lowFpsTimer >= 3) {
            const current = settings.renderDistance;
            if (current > 3) {
              useSettingsStore.getState().setRenderDistance(current - 1);
            } else {
              // Already at min render distance — reduce pixel ratio
              engine.getRenderer().setPixelRatio(1);
            }
            lowFpsTimer = 0;
          }
        } else if (avgFps > 55) {
          lowFpsTimer = 0;
        }
        fpsFrameCount = 0;
        fpsAccum = 0;
      }

      // Dynamic lighting (flicker, distance culling) — reuse vector
      _lightingVec.set(pos.x, pos.y, pos.z);
      lightingSystem.update(dt, _lightingVec);

      // Supply drop crates
      supplyDropRenderer.update(dt);

      // Camera
      cameraController.update(dt);

      // Sync camera azimuth to store for minimap/compass (throttled — only on significant change)
      const newYaw = cameraController.getAzimuth();
      if (Math.abs(newYaw - _lastSentYaw) > 0.017) {
        _lastSentYaw = newYaw;
        usePlayerStore.getState().setYaw(newYaw);
      }

      // Send player input to server at fixed rate
      inputTimer += dt;
      if (inputTimer >= INPUT_SEND_INTERVAL) {
        inputTimer -= INPUT_SEND_INTERVAL;
        inputSeq++;
        const keybinds = input.keybinds;
        const inputPayload: InputPayload = {
          seq: inputSeq,
          forward:
            (input.isKeyDown(keybinds.moveForward) ? 1 : 0) -
            (input.isKeyDown(keybinds.moveBackward) ? 1 : 0),
          right:
            (input.isKeyDown(keybinds.moveRight) ? 1 : 0) -
            (input.isKeyDown(keybinds.moveLeft) ? 1 : 0),
          jump: input.isKeyDown(keybinds.jump),
          crouch: input.isKeyDown(keybinds.crouch),
          sprint: input.isKeyDown(keybinds.sprint),
          rotation: playerController.getYaw(),
          primaryAction: false,
          secondaryAction: false,
          selectedSlot: 0,
        };
        if (!isOffline) {
          socketClient.emit(ClientMessage.Input, inputPayload);
        }
      }

      // Reset input frame state
      input.resetFrameState();
    });

    engine.onRender((_interpolation) => {
      // Render interpolation can be used for smooth visuals between fixed updates
    });

    // ── Focus canvas for keyboard input ──
    canvas.focus();

    // ── Start ──
    engine.start();

    // ── Cleanup ──
    return () => {
      window.removeEventListener('keydown', handleUIKeys);
      window.removeEventListener('mousedown', handleWindowMouseDown);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      cameraController.detach();
      playerRenderer.removeFromScene(scene);
      // Clean up remote player renderers
      for (const [, renderer] of remotePlayerRenderers) {
        renderer.removeFromScene(scene);
        renderer.dispose();
      }
      remotePlayerRenderers.clear();
      entityInterpolation.clear();
      buildingPreview.dispose();
      buildingRenderer.dispose();
      blockInteraction.dispose();
      animationSystem.dispose();
      npcRenderer.dispose();
      resourceNodeRenderer.dispose();
      ResourceNodeRenderer.disposeSharedGeometries();
      combatEffects.dispose();
      particleSystem.dispose();
      biomeParticleSystem.dispose();
      biomeTracker.dispose();
      itemDropRenderer.dispose();
      lootBagRenderer.dispose();
      lightingSystem.dispose();
      supplyDropRenderer.dispose();
      weatherSystem.dispose();
      socketClient.off(ServerMessage.WorldEvent, handleWorldEvent);
      socketClient.off(ServerMessage.JournalFound, handleJournalFound);
      socketClient.off(ServerMessage.CinematicText, handleCinematicText);
      socketClient.off(ServerMessage.WorldChange, handleWorldChange);
      waterRenderer.dispose();
      skyRenderer.dispose();
      chunkManager.dispose();
      audio.dispose();
      engine.dispose();
      input.detachFromElement();
      input.dispose();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        style={{ display: 'block', width: '100%', height: '100%', outline: 'none' }}
      />

      {/* Debug overlay for input diagnostics */}
      {showDebug && (
        <div
          style={{
            position: 'fixed',
            top: 10,
            left: 10,
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#0f0',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '8px',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <div>Focus: {debugState.hasFocus ? 'CANVAS' : 'OTHER'}</div>
          <div>LastKey: {debugState.lastKey || 'none'}</div>
        </div>
      )}

      {/* Debug overlay */}
      <FPSCounter getRenderer={getRenderer} visible={showDebug} />

      {/* Cinematic text overlay */}
      <CinematicText
        key={cinematicData.key}
        text={cinematicData.text || null}
        subtitle={cinematicData.subtitle}
        duration={cinematicData.duration}
      />

      {/* Full game HUD */}
      <HUD />

      {/* Panels */}
      <InventoryPanel />
      <CraftingPanel />
      <BuildingPanel onSelectPiece={handleSelectPiece} onCancelPreview={handleCancelPreview} />
      <MapPanel />
      <SettingsPanel />

      {codeLockPrompt && (
        <CodeLockPanel
          isOpen={true}
          onClose={() => setCodeLockPrompt(null)}
          entityId={codeLockPrompt.entityId}
          isOwner={codeLockPrompt.isOwner}
        />
      )}

      {containerOpen && (
        <ContainerPanel
          isOpen={true}
          onClose={() => {
            setContainerOpen(null);
            if (!useGameStore.getState().isOffline) {
              socketClient.emit(ClientMessage.ContainerClose);
            }
          }}
          containerName={
            containerOpen.containerType === 'large_storage_box'
              ? 'Large Storage Box'
              : containerOpen.containerType === 'research_table'
                ? 'Research Table'
                : 'Storage Box'
          }
          containerSlots={containerOpen.slots}
        />
      )}

      {researchProgress && (
        <ResearchPanel
          isOpen={true}
          onClose={() => useEndgameStore.getState().setResearchProgress(null)}
          entityId={researchProgress.entityId}
        />
      )}
    </div>
  );
};
