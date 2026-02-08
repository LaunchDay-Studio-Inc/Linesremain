// ─── Game Canvas ───
// Wires up the full game session: Engine, ChunkManager, Player Controller,
// Particle System, Animation System, Camera, Sky, Water, and FPS Counter.

import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { Engine } from '../../engine/Engine';
import { CameraController } from '../../engine/Camera';
import { InputManager } from '../../engine/InputManager';
import { ParticleSystem } from '../../engine/ParticleSystem';
import { AudioManager } from '../../engine/AudioManager';
import { ChunkManager } from '../../world/ChunkManager';
import { SkyRenderer } from '../../world/SkyRenderer';
import { WaterRenderer } from '../../world/WaterRenderer';
import { ClientTerrainGenerator } from '../../world/ClientTerrainGenerator';
import { PlayerRenderer } from '../../entities/PlayerRenderer';
import { LocalPlayerController } from '../../entities/LocalPlayerController';
import { AnimationSystem } from '../../systems/AnimationSystem';
import { BlockInteraction } from '../../systems/BlockInteraction';
import { BuildingPreview } from '../../entities/BuildingPreview';
import { NPCRenderer } from '../../entities/NPCRenderer';
import { CombatEffects, type EntityHealthState } from '../../systems/CombatEffects';
import { EntityInterpolation } from '../../systems/EntityInterpolation';
import { generateSpriteSheet } from '../../assets/SpriteGenerator';
import { useUIStore } from '../../stores/useUIStore';
import { useChatStore } from '../../stores/useChatStore';
import { useGameStore } from '../../stores/useGameStore';
import { socketClient } from '../../network/SocketClient';
import { SEA_LEVEL, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, DAY_LENGTH_SECONDS } from '@shared/constants/game';
import { BuildingPieceType, BuildingTier } from '@shared/types/buildings';
import { ClientMessage, ServerMessage, type InputPayload, type WorldEventPayload, type JournalFoundPayload, type CinematicTextPayload } from '@shared/types/network';
import { setOnBlockChanged, getEntities, getLocalPlayerEntityId, getLastServerTick } from '../../network/MessageHandler';
import { HUD } from '../hud/HUD';
import { FPSCounter } from '../hud/FPSCounter';
import { InventoryPanel } from '../panels/InventoryPanel';
import { CraftingPanel } from '../panels/CraftingPanel';
import { BuildingPanel } from '../panels/BuildingPanel';
import { MapPanel } from '../panels/MapPanel';
import { SettingsPanel } from '../panels/SettingsPanel';
import { BiomeTracker } from '../../world/BiomeTracker';
import { BiomeParticleSystem } from '../../world/BiomeParticleSystem';
import { AmbientSynthesizer } from '../../engine/AmbientSynthesizer';
import { SupplyDropRenderer } from '../../entities/SupplyDropRenderer';
import { CinematicText } from '../hud/CinematicText';
import { triggerJournalPopup } from '../panels/JournalPanel';
import { ContainerPanel } from '../panels/ContainerPanel';
import { CodeLockPanel } from '../panels/CodeLockPanel';
import { ResearchPanel } from '../panels/ResearchPanel';
import { useEndgameStore } from '../../stores/useEndgameStore';

// ─── Component ───

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const buildingPreviewRef = useRef<BuildingPreview | null>(null);
  const chunkManagerRef = useRef<ChunkManager | null>(null);
  const playerControllerRef = useRef<LocalPlayerController | null>(null);
  const isOffline = useGameStore((s) => s.isOffline);
  const setCursorLocked = useUIStore((s) => s.setCursorLocked);
  const toggleInventory = useUIStore((s) => s.toggleInventory);
  const toggleCrafting = useUIStore((s) => s.toggleCrafting);
  const toggleMap = useUIStore((s) => s.toggleMap);
  const toggleBuildingMode = useUIStore((s) => s.toggleBuildingMode);
  const toggleSettings = useUIStore((s) => s.toggleSettings);
  const closeAll = useUIStore((s) => s.closeAll);

  // Endgame panel state
  const codeLockPrompt = useEndgameStore((s) => s.codeLockPrompt);
  const setCodeLockPrompt = useEndgameStore((s) => s.setCodeLockPrompt);
  const containerOpen = useEndgameStore((s) => s.containerOpen);
  const setContainerOpen = useEndgameStore((s) => s.setContainerOpen);
  const researchProgress = useEndgameStore((s) => s.researchProgress);

  // Cinematic text overlay state
  const [cinematicData, setCinematicData] = useState<{ text: string; subtitle?: string; duration: number; key: number }>({ text: '', subtitle: undefined, duration: 5000, key: 0 });

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

    // ── Sky Renderer (replaces manual lighting — handles sky dome, sun/moon, ambient, fog) ──
    const skyRenderer = new SkyRenderer(scene);
    skyRenderer.update(0.35); // Start at morning

    // ── Terrain Generator (full biome variety) ──
    const terrainGenerator = new ClientTerrainGenerator(42);

    // ── Chunk Manager (voxel terrain) ──
    const chunkManager = new ChunkManager(scene, 4);

    // Set up local chunk generation with the full terrain generator
    chunkManager.setChunkRequestCallback((cx, cz) => {
      const data = terrainGenerator.generateChunk(cx, cz);
      chunkManager.onChunkDataReceived(cx, cz, data);
    });

    // Wire server block updates to the chunk manager
    setOnBlockChanged((wx, wy, wz, bt) => chunkManager.onBlockChanged(wx, wy, wz, bt));

    // ── Water Renderer (animated shader water planes) ──
    const waterRenderer = new WaterRenderer(scene);

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

    // ── NPC Renderer (creatures: passive animals, hostiles, neutrals) ──
    const npcRenderer = new NPCRenderer(scene);

    // ── Combat Effects (floating damage numbers, blood particles) ──
    const combatEffects = new CombatEffects(scene, particleSystem);

    // ── Entity Interpolation (smooth remote entity movement) ──
    const entityInterpolation = new EntityInterpolation();

    // ── Biome Tracker (biome-specific atmosphere transitions) ──
    const biomeTracker = new BiomeTracker(terrainGenerator);

    // ── Biome Particle System (biome-specific ambient particles) ──
    const biomeParticleSystem = new BiomeParticleSystem(scene);

    // ── Ambient Synthesizer (procedural audio drones) ──
    const ambientSynth = new AmbientSynthesizer();

    // ── Supply Drop Renderer (falling crates with smoke trails) ──
    const supplyDropRenderer = new SupplyDropRenderer(scene);

    // ── Remote Player Tracking ──
    const remotePlayerRenderers = new Map<number, PlayerRenderer>();
    let lastFedTick = 0;
    let inputSeq = 0;
    let inputTimer = 0;
    const INPUT_SEND_INTERVAL = 1 / 20; // Send input 20 times per second

    // ── Player Sprite & Renderer ──
    const { canvas: spriteCanvas, config: spriteConfig } = generateSpriteSheet('#ffffff');
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

    // ── Generate spawn chunk so we can find surface height ──
    const spawnX = 16;
    const spawnZ = 16;
    const spawnCX = Math.floor(spawnX / CHUNK_SIZE_X);
    const spawnCZ = Math.floor(spawnZ / CHUNK_SIZE_Z);
    const spawnChunkData = terrainGenerator.generateChunk(spawnCX, spawnCZ);
    chunkManager.onChunkDataReceived(spawnCX, spawnCZ, spawnChunkData);
    const localX = ((spawnX % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const localZ = ((spawnZ % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    let spawnY = SEA_LEVEL + 10; // fallback
    if (spawnChunkData) {
      for (let y = CHUNK_SIZE_Y - 1; y >= 0; y--) {
        const idx = localX + localZ * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
        const block = spawnChunkData[idx]!;
        // Skip air and water — find actual solid ground
        if (block !== 0 && block !== 14) {
          spawnY = y + 1;
          break;
        }
      }
    }
    playerController.setPosition(spawnX, spawnY + 0.1, spawnZ);

    // Sync water planes with initially loaded chunks
    waterRenderer.syncWithChunks(chunkManager.getLoadedChunkKeys());

    // ── Day/night cycle state ──
    let worldTime = 0.35; // Start at morning

    // ── Pointer Lock tracking ──
    const handleLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      setCursorLocked(locked);
    };
    document.addEventListener('pointerlockchange', handleLockChange);

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
        }
      }
    };
    window.addEventListener('keydown', handleUIKeys);

    // ── Pointer Lock on Click ──
    const audio = AudioManager.getInstance();
    const handleClick = () => {
      if (!input.isPointerLocked()) {
        input.requestPointerLock(canvas);
      } else if (buildingPreview.active && buildingPreview.isValid) {
        // Place building piece
        const data = buildingPreview.getPlacementData();
        if (data) {
          if (!isOffline) {
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
      ambientSynth.init();
    };
    canvas.addEventListener('click', handleClick);

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
      }
    };

    const handleJournalFound = (data: unknown) => {
      const payload = data as JournalFoundPayload;
      triggerJournalPopup(payload.title, payload.text);
    };

    const handleCinematicText = (data: unknown) => {
      const payload = data as CinematicTextPayload;
      setCinematicData(prev => ({
        text: payload.text,
        subtitle: payload.subtitle,
        duration: payload.duration,
        key: prev.key + 1,
      }));
    };

    // Only register socket event listeners when not in offline mode
    if (!isOffline) {
      socketClient.on(ServerMessage.WorldEvent, handleWorldEvent);
      socketClient.on(ServerMessage.JournalFound, handleJournalFound);
      socketClient.on(ServerMessage.CinematicText, handleCinematicText);
    }

    // ── Game Loop ──
    engine.onUpdate((dt) => {
      // Player update
      playerController.update(dt);

      // Update chunks around player
      const pos = playerController.getPosition();
      chunkManager.update(pos.x, pos.z);

      // Sync water planes with loaded chunks
      waterRenderer.syncWithChunks(chunkManager.getLoadedChunkKeys());
      waterRenderer.update(dt);

      // Day/night cycle (accelerated: 1 game day = DAY_LENGTH_SECONDS real seconds)
      worldTime = (worldTime + dt / DAY_LENGTH_SECONDS) % 1;
      skyRenderer.update(worldTime);
      skyRenderer.followCamera(camera);

      // Animation system
      animationSystem.update(dt);

      // NPC rendering — sync NPC entities from server with renderer
      const entities = getEntities();
      const localPlayerId = getLocalPlayerEntityId();

      // Feed entity interpolation snapshots when new server tick arrives
      const currentTick = getLastServerTick();
      if (currentTick > lastFedTick) {
        lastFedTick = currentTick;
        const now = Date.now();
        for (const [entityId, entity] of entities) {
          if (entityId === localPlayerId) continue;
          const entPos = entity.components['Position'] as { x: number; y: number; z: number } | undefined;
          if (entPos) {
            const rot = entity.components['Rotation'] as { yaw?: number } | undefined;
            entityInterpolation.addSnapshot(
              String(entityId),
              now,
              new THREE.Vector3(entPos.x, entPos.y, entPos.z),
              rot?.yaw ?? 0,
            );
          }
        }
      }
      entityInterpolation.update(Date.now());

      const npcEntityData = new Map<number, {
        position: { x: number; y: number; z: number };
        health?: { current: number; max: number };
      }>();
      const activeNpcIds = new Set<number>();

      for (const [entityId, entity] of entities) {
        if (entityId === localPlayerId) continue;
        const npcType = entity.components['NPCType'] as { creatureType?: string } | undefined;
        if (!npcType?.creatureType) continue;

        activeNpcIds.add(entityId);
        const entPos = entity.components['Position'] as { x: number; y: number; z: number } | undefined;
        const entHealth = entity.components['Health'] as { current: number; max: number } | undefined;

        if (entPos) {
          if (!npcRenderer.hasNPC(entityId)) {
            npcRenderer.addNPC(entityId, npcType.creatureType, new THREE.Vector3(entPos.x, entPos.y, entPos.z));
          }
          npcEntityData.set(entityId, { position: entPos, health: entHealth });
        }
      }

      // Remove NPCs that are no longer in the entity list
      npcRenderer.syncActiveEntities(activeNpcIds);

      npcRenderer.update(dt, camera, npcEntityData);

      // Remote player rendering — sync remote player entities with renderers
      const activeRemotePlayerIds = new Set<number>();
      for (const [entityId, entity] of entities) {
        if (entityId === localPlayerId) continue;
        if (entity.components['NPCType']) continue;
        const entPos = entity.components['Position'] as { x: number; y: number; z: number } | undefined;
        if (!entPos) continue;

        activeRemotePlayerIds.add(entityId);

        // Create renderer for new remote players
        if (!remotePlayerRenderers.has(entityId)) {
          const hue = (entityId * 137) % 360;
          const color = `hsl(${hue}, 70%, 60%)`;
          const { canvas: rSprite, config: rConfig } = generateSpriteSheet(color);
          const rRenderer = new PlayerRenderer(rSprite, rConfig);
          rRenderer.addToScene(scene);
          animationSystem.register(String(entityId), rRenderer);
          remotePlayerRenderers.set(entityId, rRenderer);
        }

        // Update position (prefer interpolated)
        const renderer = remotePlayerRenderers.get(entityId)!;
        const interpPos = entityInterpolation.getPosition(String(entityId));
        if (interpPos) {
          renderer.setPosition(interpPos.x, interpPos.y, interpPos.z);
        } else {
          renderer.setPosition(entPos.x, entPos.y, entPos.z);
        }
      }

      // Remove departed remote players
      for (const [eid, renderer] of remotePlayerRenderers) {
        if (!activeRemotePlayerIds.has(eid)) {
          renderer.removeFromScene(scene);
          renderer.dispose();
          animationSystem.unregister(String(eid));
          entityInterpolation.removeEntity(String(eid));
          remotePlayerRenderers.delete(eid);
        }
      }

      // Combat effects — detect health changes and spawn damage numbers / blood
      const healthStates: EntityHealthState[] = [];
      for (const [entityId, entity] of entities) {
        const entPos = entity.components['Position'] as { x: number; y: number; z: number } | undefined;
        const entHealth = entity.components['Health'] as { current: number; max: number } | undefined;
        if (entPos && entHealth) {
          healthStates.push({
            entityId,
            position: entPos,
            health: entHealth,
            isNPC: !!entity.components['NPCType'],
            isPlayer: !entity.components['NPCType'],
          });
        }
      }
      combatEffects.processEntityStates(healthStates);
      combatEffects.update(dt);

      // Block interaction (raycast, breaking, placing)
      blockInteraction.update(dt);

      // Building preview (ghost mesh follows camera)
      const playerVec = new THREE.Vector3(pos.x, pos.y, pos.z);
      buildingPreview.update(chunkManager.getChunkMeshes(), playerVec);

      // Particles
      particleSystem.update(dt);

      // Biome atmosphere tracking
      biomeTracker.update(pos.x, pos.z, dt);
      const atmosphere = biomeTracker.getCurrentAtmosphere();

      // Biome-specific ambient particles
      biomeParticleSystem.update(
        dt,
        new THREE.Vector3(pos.x, pos.y, pos.z),
        atmosphere.particleType,
        atmosphere.particleDensity,
        worldTime,
      );

      // Ambient synthesizer mood
      ambientSynth.update(dt);
      ambientSynth.setMood(atmosphere.mood);

      // Supply drop crates
      supplyDropRenderer.update(dt);

      // Camera
      cameraController.update(dt);

      // Send player input to server at fixed rate
      inputTimer += dt;
      if (inputTimer >= INPUT_SEND_INTERVAL) {
        inputTimer -= INPUT_SEND_INTERVAL;
        inputSeq++;
        const keybinds = input.keybinds;
        const inputPayload: InputPayload = {
          seq: inputSeq,
          forward: (input.isKeyDown(keybinds.moveForward) ? 1 : 0) - (input.isKeyDown(keybinds.moveBackward) ? 1 : 0),
          right: (input.isKeyDown(keybinds.moveRight) ? 1 : 0) - (input.isKeyDown(keybinds.moveLeft) ? 1 : 0),
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

    // ── Start ──
    engine.start();

    // ── Cleanup ──
    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
      window.removeEventListener('keydown', handleUIKeys);
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
      blockInteraction.dispose();
      animationSystem.dispose();
      npcRenderer.dispose();
      combatEffects.dispose();
      particleSystem.dispose();
      biomeParticleSystem.dispose();
      biomeTracker.dispose();
      ambientSynth.dispose();
      supplyDropRenderer.dispose();
      socketClient.off(ServerMessage.WorldEvent, handleWorldEvent);
      socketClient.off(ServerMessage.JournalFound, handleJournalFound);
      socketClient.off(ServerMessage.CinematicText, handleCinematicText);
      waterRenderer.dispose();
      skyRenderer.dispose();
      chunkManager.dispose();
      audio.dispose();
      engine.dispose();
      input.dispose();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Debug overlay */}
      <FPSCounter getRenderer={getRenderer} />

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
            if (!isOffline) {
              socketClient.emit(ClientMessage.ContainerClose);
            }
          }}
          containerName={containerOpen.containerType === 'large_storage_box' ? 'Large Storage Box' : containerOpen.containerType === 'research_table' ? 'Research Table' : 'Storage Box'}
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
