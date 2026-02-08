// ─── Audio Manager ───
// Procedural sound effects using Web Audio API.
// All sounds are generated programmatically — no external audio files needed.

// ─── Types ───

export type SoundName =
  | 'footstepGrass'
  | 'footstepStone'
  | 'blockBreak'
  | 'blockPlace'
  | 'hit'
  | 'pickup'
  | 'craftComplete';

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

  // ─── Sound Playback ───

  play(sound: SoundName): void {
    if (this.muted) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return; // init failed — audio unavailable
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    switch (sound) {
      case 'footstepGrass':
        this.playFootstepGrass();
        break;
      case 'footstepStone':
        this.playFootstepStone();
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
      case 'pickup':
        this.playPickup();
        break;
      case 'craftComplete':
        this.playCraftComplete();
        break;
    }
  }

  // ─── Footstep Update (call each frame) ───

  updateFootsteps(dt: number, walking: boolean, sprinting: boolean, onStone = false): void {
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
      this.play(onStone ? 'footstepStone' : 'footstepGrass');
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

  /** Grass footstep: short burst of filtered white noise (earthy thud) */
  private playFootstepGrass(): void {
    const ctx = this.ensureContext();
    const duration = 0.08;
    const now = ctx.currentTime;

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
    };
  }

  /** Stone footstep: short click with high-pass filter (sharp tap) */
  private playFootstepStone(): void {
    const ctx = this.ensureContext();
    const duration = 0.06;
    const now = ctx.currentTime;

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
    };
  }

  /** Block break: descending tone with noise (crumble) */
  private playBlockBreak(): void {
    const ctx = this.ensureContext();
    const duration = 0.25;
    const now = ctx.currentTime;

    // Descending oscillator
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + duration);

    // Noise layer
    const noiseSize = Math.ceil(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

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
    };
  }

  /** Block place: ascending tone (thunk) */
  private playBlockPlace(): void {
    const ctx = this.ensureContext();
    const duration = 0.12;
    const now = ctx.currentTime;

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
    };
  }

  /** Hit: short sharp noise burst (impact) */
  private playHit(): void {
    const ctx = this.ensureContext();
    const duration = 0.1;
    const now = ctx.currentTime;

    // Impact oscillator
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + duration);

    // Noise burst
    const noiseSize = Math.ceil(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

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
    };
  }

  /** Pickup: short ascending chime (happy boop) */
  private playPickup(): void {
    const ctx = this.ensureContext();
    const duration = 0.15;
    const now = ctx.currentTime;

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
    };
  }

  /** Craft complete: two-tone ascending ding */
  private playCraftComplete(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

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
    instance = null;
  }
}
