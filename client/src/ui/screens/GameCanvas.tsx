// ─── Game Canvas ───

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Engine } from '../../engine/Engine';
import { CameraController } from '../../engine/Camera';
import { InputManager } from '../../engine/InputManager';
import { useGameStore } from '../../stores/useGameStore';

// ─── Scene Setup Helpers ───

function createLighting(scene: THREE.Scene): void {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
  sunLight.position.set(50, 80, 30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  scene.add(sunLight);

  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.3);
  scene.add(hemisphereLight);
}

function createGround(scene: THREE.Scene): void {
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x4a7c3f,
    roughness: 0.9,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(200, 50, 0x3a6b30, 0x3a6b30);
  grid.position.y = 0.01;
  (grid.material as THREE.Material).opacity = 0.3;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);
}

function createPlayerMesh(scene: THREE.Scene): THREE.Mesh {
  const playerGeo = new THREE.BoxGeometry(1, 2, 1);
  const playerMat = new THREE.MeshStandardMaterial({
    color: 0xf0a500,
    roughness: 0.6,
    metalness: 0.1,
  });
  const playerMesh = new THREE.Mesh(playerGeo, playerMat);
  playerMesh.position.set(0, 1, 0);
  playerMesh.castShadow = true;
  scene.add(playerMesh);
  return playerMesh;
}

function createEnvironment(scene: THREE.Scene): void {
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
  const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.8 });

  // Scatter some blocks
  const blockPositions = [
    { x: 5, z: 3, mat: blockMat },
    { x: 6, z: 3, mat: blockMat },
    { x: 5, z: 4, mat: blockMat },
    { x: -4, z: -6, mat: stoneMat },
    { x: -3, z: -6, mat: stoneMat },
    { x: -4, z: -5, mat: stoneMat },
    { x: -3, z: -5, mat: stoneMat },
    { x: -4, z: -6, mat: stoneMat, y: 1 },
  ];

  for (const bp of blockPositions) {
    const block = new THREE.Mesh(blockGeo, bp.mat);
    block.position.set(bp.x, (bp.y ?? 0) + 0.5, bp.z);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
  }

  // Simple trees
  const treePositions = [
    { x: -8, z: 5 },
    { x: 10, z: -4 },
    { x: -3, z: 12 },
    { x: 15, z: 8 },
    { x: -12, z: -10 },
  ];

  for (const tp of treePositions) {
    const trunkGeo = new THREE.BoxGeometry(1, 4, 1);
    const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
    trunk.position.set(tp.x, 2, tp.z);
    trunk.castShadow = true;
    scene.add(trunk);

    for (let lx = -1; lx <= 1; lx++) {
      for (let ly = 0; ly <= 2; ly++) {
        for (let lz = -1; lz <= 1; lz++) {
          if (ly === 2 && Math.abs(lx) + Math.abs(lz) > 1) continue;
          const leaf = new THREE.Mesh(blockGeo, treeLeafMat);
          leaf.position.set(tp.x + lx, 4 + ly + 0.5, tp.z + lz);
          leaf.castShadow = true;
          leaf.receiveShadow = true;
          scene.add(leaf);
        }
      }
    }
  }
}

// ─── Game Loop Setup ───

function setupGameLoop(
  engine: Engine,
  cameraController: CameraController,
  input: InputManager,
  playerMesh: THREE.Mesh,
): void {
  const playerVelocity = new THREE.Vector3();
  const moveSpeed = 8;
  const gravity = -25;
  const jumpForce = 10;
  let verticalVelocity = 0;
  let isGrounded = true;
  const groundY = 1;
  const cameraOrbitSpeed = 120;

  engine.onUpdate((dt) => {
    // Arrow key camera orbit
    if (input.isKeyDown('ArrowLeft')) cameraController.rotateAzimuth(cameraOrbitSpeed * dt);
    if (input.isKeyDown('ArrowRight')) cameraController.rotateAzimuth(-cameraOrbitSpeed * dt);
    if (input.isKeyDown('ArrowUp')) cameraController.rotateElevation(cameraOrbitSpeed * dt);
    if (input.isKeyDown('ArrowDown')) cameraController.rotateElevation(-cameraOrbitSpeed * dt);

    // Player movement
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    const azimuthRad = (cameraController.getAzimuth() * Math.PI) / 180;
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), azimuthRad);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), azimuthRad);

    playerVelocity.set(0, 0, 0);
    if (input.isKeyDown('KeyW')) playerVelocity.add(forward);
    if (input.isKeyDown('KeyS')) playerVelocity.sub(forward);
    if (input.isKeyDown('KeyD')) playerVelocity.add(right);
    if (input.isKeyDown('KeyA')) playerVelocity.sub(right);

    if (playerVelocity.length() > 0) {
      playerVelocity.normalize().multiplyScalar(moveSpeed * dt);
      playerMesh.position.add(playerVelocity);
      const angle = Math.atan2(playerVelocity.x, playerVelocity.z);
      playerMesh.rotation.y = angle;
    }

    // Jump & gravity
    if (input.isKeyDown('Space') && isGrounded) {
      verticalVelocity = jumpForce;
      isGrounded = false;
    }

    verticalVelocity += gravity * dt;
    playerMesh.position.y += verticalVelocity * dt;

    if (playerMesh.position.y <= groundY) {
      playerMesh.position.y = groundY;
      verticalVelocity = 0;
      isGrounded = true;
    }

    // Camera follow
    cameraController.setTarget(
      playerMesh.position.x,
      playerMesh.position.y,
      playerMesh.position.z,
    );
    cameraController.update(dt);

    input.resetFrameState();
  });

  engine.onRender((_interpolation) => {
    // Render interpolation can be used for smooth visuals between fixed updates
  });
}

// ─── Component ───

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const cameraRef = useRef<CameraController | null>(null);
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize Engine
    const engine = new Engine(canvas);
    engineRef.current = engine;

    const scene = engine.getScene();
    const camera = engine.getCamera();

    // Camera Controller
    const cameraController = new CameraController(camera);
    cameraController.attach(canvas);
    cameraController.setTarget(0, 0, 0);
    cameraRef.current = cameraController;

    // Input Manager
    const input = InputManager.getInstance();

    // Build scene
    createLighting(scene);
    createGround(scene);
    const playerMesh = createPlayerMesh(scene);
    createEnvironment(scene);

    // Game loop
    setupGameLoop(engine, cameraController, input, playerMesh);
    engine.start();

    // Cleanup
    return () => {
      cameraController.detach();
      engine.dispose();
      input.dispose();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* HUD Overlay */}
      <div style={styles.hud}>
        <p style={styles.hudText}>WASD to move · Space to jump · Arrow keys or right-click to orbit · Scroll to zoom</p>
      </div>

      {/* Death overlay */}
      {screen === 'dead' && (
        <div style={styles.deathOverlay}>
          <h2 style={styles.deathText}>YOU DIED</h2>
          <p style={styles.deathSubtext}>Press R to respawn</p>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  hud: {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    pointerEvents: 'none',
  },
  hudText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    fontFamily: 'Inter, system-ui, sans-serif',
    letterSpacing: '1px',
    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
    margin: 0,
  },
  deathOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(139, 0, 0, 0.4)',
    pointerEvents: 'none',
  },
  deathText: {
    color: '#FF4444',
    fontSize: '48px',
    fontWeight: 900,
    fontFamily: 'Inter, system-ui, sans-serif',
    letterSpacing: '8px',
    margin: 0,
  },
  deathSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '16px',
    fontFamily: 'Inter, system-ui, sans-serif',
    letterSpacing: '2px',
    marginTop: '16px',
  },
};