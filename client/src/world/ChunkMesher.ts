// ─── Greedy Chunk Mesher ───

import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '@shared/constants/game';
import { BlockType } from '@shared/types/blocks';
import { getBlockDef, isOpaque } from './BlockRegistry';
import type { FaceUV } from './BlockRegistry';

// ─── Types ───

export interface ChunkMeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  aoValues: Float32Array;
}

export interface NeighborChunks {
  north?: Uint8Array; // +Z
  south?: Uint8Array; // -Z
  east?: Uint8Array;  // +X
  west?: Uint8Array;  // -X
}

// ─── Block Index ───

function blockIndex(x: number, y: number, z: number): number {
  return x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
}

function getBlock(data: Uint8Array, x: number, y: number, z: number): number {
  if (x < 0 || x >= CHUNK_SIZE_X || y < 0 || y >= CHUNK_SIZE_Y || z < 0 || z >= CHUNK_SIZE_Z) {
    return BlockType.Air;
  }
  return data[blockIndex(x, y, z)]!;
}

function getBlockWithNeighbors(
  data: Uint8Array,
  neighbors: NeighborChunks,
  x: number,
  y: number,
  z: number,
): number {
  if (y < 0 || y >= CHUNK_SIZE_Y) return BlockType.Air;

  if (x < 0) {
    return neighbors.west ? neighbors.west[blockIndex(CHUNK_SIZE_X + x, y, z)]! : BlockType.Air;
  }
  if (x >= CHUNK_SIZE_X) {
    return neighbors.east ? neighbors.east[blockIndex(x - CHUNK_SIZE_X, y, z)]! : BlockType.Air;
  }
  if (z < 0) {
    return neighbors.south ? neighbors.south[blockIndex(x, y, CHUNK_SIZE_Z + z)]! : BlockType.Air;
  }
  if (z >= CHUNK_SIZE_Z) {
    return neighbors.north ? neighbors.north[blockIndex(x, y, z - CHUNK_SIZE_Z)]! : BlockType.Air;
  }

  return data[blockIndex(x, y, z)]!;
}

// ─── Face Directions ───

// Each face: [normalX, normalY, normalZ, axisU, axisV, axisW]
// axisU/V are the two axes of the slice plane, axisW is the normal axis
const FACES = [
  { name: 'posX', nx: 1, ny: 0, nz: 0, uAxis: 2, vAxis: 1, wAxis: 0, dir: 1 },  // east
  { name: 'negX', nx: -1, ny: 0, nz: 0, uAxis: 2, vAxis: 1, wAxis: 0, dir: -1 }, // west
  { name: 'posY', nx: 0, ny: 1, nz: 0, uAxis: 0, vAxis: 2, wAxis: 1, dir: 1 },   // top
  { name: 'negY', nx: 0, ny: -1, nz: 0, uAxis: 0, vAxis: 2, wAxis: 1, dir: -1 }, // bottom
  { name: 'posZ', nx: 0, ny: 0, nz: 1, uAxis: 0, vAxis: 1, wAxis: 2, dir: 1 },   // north
  { name: 'negZ', nx: 0, ny: 0, nz: -1, uAxis: 0, vAxis: 1, wAxis: 2, dir: -1 }, // south
] as const;

const AXIS_SIZES = [CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z];

type FaceName = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';

function getFaceName(face: typeof FACES[number]): FaceName {
  switch (face.name) {
    case 'posX': return 'east';
    case 'negX': return 'west';
    case 'posY': return 'top';
    case 'negY': return 'bottom';
    case 'posZ': return 'north';
    case 'negZ': return 'south';
  }
}

// ─── AO Calculation ───

// Helper to select coordinate by axis index (avoids literal-type narrowing errors from FACES `as const`)
function coord(axis: number, x: number, y: number, z: number): number {
  return axis === 0 ? x : axis === 1 ? y : z;
}

// Reusable coordinate arrays to avoid per-call allocations in hot inner loop
const _aoSideA = [0, 0, 0];
const _aoSideB = [0, 0, 0];
const _aoCorner = [0, 0, 0];

function computeAO(
  data: Uint8Array,
  neighbors: NeighborChunks,
  x: number,
  y: number,
  z: number,
  face: typeof FACES[number],
  cornerU: number,
  cornerV: number,
): number {
  // Compute the face-offset w coordinate once
  const wOffset = coord(face.wAxis, x, y, z) + face.dir;

  // sideA: offset w + offset u
  _aoSideA[0] = x; _aoSideA[1] = y; _aoSideA[2] = z;
  _aoSideA[face.wAxis] = wOffset;
  _aoSideA[face.uAxis] = coord(face.uAxis, x, y, z) + cornerU;

  // sideB: offset w + offset v
  _aoSideB[0] = x; _aoSideB[1] = y; _aoSideB[2] = z;
  _aoSideB[face.wAxis] = wOffset;
  _aoSideB[face.vAxis] = coord(face.vAxis, x, y, z) + cornerV;

  // corner: offset w + offset u + offset v
  _aoCorner[0] = x; _aoCorner[1] = y; _aoCorner[2] = z;
  _aoCorner[face.wAxis] = wOffset;
  _aoCorner[face.uAxis] = coord(face.uAxis, x, y, z) + cornerU;
  _aoCorner[face.vAxis] = coord(face.vAxis, x, y, z) + cornerV;

  const s1 = isOpaque(getBlockWithNeighbors(data, neighbors, _aoSideA[0]!, _aoSideA[1]!, _aoSideA[2]!)) ? 1 : 0;
  const s2 = isOpaque(getBlockWithNeighbors(data, neighbors, _aoSideB[0]!, _aoSideB[1]!, _aoSideB[2]!)) ? 1 : 0;
  const c = isOpaque(getBlockWithNeighbors(data, neighbors, _aoCorner[0]!, _aoCorner[1]!, _aoCorner[2]!)) ? 1 : 0;

  if (s1 && s2) return 0; // Full occlusion
  return 3 - (s1 + s2 + c);
}

function aoToFloat(ao: number): number {
  // 0 → 0.25, 1 → 0.5, 2 → 0.75, 3 → 1.0
  return (ao + 1) / 4;
}

// ─── Greedy Meshing ───

export function meshChunk(
  chunkData: Uint8Array,
  chunkX: number,
  chunkZ: number,
  neighborChunks: NeighborChunks = {},
): { opaque: ChunkMeshData; transparent: ChunkMeshData } {
  const opaquePositions: number[] = [];
  const opaqueNormals: number[] = [];
  const opaqueUvs: number[] = [];
  const opaqueIndices: number[] = [];
  const opaqueAo: number[] = [];

  const transPositions: number[] = [];
  const transNormals: number[] = [];
  const transUvs: number[] = [];
  const transIndices: number[] = [];
  const transAo: number[] = [];

  const worldOffsetX = chunkX * CHUNK_SIZE_X;
  const worldOffsetZ = chunkZ * CHUNK_SIZE_Z;

  for (const face of FACES) {
    const uSize = AXIS_SIZES[face.uAxis]!;
    const vSize = AXIS_SIZES[face.vAxis]!;
    const wSize = AXIS_SIZES[face.wAxis]!;

    // For each slice along the normal axis
    for (let w = 0; w < wSize; w++) {
      // Build the face mask for this slice
      const mask = new Int16Array(uSize * vSize);
      const aoMask = new Float32Array(uSize * vSize * 4); // 4 AO values per face

      for (let v = 0; v < vSize; v++) {
        for (let u = 0; u < uSize; u++) {
          const pos = [0, 0, 0];
          pos[face.uAxis] = u;
          pos[face.vAxis] = v;
          pos[face.wAxis] = w;

          const blockId = getBlock(chunkData, pos[0]!, pos[1]!, pos[2]!);

          if (blockId === BlockType.Air) {
            mask[u + v * uSize] = -1;
            continue;
          }

          // Check adjacent block in face direction
          const adjPos = [pos[0]!, pos[1]!, pos[2]!];
          adjPos[face.wAxis] = adjPos[face.wAxis]! + face.dir;

          const adjBlock = getBlockWithNeighbors(
            chunkData,
            neighborChunks,
            adjPos[0]!,
            adjPos[1]!,
            adjPos[2]!,
          );

          const blockDef = getBlockDef(blockId);
          const adjDef = getBlockDef(adjBlock);

          // Show face if adjacent is transparent (and not same transparent type)
          const showFace =
            adjDef.isTransparent && (blockId !== adjBlock || !blockDef.isTransparent);

          if (!showFace) {
            mask[u + v * uSize] = -1;
            continue;
          }

          mask[u + v * uSize] = blockId;

          // Compute AO for 4 corners
          const idx = (u + v * uSize) * 4;
          const x = pos[0]!;
          const y = pos[1]!;
          const z = pos[2]!;

          // Map U/V corner offsets to -1/+1 for AO sampling
          const aoCorners: [number, number][] = [
            [-1, -1], [1, -1], [1, 1], [-1, 1],
          ];

          for (let ci = 0; ci < 4; ci++) {
            const ao = computeAO(
              chunkData,
              neighborChunks,
              x, y, z,
              face,
              aoCorners[ci]![0],
              aoCorners[ci]![1],
            );
            aoMask[idx + ci] = aoToFloat(ao);
          }
        }
      }

      // Greedy merge the mask
      const visited = new Uint8Array(uSize * vSize);

      for (let v = 0; v < vSize; v++) {
        for (let u = 0; u < uSize; u++) {
          const maskIdx = u + v * uSize;
          if (visited[maskIdx] || mask[maskIdx] === -1) continue;

          const blockId = mask[maskIdx]!;
          const blockDef = getBlockDef(blockId);
          const isTransparent = blockDef.isTransparent;

          // Get AO for this cell
          const baseAoIdx = maskIdx * 4;
          const baseAo = [
            aoMask[baseAoIdx]!,
            aoMask[baseAoIdx + 1]!,
            aoMask[baseAoIdx + 2]!,
            aoMask[baseAoIdx + 3]!,
          ];

          // Extend right (u direction)
          let width = 1;
          while (u + width < uSize) {
            const ni = (u + width) + v * uSize;
            if (visited[ni] || mask[ni] !== blockId) break;
            // Check AO matches for smooth merging
            const nAoIdx = ni * 4;
            let aoMatch = true;
            for (let ci = 0; ci < 4; ci++) {
              if (Math.abs(aoMask[nAoIdx + ci]! - baseAo[ci]!) > 0.01) {
                aoMatch = false;
                break;
              }
            }
            if (!aoMatch) break;
            width++;
          }

          // Extend down (v direction)
          let height = 1;
          outerLoop:
          while (v + height < vSize) {
            for (let du = 0; du < width; du++) {
              const ni = (u + du) + (v + height) * uSize;
              if (visited[ni] || mask[ni] !== blockId) break outerLoop;
              const nAoIdx = ni * 4;
              for (let ci = 0; ci < 4; ci++) {
                if (Math.abs(aoMask[nAoIdx + ci]! - baseAo[ci]!) > 0.01) {
                  break outerLoop;
                }
              }
            }
            height++;
          }

          // Mark as visited
          for (let dv = 0; dv < height; dv++) {
            for (let du = 0; du < width; du++) {
              visited[(u + du) + (v + dv) * uSize] = 1;
            }
          }

          // Emit quad
          const positions = isTransparent ? transPositions : opaquePositions;
          const normals = isTransparent ? transNormals : opaqueNormals;
          const uvs = isTransparent ? transUvs : opaqueUvs;
          const indices = isTransparent ? transIndices : opaqueIndices;
          const aoArr = isTransparent ? transAo : opaqueAo;

          const vertexStart = positions.length / 3;

          // 4 vertices for the quad
          // Corner positions: (u,v), (u+w,v), (u+w,v+h), (u,v+h)
          const quadCorners: [number, number][] = [
            [u, v],
            [u + width, v],
            [u + width, v + height],
            [u, v + height],
          ];

          // Get face UV from block definition
          const faceName = getFaceName(face);
          const faceUV: FaceUV = blockDef.faces[faceName];

          for (let ci = 0; ci < 4; ci++) {
            const cu = quadCorners[ci]![0];
            const cv = quadCorners[ci]![1];

            const pos = [0, 0, 0];
            pos[face.uAxis] = cu;
            pos[face.vAxis] = cv;
            pos[face.wAxis] = w + (face.dir > 0 ? 1 : 0);

            positions.push(
              pos[0]! + worldOffsetX,
              pos[1]!,
              pos[2]! + worldOffsetZ,
            );

            normals.push(face.nx, face.ny, face.nz);

            // UV mapping: tile within the atlas cell
            const uvCorners: [number, number][] = [
              [0, 1], [1, 1], [1, 0], [0, 0],
            ];
            const uvCorner = uvCorners[ci]!;
            uvs.push(
              faceUV.u + uvCorner[0] * faceUV.w,
              faceUV.v + uvCorner[1] * faceUV.h,
            );

            aoArr.push(baseAo[ci]!);
          }

          // Triangle indices — flip based on AO to avoid diagonal artifacts
          const a00 = baseAo[0]!;
          const a10 = baseAo[1]!;
          const a11 = baseAo[2]!;
          const a01 = baseAo[3]!;

          if (a00 + a11 > a10 + a01) {
            // Standard winding
            indices.push(
              vertexStart, vertexStart + 1, vertexStart + 2,
              vertexStart, vertexStart + 2, vertexStart + 3,
            );
          } else {
            // Flipped winding
            indices.push(
              vertexStart + 1, vertexStart + 2, vertexStart + 3,
              vertexStart + 1, vertexStart + 3, vertexStart,
            );
          }
        }
      }
    }
  }

  return {
    opaque: {
      positions: new Float32Array(opaquePositions),
      normals: new Float32Array(opaqueNormals),
      uvs: new Float32Array(opaqueUvs),
      indices: new Uint32Array(opaqueIndices),
      aoValues: new Float32Array(opaqueAo),
    },
    transparent: {
      positions: new Float32Array(transPositions),
      normals: new Float32Array(transNormals),
      uvs: new Float32Array(transUvs),
      indices: new Uint32Array(transIndices),
      aoValues: new Float32Array(transAo),
    },
  };
}