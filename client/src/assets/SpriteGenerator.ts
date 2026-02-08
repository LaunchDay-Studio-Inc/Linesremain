// ─── Procedural Stickman Sprite Sheet Generator ───
// Generates a sprite sheet with stickman animations using Canvas2D.
// Each row = animation, each column = frame.

export type AnimationName = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'crouch' | 'attack' | 'die';

export interface SpriteSheetConfig {
  frameWidth: number;
  frameHeight: number;
  animations: Record<AnimationName, { row: number; frameCount: number }>;
}

const FRAME_W = 64;
const FRAME_H = 64;

// Stickman proportions (relative to frame)
const HEAD_RADIUS = 6;
const BODY_LEN = 16;
const ARM_LEN = 12;
const LEG_LEN = 14;
const LINE_WIDTH = 3;
const CENTER_X = FRAME_W / 2;
const HEAD_Y = 14;

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

const MAX_FRAMES = 8; // max frames in any animation
const NUM_ROWS = 8;

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

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

interface StickmanPose {
  headOffset?: { x: number; y: number };
  bodyTilt?: number; // radians
  leftArm: number; // angle in radians from vertical
  rightArm: number;
  leftLeg: number;
  rightLeg: number;
  crouchFactor?: number; // 0-1, compresses body
}

function drawStickman(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  pose: StickmanPose,
  color = '#ffffff',
  _opacity = 1,
): void {
  ctx.save();
  ctx.translate(offsetX, offsetY);

  ctx.strokeStyle = color;
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const crouch = pose.crouchFactor ?? 0;
  const bodyLen = BODY_LEN * (1 - crouch * 0.4);
  const headYPos = HEAD_Y + (pose.headOffset?.y ?? 0) + crouch * 8;
  const headXPos = CENTER_X + (pose.headOffset?.x ?? 0);
  const neckY = headYPos + HEAD_RADIUS;
  const hipY = neckY + bodyLen;

  const tilt = pose.bodyTilt ?? 0;

  // Head
  drawCircle(ctx, headXPos, headYPos, HEAD_RADIUS);

  // Body (with tilt)
  const bodyEndX = CENTER_X + Math.sin(tilt) * bodyLen;
  const bodyEndY = hipY;
  drawLine(ctx, CENTER_X, neckY, bodyEndX, bodyEndY);

  // Arms (from ~20% down body)
  const shoulderY = neckY + bodyLen * 0.15;
  const shoulderX = CENTER_X + Math.sin(tilt) * bodyLen * 0.15;

  const leftArmEndX = shoulderX + Math.sin(pose.leftArm) * ARM_LEN;
  const leftArmEndY = shoulderY + Math.cos(pose.leftArm) * ARM_LEN;
  drawLine(ctx, shoulderX, shoulderY, leftArmEndX, leftArmEndY);

  const rightArmEndX = shoulderX + Math.sin(pose.rightArm) * ARM_LEN;
  const rightArmEndY = shoulderY + Math.cos(pose.rightArm) * ARM_LEN;
  drawLine(ctx, shoulderX, shoulderY, rightArmEndX, rightArmEndY);

  // Legs (from hip)
  const leftLegEndX = bodyEndX + Math.sin(pose.leftLeg) * LEG_LEN;
  const leftLegEndY = bodyEndY + Math.cos(pose.leftLeg) * LEG_LEN;
  drawLine(ctx, bodyEndX, bodyEndY, leftLegEndX, leftLegEndY);

  const rightLegEndX = bodyEndX + Math.sin(pose.rightLeg) * LEG_LEN;
  const rightLegEndY = bodyEndY + Math.cos(pose.rightLeg) * LEG_LEN;
  drawLine(ctx, bodyEndX, bodyEndY, rightLegEndX, rightLegEndY);

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
    // Crouch before jump
    return {
      crouchFactor: 0.3,
      leftArm: 0.3,
      rightArm: -0.3,
      leftLeg: -0.4,
      rightLeg: 0.4,
    };
  }
  if (frame === 1) {
    // Mid-air
    return {
      headOffset: { x: 0, y: -3 },
      leftArm: -1.2,
      rightArm: 1.2,
      leftLeg: -0.2,
      rightLeg: 0.2,
    };
  }
  // Arms up
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
  const progress = frame / 4; // 0 to 1
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
): void {
  const crouch = pose.crouchFactor ?? 0;
  const headYPos = HEAD_Y + (pose.headOffset?.y ?? 0) + crouch * 8;
  const headXPos = CENTER_X + (pose.headOffset?.x ?? 0);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  switch (accessory) {
    case 'crown': {
      ctx.strokeStyle = '#FFD700';
      ctx.fillStyle = '#FFD700';
      const crownY = headYPos - HEAD_RADIUS - 4;
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
      const haloY = headYPos - HEAD_RADIUS - 5;
      ctx.beginPath();
      ctx.ellipse(headXPos, haloY, 8, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'horns': {
      ctx.strokeStyle = '#CC3333';
      ctx.lineWidth = 2;
      const hornBase = headYPos - HEAD_RADIUS;
      drawLine(ctx, headXPos - 5, hornBase, headXPos - 8, hornBase - 7);
      drawLine(ctx, headXPos + 5, hornBase, headXPos + 8, hornBase - 7);
      break;
    }
    case 'antenna': {
      ctx.strokeStyle = '#66FF66';
      ctx.lineWidth = 1.5;
      const antY = headYPos - HEAD_RADIUS;
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
      drawLine(ctx, headXPos - HEAD_RADIUS, bandY, headXPos + HEAD_RADIUS, bandY);
      drawLine(ctx, headXPos + HEAD_RADIUS, bandY, headXPos + HEAD_RADIUS + 4, bandY + 3);
      break;
    }
  }

  ctx.restore();
}

// ─── Public API ───

/**
 * Generate a stickman sprite sheet as an HTMLCanvasElement.
 * Layout: rows = animations, columns = frames.
 * Returns the canvas and the config describing the layout.
 */
export function generateSpriteSheet(color = '#ffffff', accessory = 'none'): {
  canvas: HTMLCanvasElement;
  config: SpriteSheetConfig;
} {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * MAX_FRAMES;
  canvas.height = FRAME_H * NUM_ROWS;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context for sprite sheet');

  // Clear to transparent
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw each animation row
  for (const [name, gen] of Object.entries(POSE_GENERATORS) as [AnimationName, PoseGenerator][]) {
    const animConfig = SPRITE_SHEET_CONFIG.animations[name];
    for (let f = 0; f < animConfig.frameCount; f++) {
      const pose = gen(f);
      const offsetX = f * FRAME_W;
      const offsetY = animConfig.row * FRAME_H;
      drawStickman(ctx, offsetX, offsetY, pose, color);
      if (accessory !== 'none') {
        drawAccessory(ctx, offsetX, offsetY, pose, accessory);
      }
    }
  }

  return { canvas, config: SPRITE_SHEET_CONFIG };
}
