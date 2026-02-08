// ─── Sky Renderer ───

import * as THREE from 'three';

// ─── Sky Color Keyframes ───

interface SkyKeyframe {
  time: number;
  topColor: THREE.Color;
  horizonColor: THREE.Color;
  sunIntensity: number;
  moonIntensity: number;
  ambientIntensity: number;
  ambientColor: THREE.Color;
  fogNear: number;
  fogFar: number;
}

const SKY_KEYFRAMES: SkyKeyframe[] = [
  {
    time: 0.0, // Midnight — near-total darkness
    topColor: new THREE.Color('#050510'),
    horizonColor: new THREE.Color('#0A0A18'),
    sunIntensity: 0,
    moonIntensity: 0.02,
    ambientIntensity: 0.05,
    ambientColor: new THREE.Color('#223355'),
    fogNear: 5,
    fogFar: 60,
  },
  {
    time: 0.2, // Dawn — orange tint, still dim
    topColor: new THREE.Color('#2E1A3E'),
    horizonColor: new THREE.Color('#FF7F50'),
    sunIntensity: 0.3,
    moonIntensity: 0,
    ambientIntensity: 0.3,
    ambientColor: new THREE.Color('#AA8866'),
    fogNear: 40,
    fogFar: 180,
  },
  {
    time: 0.25, // Early morning — transition to full day
    topColor: new THREE.Color('#3A70B0'),
    horizonColor: new THREE.Color('#FFD4A0'),
    sunIntensity: 0.8,
    moonIntensity: 0,
    ambientIntensity: 0.5,
    ambientColor: new THREE.Color('#DDCCAA'),
    fogNear: 60,
    fogFar: 250,
  },
  {
    time: 0.35, // Morning
    topColor: new THREE.Color('#4488CC'),
    horizonColor: new THREE.Color('#AADDFF'),
    sunIntensity: 1.0,
    moonIntensity: 0,
    ambientIntensity: 0.6,
    ambientColor: new THREE.Color('#EEDDCC'),
    fogNear: 80,
    fogFar: 300,
  },
  {
    time: 0.5, // Noon — full brightness
    topColor: new THREE.Color('#4A90D9'),
    horizonColor: new THREE.Color('#87CEEB'),
    sunIntensity: 1.5,
    moonIntensity: 0,
    ambientIntensity: 0.6,
    ambientColor: new THREE.Color('#FFF4E0'),
    fogNear: 80,
    fogFar: 300,
  },
  {
    time: 0.65, // Afternoon
    topColor: new THREE.Color('#4488CC'),
    horizonColor: new THREE.Color('#AADDFF'),
    sunIntensity: 1.0,
    moonIntensity: 0,
    ambientIntensity: 0.6,
    ambientColor: new THREE.Color('#EEDDCC'),
    fogNear: 80,
    fogFar: 300,
  },
  {
    time: 0.75, // Dusk — orange tint, dimming
    topColor: new THREE.Color('#4A2040'),
    horizonColor: new THREE.Color('#FF6347'),
    sunIntensity: 0.4,
    moonIntensity: 0,
    ambientIntensity: 0.3,
    ambientColor: new THREE.Color('#AA6644'),
    fogNear: 40,
    fogFar: 180,
  },
  {
    time: 0.8, // Early night — rapid darkening
    topColor: new THREE.Color('#0E0E28'),
    horizonColor: new THREE.Color('#1A1A30'),
    sunIntensity: 0,
    moonIntensity: 0.02,
    ambientIntensity: 0.08,
    ambientColor: new THREE.Color('#334466'),
    fogNear: 10,
    fogFar: 80,
  },
  {
    time: 0.9, // Deep night — near-total darkness
    topColor: new THREE.Color('#050510'),
    horizonColor: new THREE.Color('#0A0A18'),
    sunIntensity: 0,
    moonIntensity: 0.02,
    ambientIntensity: 0.05,
    ambientColor: new THREE.Color('#223355'),
    fogNear: 5,
    fogFar: 60,
  },
  {
    time: 1.0, // Midnight (wrap)
    topColor: new THREE.Color('#050510'),
    horizonColor: new THREE.Color('#0A0A18'),
    sunIntensity: 0,
    moonIntensity: 0.02,
    ambientIntensity: 0.05,
    ambientColor: new THREE.Color('#223355'),
    fogNear: 5,
    fogFar: 60,
  },
];

// ─── Sky Shader ───

const skyVertexShader = `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragmentShader = `
uniform vec3 uTopColor;
uniform vec3 uHorizonColor;
varying vec3 vWorldPosition;
void main() {
  float h = normalize(vWorldPosition).y;
  float t = clamp(h * 2.0 + 0.3, 0.0, 1.0);
  vec3 color = mix(uHorizonColor, uTopColor, t);
  gl_FragColor = vec4(color, 1.0);
}
`;

// ─── Interpolation ───

// Reusable result object to avoid per-frame allocations
const _lerpResult: SkyKeyframe = {
  time: 0,
  topColor: new THREE.Color(),
  horizonColor: new THREE.Color(),
  sunIntensity: 0,
  moonIntensity: 0,
  ambientIntensity: 0,
  ambientColor: new THREE.Color(),
  fogNear: 0,
  fogFar: 0,
};

function lerpKeyframes(time: number): SkyKeyframe {
  // Find surrounding keyframes
  let a = SKY_KEYFRAMES[0]!;
  let b = SKY_KEYFRAMES[1]!;

  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    if (time >= SKY_KEYFRAMES[i]!.time && time <= SKY_KEYFRAMES[i + 1]!.time) {
      a = SKY_KEYFRAMES[i]!;
      b = SKY_KEYFRAMES[i + 1]!;
      break;
    }
  }

  const range = b.time - a.time;
  const t = range > 0 ? (time - a.time) / range : 0;

  _lerpResult.time = time;
  _lerpResult.topColor.lerpColors(a.topColor, b.topColor, t);
  _lerpResult.horizonColor.lerpColors(a.horizonColor, b.horizonColor, t);
  _lerpResult.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
  _lerpResult.moonIntensity = a.moonIntensity + (b.moonIntensity - a.moonIntensity) * t;
  _lerpResult.ambientIntensity = a.ambientIntensity + (b.ambientIntensity - a.ambientIntensity) * t;
  _lerpResult.ambientColor.lerpColors(a.ambientColor, b.ambientColor, t);
  _lerpResult.fogNear = a.fogNear + (b.fogNear - a.fogNear) * t;
  _lerpResult.fogFar = a.fogFar + (b.fogFar - a.fogFar) * t;

  return _lerpResult;
}

// ─── SkyRenderer Class ───

export class SkyRenderer {
  private scene: THREE.Scene;

  // Sky dome
  private skyMesh: THREE.Mesh;
  private skyMaterial: THREE.ShaderMaterial;

  // Lights
  private sunLight: THREE.DirectionalLight;
  private moonLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;

  // Fog
  private fog: THREE.Fog;

  // Sun/Moon orbit radius
  private readonly orbitRadius = 200;
  private bloodMoonActive = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // ── Sky Dome ──
    const skyGeo = new THREE.SphereGeometry(500, 16, 16);
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: {
        uTopColor: { value: new THREE.Color('#4A90D9') },
        uHorizonColor: { value: new THREE.Color('#87CEEB') },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = -1;
    scene.add(this.skyMesh);

    // ── Sun ──
    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 1.5);
    this.sunLight.castShadow = false;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // ── Moon ──
    this.moonLight = new THREE.DirectionalLight(0xb0c4de, 0.2);
    this.moonLight.castShadow = false;
    scene.add(this.moonLight);

    // ── Ambient ──
    this.ambientLight = new THREE.AmbientLight(0xfff4e0, 0.5);
    scene.add(this.ambientLight);

    // ── Fog ──
    this.fog = new THREE.Fog(0x87ceeb, 80, 300);
    scene.fog = this.fog;
  }

  update(worldTime: number): void {
    // worldTime: 0–1 (0=midnight, 0.5=noon)
    const t = ((worldTime % 1) + 1) % 1;
    const kf = lerpKeyframes(t);

    // Blood moon override
    if (this.bloodMoonActive) {
      kf.topColor.set('#3a0a0a');
      kf.horizonColor.set('#8b0000');
      kf.ambientColor.set('#661111');
      kf.ambientIntensity = Math.max(kf.ambientIntensity, 0.2);
      kf.moonIntensity = 0.4;
      kf.fogNear = Math.min(kf.fogNear, 40);
      kf.fogFar = Math.min(kf.fogFar, 160);
    }

    // Sky colors
    (this.skyMaterial.uniforms['uTopColor']!.value as THREE.Color).copy(kf.topColor);
    (this.skyMaterial.uniforms['uHorizonColor']!.value as THREE.Color).copy(kf.horizonColor);

    // Sun position — circular orbit
    const sunAngle = (t - 0.25) * Math.PI * 2; // noon at top
    const sunX = Math.cos(sunAngle) * this.orbitRadius;
    const sunY = Math.sin(sunAngle) * this.orbitRadius;
    this.sunLight.position.set(sunX, sunY, 0);
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.intensity = kf.sunIntensity;

    // Moon — opposite side
    this.moonLight.position.set(-sunX, -sunY, 0);
    this.moonLight.intensity = kf.moonIntensity;

    // Ambient
    this.ambientLight.intensity = kf.ambientIntensity;
    this.ambientLight.color.copy(kf.ambientColor);

    // Fog
    this.fog.color.copy(kf.horizonColor);
    this.fog.near = kf.fogNear;
    this.fog.far = kf.fogFar;
  }

  /** Center the sky dome on the camera so it always surrounds the player */
  followCamera(camera: THREE.Camera): void {
    this.skyMesh.position.copy(camera.position);
  }

  setBloodMoon(active: boolean): void {
    this.bloodMoonActive = active;
  }

  getSunLight(): THREE.DirectionalLight {
    return this.sunLight;
  }

  getMoonLight(): THREE.DirectionalLight {
    return this.moonLight;
  }

  getAmbientLight(): THREE.AmbientLight {
    return this.ambientLight;
  }

  // Reusable Color objects for applyBiomeAtmosphere (avoids per-call allocations)
  private _biomeFogColor = new THREE.Color();
  private _biomeTintColor = new THREE.Color();

  /** Blend biome atmosphere into the current time-of-day fog/lighting */
  applyBiomeAtmosphere(
    fogColor: string,
    fogNear: number,
    fogFar: number,
    ambientTint: string,
  ): void {
    // Parse biome fog color
    this._biomeFogColor.set(fogColor);

    // Blend fog color: 50% time-of-day + 50% biome
    this.fog.color.lerp(this._biomeFogColor, 0.5);

    // Use whichever fog distance is shorter (more atmospheric)
    this.fog.near = Math.min(this.fog.near, fogNear);
    this.fog.far = Math.min(this.fog.far, fogFar);

    // Tint ambient light: blend 30% toward biome tint
    this._biomeTintColor.set(ambientTint);
    this.ambientLight.color.lerp(this._biomeTintColor, 0.3);

    // Also tint sky horizon slightly
    const horizonUniform = this.skyMaterial.uniforms['uHorizonColor']!.value as THREE.Color;
    horizonUniform.lerp(this._biomeFogColor, 0.2);
  }

  dispose(): void {
    this.scene.remove(this.skyMesh);
    this.skyMesh.geometry.dispose();
    this.skyMaterial.dispose();

    this.scene.remove(this.sunLight);
    this.scene.remove(this.sunLight.target);
    this.scene.remove(this.moonLight);
    this.scene.remove(this.ambientLight);

    this.scene.fog = null;
  }
}
