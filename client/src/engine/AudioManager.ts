// ─── Audio Manager ───
// Procedural sound effects using Web Audio API.
// All sounds are generated programmatically — no external audio files needed.

// ─── Types ───

export type SoundName =
  | 'footstepGrass'
  | 'footstepStone'
  | 'footstepSand'
  | 'footstepWood'
  | 'footstepWater'
  | 'blockBreak'
  | 'blockPlace'
  | 'hit'
  | 'hitRanged'
  | 'hitFall'
  | 'pickup'
  | 'pickupRare'
  | 'pickupEpic'
  | 'craftComplete'
  | 'deathSting'
  | 'respawnRise'
  | 'achievementFanfare'
  | 'nightSting'
  | 'combatEngage'
  | 'uiHover'
  | 'uiOpen'
  | 'uiClose';

export type TerrainType = 'grass' | 'stone' | 'sand' | 'wood' | 'water';

// ─── Audio Manager (Singleton) ───

let instance: AudioManager | null = null;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.5;
  private muted = false;

  // Footstep tracking
  private footstepTimer = 0;
  private isWalking = false;
  private isSprinting = false;

  // Pre-cached noise buffers for footsteps (avoid per-call AudioBuffer creation)
  private grassNoiseBuffer: AudioBuffer | null = null;
  private stoneNoiseBuffer: AudioBuffer | null = null;

  // Pre-cached noise buffers for block break and hit sounds
  private blockBreakNoiseBuffer: AudioBuffer | null = null;
  private hitNoiseBuffer: AudioBuffer | null = null;

  // Concurrent SFX limiter
  private activeSFXCount = 0;
  private readonly MAX_CONCURRENT_SFX = 8;

  // Pre-cached noise buffers for new sounds
  private sandNoiseBuffer: AudioBuffer | null = null;
  private waterNoiseBuffer: AudioBuffer | null = null;

  static getInstance(): AudioManager {
    if (!instance) {
      instance = new AudioManager();
    }
    return instance;
  }

  private constructor() {}

  // ─── Initialization ───

  /** Must be called after a user gesture (click/keydown) to unlock AudioContext */
  init(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Audio not available — game continues silently
      this.ctx = null;
      this.masterGain = null;
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) this.init();
    return this.ctx!;
  }

  // ─── Volume Control ───

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain) {
      this.masterGain.gain.value = m ? 0 : this.volume;
    }
  }

  /** Expose context for shared use by ambient systems */
  getContext(): AudioContext | null {
    return this.ctx;
  }

  /** Expose master gain for shared use by ambient systems */
  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  // ─── Concurrent SFX Limiter ───

  private canPlaySFX(): boolean {
    return this.activeSFXCount < this.MAX_CONCURRENT_SFX;
  }

  private trackSFX(): void {
    this.activeSFXCount++;
  }

  private untrackSFX(): void {
    this.activeSFXCount = Math.max(0, this.activeSFXCount - 1);
  }

  // ─── Sound Playback ───

  play(sound: SoundName): void {
    if (this.muted) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return; // init failed — audio unavailable
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.canPlaySFX()) return;

    switch (sound) {
      case 'footstepGrass':
        this.playFootstepGrass();
        break;
      case 'footstepStone':
        this.playFootstepStone();
        break;
      case 'footstepSand':
        this.playFootstepSand();
        break;
      case 'footstepWood':
        this.playFootstepWood();
        break;
      case 'footstepWater':
        this.playFootstepWater();
        break;
      case 'blockBreak':
        this.playBlockBreak();
        break;
      case 'blockPlace':
        this.playBlockPlace();
        break;
      case 'hit':
        this.playHit();
        break;
      case 'hitRanged':
        this.playHitRanged();
        break;
      case 'hitFall':
        this.playHitFall();
        break;
      case 'pickup':
        this.playPickup();
        break;
      case 'pickupRare':
        this.playPickupRare();
        break;
      case 'pickupEpic':
        this.playPickupEpic();
        break;
      case 'craftComplete':
        this.playCraftComplete();
        break;
      case 'deathSting':
        this.playDeathSting();
        break;
      case 'respawnRise':
        this.playRespawnRise();
        break;
      case 'achievementFanfare':
        this.playAchievementFanfare();
        break;
      case 'nightSting':
        this.playNightSting();
        break;
      case 'combatEngage':
        this.playCombatEngage();
        break;
      case 'uiHover':
        this.playUIHover();
        break;
      case 'uiOpen':
        this.playUIOpen();
        break;
      case 'uiClose':
        this.playUIClose();
        break;
    }
  }

  // ─── Footstep Update (call each frame) ───

  updateFootsteps(
    dt: number,
    walking: boolean,
    sprinting: boolean,
    terrain: TerrainType = 'grass',
  ): void {
    this.isWalking = walking;
    this.isSprinting = sprinting;

    if (!walking) {
      this.footstepTimer = 0;
      return;
    }

    const interval = sprinting ? 0.3 : 0.4;
    this.footstepTimer += dt;

    if (this.footstepTimer >= interval) {
      this.footstepTimer -= interval;
      const soundMap: Record<TerrainType, SoundName> = {
        grass: 'footstepGrass',
        stone: 'footstepStone',
        sand: 'footstepSand',
        wood: 'footstepWood',
        water: 'footstepWater',
      };
      this.play(soundMap[terrain]);
    }
  }

  // ─── Sound Generators ───

  /** Ensure the grass noise buffer is pre-cached (reused across all grass footstep calls) */
  private getGrassNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.grassNoiseBuffer || this.grassNoiseBuffer.sampleRate !== ctx.sampleRate) {
      const duration = 0.08;
      const bufferSize = Math.ceil(ctx.sampleRate * duration);
      this.grassNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = this.grassNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
    }
    return this.grassNoiseBuffer;
  }

  /** Ensure the stone noise buffer is pre-cached (reused across all stone footstep calls) */
  private getStoneNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.stoneNoiseBuffer || this.stoneNoiseBuffer.sampleRate !== ctx.sampleRate) {
      const duration = 0.06;
      const bufferSize = Math.ceil(ctx.sampleRate * duration);
      this.stoneNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = this.stoneNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.4;
      }
    }
    return this.stoneNoiseBuffer;
  }

  /** Ensure the block break noise buffer is pre-cached */
  private getBlockBreakNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.blockBreakNoiseBuffer || this.blockBreakNoiseBuffer.sampleRate !== ctx.sampleRate) {
      const duration = 0.25;
      const bufferSize = Math.ceil(ctx.sampleRate * duration);
      this.blockBreakNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = this.blockBreakNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }
    }
    return this.blockBreakNoiseBuffer;
  }

  /** Ensure the hit noise buffer is pre-cached */
  private getHitNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.hitNoiseBuffer || this.hitNoiseBuffer.sampleRate !== ctx.sampleRate) {
      const duration = 0.1;
      const bufferSize = Math.ceil(ctx.sampleRate * duration);
      this.hitNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = this.hitNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
    }
    return this.hitNoiseBuffer;
  }

  private getSandNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.sandNoiseBuffer || this.sandNoiseBuffer.sampleRate !== ctx.sampleRate) {
      const duration = 0.1;
      const bufferSize = Math.ceil(ctx.sampleRate * duration);
      this.sandNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = this.sandNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.35;
      }
    }
    return this.sandNoiseBuffer;
  }

  private getWaterNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.waterNoiseBuffer || this.waterNoiseBuffer.sampleRate !== ctx.sampleRate) {
      const duration = 0.15;
      const bufferSize = Math.ceil(ctx.sampleRate * duration);
      this.waterNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = this.waterNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }
    }
    return this.waterNoiseBuffer;
  }

  /** Grass footstep: short burst of filtered white noise (earthy thud) */
  private playFootstepGrass(): void {
    const ctx = this.ensureContext();
    const duration = 0.08;
    const now = ctx.currentTime;
    this.trackSFX();

    // Reuse pre-cached noise buffer
    const buffer = this.getGrassNoiseBuffer(ctx);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter for earthy sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200 + Math.random() * 100;
    filter.Q.value = 1.5;

    // Envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    source.start(now);
    source.stop(now + duration);

    // Disconnect audio nodes after playback to prevent memory leaks
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** Stone footstep: short click with high-pass filter (sharp tap) */
  private playFootstepStone(): void {
    const ctx = this.ensureContext();
    const duration = 0.06;
    const now = ctx.currentTime;
    this.trackSFX();

    // Reuse pre-cached noise buffer
    const buffer = this.getStoneNoiseBuffer(ctx);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // High-pass filter for sharp tap
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800 + Math.random() * 200;
    filter.Q.value = 2;

    // Envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    source.start(now);
    source.stop(now + duration);

    // Disconnect audio nodes after playback to prevent memory leaks
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** Block break: descending tone with noise (crumble) */
  private playBlockBreak(): void {
    const ctx = this.ensureContext();
    const duration = 0.25;
    const now = ctx.currentTime;
    this.trackSFX();

    // Descending oscillator
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + duration);

    // Noise layer (reuse pre-cached buffer)
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.getBlockBreakNoiseBuffer(ctx);

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 1200;

    // Mix
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain!);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + duration);
    noiseSource.start(now);
    noiseSource.stop(now + duration);

    // Disconnect audio nodes after playback to prevent memory leaks
    noiseSource.onended = () => {
      osc.disconnect();
      oscGain.disconnect();
      noiseSource.disconnect();
      noiseFilter.disconnect();
      noiseGain.disconnect();
      this.untrackSFX();
    };
  }

  /** Block place: ascending tone (thunk) */
  private playBlockPlace(): void {
    const ctx = this.ensureContext();
    const duration = 0.12;
    const now = ctx.currentTime;
    this.trackSFX();

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + duration * 0.3);
    osc.frequency.exponentialRampToValueAtTime(200, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + duration);

    // Disconnect audio nodes after playback to prevent memory leaks
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** Hit: short sharp noise burst (impact) */
  private playHit(): void {
    const ctx = this.ensureContext();
    const duration = 0.1;
    const now = ctx.currentTime;
    this.trackSFX();

    // Impact oscillator
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + duration);

    // Noise burst (reuse pre-cached buffer)
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.getHitNoiseBuffer(ctx);

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 500;
    noiseFilter.Q.value = 1;

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain!);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + duration);
    noiseSource.start(now);
    noiseSource.stop(now + duration);

    // Disconnect audio nodes after playback to prevent memory leaks
    noiseSource.onended = () => {
      osc.disconnect();
      oscGain.disconnect();
      noiseSource.disconnect();
      noiseFilter.disconnect();
      noiseGain.disconnect();
      this.untrackSFX();
    };
  }

  /** Pickup: short ascending chime (happy boop) */
  private playPickup(): void {
    const ctx = this.ensureContext();
    const duration = 0.15;
    const now = ctx.currentTime;
    this.trackSFX();

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + duration * 0.4);
    osc.frequency.setValueAtTime(800, now + duration * 0.4);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(600, now + duration * 0.05);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + duration * 0.45);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.25, now + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.1, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc2.connect(gain2);
    gain2.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + duration);
    osc2.start(now);
    osc2.stop(now + duration);

    // Disconnect audio nodes after playback to prevent memory leaks
    osc2.onended = () => {
      osc.disconnect();
      gain.disconnect();
      osc2.disconnect();
      gain2.disconnect();
      this.untrackSFX();
    };
  }

  /** Craft complete: two-tone ascending ding */
  private playCraftComplete(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.trackSFX();

    // First tone
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 523; // C5

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc1.connect(gain1);
    gain1.connect(this.masterGain!);

    osc1.start(now);
    osc1.stop(now + 0.2);

    // Second tone (higher, delayed)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 659; // E5

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc2.connect(gain2);
    gain2.connect(this.masterGain!);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.35);

    // Disconnect audio nodes after playback to prevent memory leaks
    osc2.onended = () => {
      osc1.disconnect();
      gain1.disconnect();
      osc2.disconnect();
      gain2.disconnect();
      this.untrackSFX();
    };
  }

  /** Sand footstep: soft swish with lowpass filter */
  private playFootstepSand(): void {
    const ctx = this.ensureContext();
    const duration = 0.1;
    const now = ctx.currentTime;
    this.trackSFX();

    const source = ctx.createBufferSource();
    source.buffer = this.getSandNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300 + Math.random() * 100;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    source.start(now);
    source.stop(now + duration);

    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** Wood footstep: hollow knock */
  private playFootstepWood(): void {
    const ctx = this.ensureContext();
    const duration = 0.08;
    const now = ctx.currentTime;
    this.trackSFX();

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + duration);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** Water footstep: splashy filtered noise */
  private playFootstepWater(): void {
    const ctx = this.ensureContext();
    const duration = 0.15;
    const now = ctx.currentTime;
    this.trackSFX();

    const source = ctx.createBufferSource();
    source.buffer = this.getWaterNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600 + Math.random() * 200;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    source.start(now);
    source.stop(now + duration);

    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** Ranged hit: sharp whip crack */
  private playHitRanged(): void {
    const ctx = this.ensureContext();
    const duration = 0.08;
    const now = ctx.currentTime;
    this.trackSFX();

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + duration);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** Fall hit: heavy thud */
  private playHitFall(): void {
    const ctx = this.ensureContext();
    const duration = 0.2;
    const now = ctx.currentTime;
    this.trackSFX();

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + duration);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** Rare pickup: two-tone ascending with shimmer */
  private playPickupRare(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.trackSFX();

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(784, now + 0.15); // G5

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659, now + 0.08); // E5
    osc2.frequency.exponentialRampToValueAtTime(1047, now + 0.25); // C6

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.setValueAtTime(0.15, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc1.connect(gain1);
    gain1.connect(this.masterGain!);
    osc2.connect(gain2);
    gain2.connect(this.masterGain!);

    osc1.start(now);
    osc1.stop(now + 0.2);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.3);

    osc2.onended = () => {
      osc1.disconnect();
      gain1.disconnect();
      osc2.disconnect();
      gain2.disconnect();
      this.untrackSFX();
    };
  }

  /** Epic pickup: three-tone ascending fanfare */
  private playPickupEpic(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.trackSFX();

    const notes = [523, 659, 784]; // C5, E5, G5
    const gains: GainNode[] = [];
    const oscs: OscillatorNode[] = [];

    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const startTime = now + i * 0.08;
      osc.frequency.setValueAtTime(notes[i]!, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.25);

      oscs.push(osc);
      gains.push(gain);
    }

    oscs[oscs.length - 1]!.onended = () => {
      for (const o of oscs) o.disconnect();
      for (const g of gains) g.disconnect();
      this.untrackSFX();
    };
  }

  /** Death sting: descending minor three-note fall */
  private playDeathSting(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.trackSFX();

    const notes = [440, 415.3, 349.23]; // A4, Ab4, F4
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const startTime = now + i * 0.2;
      osc.frequency.value = notes[i]!;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.4);

      oscs.push(osc);
      gains.push(gain);
    }

    oscs[oscs.length - 1]!.onended = () => {
      for (const o of oscs) o.disconnect();
      for (const g of gains) g.disconnect();
      this.untrackSFX();
    };
  }

  /** Respawn rise: ascending hopeful three-note motif */
  private playRespawnRise(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.trackSFX();

    const notes = [261.63, 329.63, 392.0]; // C4, E4, G4
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const startTime = now + i * 0.15;
      osc.frequency.value = notes[i]!;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.35);

      oscs.push(osc);
      gains.push(gain);
    }

    oscs[oscs.length - 1]!.onended = () => {
      for (const o of oscs) o.disconnect();
      for (const g of gains) g.disconnect();
      this.untrackSFX();
    };
  }

  /** Achievement fanfare: major chord arpeggio */
  private playAchievementFanfare(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.trackSFX();

    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = i < 3 ? 'sine' : 'triangle';
      const startTime = now + i * 0.1;
      osc.frequency.value = notes[i]!;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.4);

      oscs.push(osc);
      gains.push(gain);
    }

    oscs[oscs.length - 1]!.onended = () => {
      for (const o of oscs) o.disconnect();
      for (const g of gains) g.disconnect();
      this.untrackSFX();
    };
  }

  /** Night sting: eerie descending two-note */
  private playNightSting(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.trackSFX();

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.6); // A3

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.8);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** Combat engage: sharp rising tension burst */
  private playCombatEngage(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.trackSFX();

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.25);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** UI hover: very short high tick */
  private playUIHover(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.trackSFX();

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.04);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** UI open: short ascending pop */
  private playUIOpen(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.trackSFX();

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.1);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  /** UI close: short descending pop */
  private playUIClose(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    this.trackSFX();

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.1);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.untrackSFX();
    };
  }

  // ─── Cleanup ───

  dispose(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
    this.grassNoiseBuffer = null;
    this.stoneNoiseBuffer = null;
    this.blockBreakNoiseBuffer = null;
    this.hitNoiseBuffer = null;
    this.sandNoiseBuffer = null;
    this.waterNoiseBuffer = null;
    this.activeSFXCount = 0;
    instance = null;
  }
}
