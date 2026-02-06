// ─── Building Preview ───
// Ghost preview mesh for building placement. Shows a transparent green/red
// preview that snaps to the building grid, rotates with R key, and provides
// responsive visual feedback for valid/invalid placement.

import * as THREE from 'three';
import { BuildingPieceType, BuildingTier } from '@shared/types/buildings';
import { BUILD_RANGE } from '@shared/constants/game';

// ─── Constants ───

const FOUNDATION_SIZE = 3;
const WALL_HEIGHT = 3;
const VALID_COLOR = 0x00ff00;
const INVALID_COLOR = 0xff0000;
const PREVIEW_OPACITY = 0.4;
const ROTATION_STEP = Math.PI / 2; // 90° per R press

// ─── Geometry Cache (shared with BuildingRenderer via same keys) ───

const previewGeometryCache = new Map<string, THREE.BufferGeometry>();

function getOrCreateGeometry(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let geo = previewGeometryCache.get(key);
  if (!geo) {
    geo = factory();
    previewGeometryCache.set(key, geo);
  }
  return geo;
}

// ─── Geometry by Piece Type ───

function getPreviewGeometry(pieceType: BuildingPieceType): THREE.BufferGeometry {
  switch (pieceType) {
    case BuildingPieceType.Foundation:
      return getOrCreateGeometry('p-foundation', () =>
        new THREE.BoxGeometry(FOUNDATION_SIZE, 0.3, FOUNDATION_SIZE),
      );
    case BuildingPieceType.FoundationTriangle:
      return getOrCreateGeometry('p-foundation-tri', () => {
        const shape = new THREE.Shape();
        shape.moveTo(-FOUNDATION_SIZE / 2, -FOUNDATION_SIZE / 2);
        shape.lineTo(FOUNDATION_SIZE / 2, -FOUNDATION_SIZE / 2);
        shape.lineTo(0, FOUNDATION_SIZE / 2);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        return geo;
      });
    case BuildingPieceType.Wall:
      return getOrCreateGeometry('p-wall', () =>
        new THREE.BoxGeometry(FOUNDATION_SIZE, WALL_HEIGHT, 0.2),
      );
    case BuildingPieceType.HalfWall:
      return getOrCreateGeometry('p-half-wall', () =>
        new THREE.BoxGeometry(FOUNDATION_SIZE, WALL_HEIGHT / 2, 0.2),
      );
    case BuildingPieceType.Doorway:
    case BuildingPieceType.WindowFrame:
    case BuildingPieceType.WallFrame:
      return getOrCreateGeometry('p-doorway', () =>
        new THREE.BoxGeometry(FOUNDATION_SIZE, WALL_HEIGHT, 0.2),
      );
    case BuildingPieceType.Floor:
    case BuildingPieceType.FloorTriangle:
    case BuildingPieceType.FloorGrill:
      return getOrCreateGeometry('p-floor', () =>
        new THREE.BoxGeometry(FOUNDATION_SIZE, 0.2, FOUNDATION_SIZE),
      );
    case BuildingPieceType.Stairs:
      return getOrCreateGeometry('p-stairs', () =>
        new THREE.BoxGeometry(FOUNDATION_SIZE, WALL_HEIGHT, FOUNDATION_SIZE),
      );
    case BuildingPieceType.Roof:
      return getOrCreateGeometry('p-roof', () => {
        const shape = new THREE.Shape();
        shape.moveTo(-FOUNDATION_SIZE / 2, 0);
        shape.lineTo(FOUNDATION_SIZE / 2, 0);
        shape.lineTo(0, 1.5);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: FOUNDATION_SIZE, bevelEnabled: false });
        geo.translate(0, 0, -FOUNDATION_SIZE / 2);
        return geo;
      });
    case BuildingPieceType.Door:
      return getOrCreateGeometry('p-door', () =>
        new THREE.BoxGeometry(1, 2, 0.1),
      );
    case BuildingPieceType.Fence:
      return getOrCreateGeometry('p-fence', () =>
        new THREE.BoxGeometry(FOUNDATION_SIZE, 1, 0.1),
      );
    case BuildingPieceType.Pillar:
      return getOrCreateGeometry('p-pillar', () =>
        new THREE.BoxGeometry(0.3, WALL_HEIGHT, 0.3),
      );
    default:
      return getOrCreateGeometry('p-default', () =>
        new THREE.BoxGeometry(FOUNDATION_SIZE, 0.3, FOUNDATION_SIZE),
      );
  }
}

// ─── Snap to Grid ───

function snapToGrid(
  position: THREE.Vector3,
  pieceType: BuildingPieceType,
  rotation: number,
): THREE.Vector3 {
  const snapped = position.clone();

  switch (pieceType) {
    case BuildingPieceType.Foundation:
    case BuildingPieceType.FoundationTriangle:
      snapped.x = Math.round(position.x / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      snapped.z = Math.round(position.z / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      snapped.y = Math.round(position.y * 2) / 2;
      break;

    case BuildingPieceType.Wall:
    case BuildingPieceType.HalfWall:
    case BuildingPieceType.Doorway:
    case BuildingPieceType.WindowFrame:
    case BuildingPieceType.WallFrame:
    case BuildingPieceType.Fence: {
      snapped.x = Math.round(position.x / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      snapped.z = Math.round(position.z / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      const normalizedRot = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const quadrant = Math.round(normalizedRot / (Math.PI / 2)) % 4;
      if (quadrant === 0) snapped.z -= FOUNDATION_SIZE / 2;
      else if (quadrant === 1) snapped.x += FOUNDATION_SIZE / 2;
      else if (quadrant === 2) snapped.z += FOUNDATION_SIZE / 2;
      else snapped.x -= FOUNDATION_SIZE / 2;
      break;
    }

    case BuildingPieceType.Floor:
    case BuildingPieceType.FloorTriangle:
    case BuildingPieceType.FloorGrill:
    case BuildingPieceType.Roof:
      snapped.x = Math.round(position.x / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      snapped.z = Math.round(position.z / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      snapped.y = Math.round(position.y / WALL_HEIGHT) * WALL_HEIGHT;
      break;

    case BuildingPieceType.Stairs:
      snapped.x = Math.round(position.x / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      snapped.z = Math.round(position.z / FOUNDATION_SIZE) * FOUNDATION_SIZE;
      break;

    case BuildingPieceType.Pillar:
      snapped.x =
        Math.round((position.x + FOUNDATION_SIZE / 2) / FOUNDATION_SIZE) * FOUNDATION_SIZE -
        FOUNDATION_SIZE / 2;
      snapped.z =
        Math.round((position.z + FOUNDATION_SIZE / 2) / FOUNDATION_SIZE) * FOUNDATION_SIZE -
        FOUNDATION_SIZE / 2;
      break;

    case BuildingPieceType.Door:
      // Door snaps to doorway — no grid snap, handled by raycasting to doorway
      break;
  }

  return snapped;
}

// ─── Building Preview Class ───

export class BuildingPreview {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private mesh: THREE.Mesh | null = null;
  private validMaterial: THREE.MeshStandardMaterial;
  private invalidMaterial: THREE.MeshStandardMaterial;

  /** Currently selected piece type */
  private _pieceType: BuildingPieceType | null = null;
  /** Currently selected tier */
  private _tier: BuildingTier = BuildingTier.Twig;
  /** Current rotation in radians */
  private _rotation = 0;
  /** Whether the current preview position is valid for placement */
  private _isValid = false;
  /** Snapped position of the preview */
  private _snappedPosition = new THREE.Vector3();
  /** Whether preview is active */
  private _active = false;

  /** Raycaster for ground/surface detection */
  private raycaster = new THREE.Raycaster();
  /** Center of screen for raycasting */
  private screenCenter = new THREE.Vector2(0, 0);
  /** Max placement distance */
  private maxDistance = BUILD_RANGE;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;

    this.validMaterial = new THREE.MeshStandardMaterial({
      color: VALID_COLOR,
      transparent: true,
      opacity: PREVIEW_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.invalidMaterial = new THREE.MeshStandardMaterial({
      color: INVALID_COLOR,
      transparent: true,
      opacity: PREVIEW_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  // ─── Getters ───

  get pieceType(): BuildingPieceType | null {
    return this._pieceType;
  }

  get tier(): BuildingTier {
    return this._tier;
  }

  get rotation(): number {
    return this._rotation;
  }

  get isValid(): boolean {
    return this._isValid;
  }

  get snappedPosition(): THREE.Vector3 {
    return this._snappedPosition;
  }

  get active(): boolean {
    return this._active;
  }

  // ─── Activate Preview ───

  activate(pieceType: BuildingPieceType, tier: BuildingTier): void {
    this.deactivate();

    this._pieceType = pieceType;
    this._tier = tier;
    this._rotation = 0;
    this._active = true;

    const geometry = getPreviewGeometry(pieceType);
    this.mesh = new THREE.Mesh(geometry, this.validMaterial);
    this.mesh.renderOrder = 999; // Render on top
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.scene.add(this.mesh);
  }

  // ─── Deactivate Preview ───

  deactivate(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    this._pieceType = null;
    this._active = false;
    this._isValid = false;
  }

  // ─── Set Tier ───

  setTier(tier: BuildingTier): void {
    this._tier = tier;
  }

  // ─── Rotate (called when R key is pressed) ───

  rotate(): void {
    this._rotation = (this._rotation + ROTATION_STEP) % (Math.PI * 2);
  }

  // ─── Update (called each frame) ───

  update(
    groundMeshes: THREE.Object3D[],
    playerPosition: THREE.Vector3,
    _buildingMeshes?: THREE.Object3D[],
  ): void {
    if (!this._active || !this.mesh || !this._pieceType) return;

    // Raycast from camera center to find placement point
    this.raycaster.setFromCamera(this.screenCenter, this.camera);
    this.raycaster.far = this.maxDistance;

    const intersects = this.raycaster.intersectObjects(groundMeshes, true);

    if (intersects.length > 0) {
      const hit = intersects[0]!;
      const rawPosition = hit.point.clone();

      // Snap to grid
      this._snappedPosition = snapToGrid(rawPosition, this._pieceType, this._rotation);

      // Update mesh position and rotation
      this.mesh.position.copy(this._snappedPosition);
      this.mesh.rotation.y = this._rotation;

      // Validity check: distance from player
      const distSq = playerPosition.distanceToSquared(this._snappedPosition);
      const inRange = distSq <= this.maxDistance * this.maxDistance;

      // Basic validity (can be extended with collision checks)
      this._isValid = inRange;

      // Update material based on validity
      this.mesh.material = this._isValid ? this.validMaterial : this.invalidMaterial;
      this.mesh.visible = true;
    } else {
      // No intersection found — hide preview
      this.mesh.visible = false;
      this._isValid = false;
    }
  }

  // ─── Get Placement Data ───

  getPlacementData(): {
    pieceType: BuildingPieceType;
    tier: BuildingTier;
    position: { x: number; y: number; z: number };
    rotation: number;
  } | null {
    if (!this._active || !this._pieceType || !this._isValid) return null;

    return {
      pieceType: this._pieceType,
      tier: this._tier,
      position: {
        x: this._snappedPosition.x,
        y: this._snappedPosition.y,
        z: this._snappedPosition.z,
      },
      rotation: this._rotation,
    };
  }

  // ─── Dispose ───

  dispose(): void {
    this.deactivate();
    this.validMaterial.dispose();
    this.invalidMaterial.dispose();
  }

  // ─── Static: Cleanup shared caches ───

  static disposeSharedCaches(): void {
    for (const geo of previewGeometryCache.values()) {
      geo.dispose();
    }
    previewGeometryCache.clear();
  }
}