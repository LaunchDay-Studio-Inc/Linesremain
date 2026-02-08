// ─── Procedural Stickman Sprite Sheet Generator ───
// Premium stickman rendering with 14 unique body archetypes.
// Each archetype has distinct proportions, head shape, and visual details.

import {
  BODY_TYPE_DEFINITIONS,
  type BodyType,
  type BodyTypeDefinition,
} from '@shared/types/customization';

export type AnimationName = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'crouch' | 'attack' | 'die';

export interface SpriteSheetConfig {
  frameWidth: number;
  frameHeight: number;
  animations: Record<AnimationName, { row: number; frameCount: number }>;
}

const FRAME_W = 64;
const FRAME_H = 64;
const MAX_FRAMES = 8;
const NUM_ROWS = 8;

// Base proportions for accessory positioning fallback
const HEAD_RADIUS = 6;
const HEAD_Y = 14;
const CENTER_X = FRAME_W / 2;

export const SPRITE_SHEET_CONFIG: SpriteSheetConfig = {
  frameWidth: FRAME_W,
  frameHeight: FRAME_H,
  animations: {
    idle: { row: 0, frameCount: 4 },
    walk: { row: 1, frameCount: 8 },
    run: { row: 2, frameCount: 8 },
    jump: { row: 3, frameCount: 3 },
    fall: { row: 4, frameCount: 2 },
    crouch: { row: 5, frameCount: 2 },
    attack: { row: 6, frameCount: 4 },
    die: { row: 7, frameCount: 5 },
  },
};

// ─── Drawing Helpers ───

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  shape: BodyTypeDefinition['headShape'],
): void {
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      break;
    case 'oval':
      ctx.ellipse(x, y, radius * 0.8, radius, 0, 0, Math.PI * 2);
      break;
    case 'angular': {
      ctx.moveTo(x, y - radius);
      ctx.lineTo(x + radius, y);
      ctx.lineTo(x, y + radius);
      ctx.lineTo(x - radius, y);
      ctx.closePath();
      break;
    }
    case 'square': {
      const half = radius * 0.85;
      const r = radius * 0.25;
      ctx.moveTo(x - half + r, y - half);
      ctx.lineTo(x + half - r, y - half);
      ctx.quadraticCurveTo(x + half, y - half, x + half, y - half + r);
      ctx.lineTo(x + half, y + half - r);
      ctx.quadraticCurveTo(x + half, y + half, x + half - r, y + half);
      ctx.lineTo(x - half + r, y + half);
      ctx.quadraticCurveTo(x - half, y + half, x - half, y + half - r);
      ctx.lineTo(x - half, y - half + r);
      ctx.quadraticCurveTo(x - half, y - half, x - half + r, y - half);
      ctx.closePath();
      break;
    }
  }
  ctx.stroke();
}

// ─── Stickman Pose ───

interface StickmanPose {
  headOffset?: { x: number; y: number };
  bodyTilt?: number;
  leftArm: number;
  rightArm: number;
  leftLeg: number;
  rightLeg: number;
  crouchFactor?: number;
}

// ─── Premium Stickman Drawing ───

function drawStickmanBody(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  pose: StickmanPose,
  def: BodyTypeDefinition,
  headYPos: number,
  bodyLen: number,
  neckY: number,
  hipY: number,
  tilt: number,
): void {
  const bodyEndX = centerX + Math.sin(tilt) * bodyLen;
  const bodyEndY = hipY;

  // Head
  drawHead(ctx, centerX + (pose.headOffset?.x ?? 0), headYPos, def.headRadius, def.headShape);

  // Body
  drawLine(ctx, centerX, neckY, bodyEndX, bodyEndY);

  // Shoulders
  const shoulderY = neckY + bodyLen * 0.15;
  const shoulderX = centerX + Math.sin(tilt) * bodyLen * 0.15;
  const leftShoulderX = shoulderX - def.shoulderWidth;
  const rightShoulderX = shoulderX + def.shoulderWidth;

  if (def.shoulderWidth > 0) {
    drawLine(ctx, leftShoulderX, shoulderY, rightShoulderX, shoulderY);
  }

  // Arms
  drawLine(
    ctx,
    leftShoulderX,
    shoulderY,
    leftShoulderX + Math.sin(pose.leftArm) * def.armLength,
    shoulderY + Math.cos(pose.leftArm) * def.armLength,
  );
  drawLine(
    ctx,
    rightShoulderX,
    shoulderY,
    rightShoulderX + Math.sin(pose.rightArm) * def.armLength,
    shoulderY + Math.cos(pose.rightArm) * def.armLength,
  );

  // Hips
  const leftHipX = bodyEndX - def.hipWidth;
  const rightHipX = bodyEndX + def.hipWidth;

  if (def.hipWidth > 0) {
    drawLine(ctx, leftHipX, bodyEndY, rightHipX, bodyEndY);
  }

  // Legs
  drawLine(
    ctx,
    leftHipX,
    bodyEndY,
    leftHipX + Math.sin(pose.leftLeg) * def.legLength,
    bodyEndY + Math.cos(pose.leftLeg) * def.legLength,
  );
  drawLine(
    ctx,
    rightHipX,
    bodyEndY,
    rightHipX + Math.sin(pose.rightLeg) * def.legLength,
    bodyEndY + Math.cos(pose.rightLeg) * def.legLength,
  );
}

function drawStickman(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  pose: StickmanPose,
  def: BodyTypeDefinition,
  color: string,
): void {
  ctx.save();
  ctx.translate(offsetX, offsetY);

  const centerX = FRAME_W / 2;
  const crouch = pose.crouchFactor ?? 0;
  const bodyLen = def.bodyLength * (1 - crouch * 0.4);

  // Calculate total height to center vertically
  const totalHeight = def.headRadius * 2 + bodyLen + def.legLength;
  const startY = Math.max(4, (FRAME_H - totalHeight) / 2);

  const headYPos = startY + def.headRadius + (pose.headOffset?.y ?? 0) + crouch * 8;
  const neckY = headYPos + def.headRadius;
  const hipY = neckY + bodyLen;
  const tilt = pose.bodyTilt ?? 0;

  // ── Outline pass (if enabled) ──
  if (def.hasOutline) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = def.lineWidth + 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawStickmanBody(
      ctx,
      centerX,
      pose,
      {
        ...def,
        headRadius: def.headRadius + 1,
      },
      headYPos,
      bodyLen,
      neckY,
      hipY,
      tilt,
    );
    ctx.globalAlpha = 1;
  }

  // ── Main draw pass ──
  ctx.strokeStyle = color;
  ctx.lineWidth = def.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  drawStickmanBody(ctx, centerX, pose, def, headYPos, bodyLen, neckY, hipY, tilt);

  // Accent line (faint torso detail)
  if (def.accentLine) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    const accentStartY = neckY + bodyLen * 0.3;
    const accentEndY = hipY - 1;
    const bodyEndX = centerX + Math.sin(tilt) * bodyLen;
    const accentX = centerX + Math.sin(tilt) * bodyLen * 0.5 + 1;
    drawLine(ctx, accentX, accentStartY, bodyEndX + 1, accentEndY);
    ctx.restore();
  }

  // ── Eye dots (premium detail) ──
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6;
  const eyeY = headYPos - def.headRadius * 0.1;
  const eyeSpacing = def.headRadius * 0.35;
  const headXPos = centerX + (pose.headOffset?.x ?? 0);
  ctx.beginPath();
  ctx.arc(headXPos - eyeSpacing, eyeY, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(headXPos + eyeSpacing, eyeY, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ─── Animation Pose Generators ───

function getIdlePose(frame: number): StickmanPose {
  const breathe = Math.sin((frame / 4) * Math.PI * 2) * 0.5;
  return {
    headOffset: { x: 0, y: breathe },
    leftArm: -0.15,
    rightArm: 0.15,
    leftLeg: -0.08,
    rightLeg: 0.08,
  };
}

function getWalkPose(frame: number): StickmanPose {
  const t = (frame / 8) * Math.PI * 2;
  const swing = 0.45;
  return {
    leftArm: Math.sin(t) * swing,
    rightArm: -Math.sin(t) * swing,
    leftLeg: -Math.sin(t) * swing,
    rightLeg: Math.sin(t) * swing,
  };
}

function getRunPose(frame: number): StickmanPose {
  const t = (frame / 8) * Math.PI * 2;
  const swing = 0.7;
  return {
    bodyTilt: 0.15,
    leftArm: Math.sin(t) * swing * 0.8,
    rightArm: -Math.sin(t) * swing * 0.8,
    leftLeg: -Math.sin(t) * swing,
    rightLeg: Math.sin(t) * swing,
  };
}

function getJumpPose(frame: number): StickmanPose {
  if (frame === 0) {
    return {
      crouchFactor: 0.3,
      leftArm: 0.3,
      rightArm: -0.3,
      leftLeg: -0.4,
      rightLeg: 0.4,
    };
  }
  if (frame === 1) {
    return {
      headOffset: { x: 0, y: -3 },
      leftArm: -1.2,
      rightArm: 1.2,
      leftLeg: -0.2,
      rightLeg: 0.2,
    };
  }
  return {
    headOffset: { x: 0, y: -2 },
    leftArm: -1.5,
    rightArm: 1.5,
    leftLeg: 0.1,
    rightLeg: -0.1,
  };
}

function getFallPose(frame: number): StickmanPose {
  const flail = frame === 0 ? -0.3 : 0.3;
  return {
    headOffset: { x: 0, y: 2 },
    leftArm: -1.0 + flail,
    rightArm: 1.0 - flail,
    leftLeg: -0.5 + flail,
    rightLeg: 0.5 - flail,
  };
}

function getCrouchPose(frame: number): StickmanPose {
  const shift = frame === 0 ? 0 : 0.05;
  return {
    crouchFactor: 0.5,
    leftArm: -0.1 + shift,
    rightArm: 0.1 - shift,
    leftLeg: -0.3,
    rightLeg: 0.3,
  };
}

function getAttackPose(frame: number): StickmanPose {
  const swings = [-1.2, -0.3, 0.8, 0.2];
  const armAngle = swings[frame] ?? 0;
  return {
    bodyTilt: -0.1,
    leftArm: armAngle,
    rightArm: 0.2,
    leftLeg: -0.15,
    rightLeg: 0.15,
  };
}

function getDiePose(frame: number): StickmanPose {
  const progress = frame / 4;
  return {
    bodyTilt: progress * 1.4,
    headOffset: { x: progress * 5, y: progress * 3 },
    leftArm: progress * 1.2,
    rightArm: -progress * 0.5,
    leftLeg: progress * 0.3,
    rightLeg: -progress * 0.6,
  };
}

type PoseGenerator = (frame: number) => StickmanPose;

const POSE_GENERATORS: Record<AnimationName, PoseGenerator> = {
  idle: getIdlePose,
  walk: getWalkPose,
  run: getRunPose,
  jump: getJumpPose,
  fall: getFallPose,
  crouch: getCrouchPose,
  attack: getAttackPose,
  die: getDiePose,
};

// ─── Accessory Drawing ───

function drawAccessory(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  pose: StickmanPose,
  accessory: string,
  def: BodyTypeDefinition,
): void {
  const crouch = pose.crouchFactor ?? 0;
  const bodyLen = def.bodyLength * (1 - crouch * 0.4);
  const totalHeight = def.headRadius * 2 + bodyLen + def.legLength;
  const startY = Math.max(4, (FRAME_H - totalHeight) / 2);
  const headYPos = startY + def.headRadius + (pose.headOffset?.y ?? 0) + crouch * 8;
  const headXPos = CENTER_X + (pose.headOffset?.x ?? 0);
  const headR = def.headRadius;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  switch (accessory) {
    case 'crown': {
      ctx.strokeStyle = '#FFD700';
      ctx.fillStyle = '#FFD700';
      const crownY = headYPos - headR - 4;
      ctx.beginPath();
      ctx.moveTo(headXPos - 6, crownY + 4);
      ctx.lineTo(headXPos - 6, crownY);
      ctx.lineTo(headXPos - 3, crownY + 2);
      ctx.lineTo(headXPos, crownY - 1);
      ctx.lineTo(headXPos + 3, crownY + 2);
      ctx.lineTo(headXPos + 6, crownY);
      ctx.lineTo(headXPos + 6, crownY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'halo': {
      ctx.strokeStyle = '#FFE066';
      ctx.lineWidth = 1.5;
      const haloY = headYPos - headR - 5;
      ctx.beginPath();
      ctx.ellipse(headXPos, haloY, 8, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'horns': {
      ctx.strokeStyle = '#CC3333';
      ctx.lineWidth = 2;
      const hornBase = headYPos - headR;
      drawLine(ctx, headXPos - 5, hornBase, headXPos - 8, hornBase - 7);
      drawLine(ctx, headXPos + 5, hornBase, headXPos + 8, hornBase - 7);
      break;
    }
    case 'antenna': {
      ctx.strokeStyle = '#66FF66';
      ctx.lineWidth = 1.5;
      const antY = headYPos - headR;
      drawLine(ctx, headXPos, antY, headXPos, antY - 8);
      ctx.fillStyle = '#66FF66';
      ctx.beginPath();
      ctx.arc(headXPos, antY - 8, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bandana': {
      ctx.strokeStyle = '#E74C3C';
      ctx.lineWidth = 2.5;
      const bandY = headYPos - 1;
      drawLine(ctx, headXPos - headR, bandY, headXPos + headR, bandY);
      drawLine(ctx, headXPos + headR, bandY, headXPos + headR + 4, bandY + 3);
      break;
    }
  }

  ctx.restore();
}

// ─── Public API ───

/**
 * Generate a stickman sprite sheet as an HTMLCanvasElement.
 * Layout: rows = animations, columns = frames.
 */
export function generateSpriteSheet(
  color = '#ffffff',
  accessory = 'none',
  bodyType: BodyType = 'striker',
): {
  canvas: HTMLCanvasElement;
  config: SpriteSheetConfig;
} {
  const def = BODY_TYPE_DEFINITIONS[bodyType];

  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * MAX_FRAMES;
  canvas.height = FRAME_H * NUM_ROWS;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context for sprite sheet');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const [name, gen] of Object.entries(POSE_GENERATORS) as [AnimationName, PoseGenerator][]) {
    const animConfig = SPRITE_SHEET_CONFIG.animations[name];
    for (let f = 0; f < animConfig.frameCount; f++) {
      const pose = gen(f);
      const offsetX = f * FRAME_W;
      const offsetY = animConfig.row * FRAME_H;
      drawStickman(ctx, offsetX, offsetY, pose, def, color);
      if (accessory !== 'none') {
        drawAccessory(ctx, offsetX, offsetY, pose, accessory, def);
      }
    }
  }

  return { canvas, config: SPRITE_SHEET_CONFIG };
}

/**
 * Generate a single idle-pose preview for character selection.
 */
export function generateCharacterPreview(
  bodyType: BodyType,
  color: string,
  size = 128,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  const scale = size / FRAME_H;
  ctx.save();
  ctx.scale(scale, scale);

  const def = BODY_TYPE_DEFINITIONS[bodyType];
  const pose = getIdlePose(1);
  drawStickman(ctx, 0, 0, pose, def, color);

  ctx.restore();
  return canvas;
}
