// ─── Ambient Sound System ───
// Procedural ambient soundscape for the main world.
// 4 layers: wind, water proximity, night crickets, day birds.
// Shares AudioContext with AudioManager to respect node limits.

// ─── Types ───

interface WindNodes {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

interface WaterNodes {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
}

interface CricketState {
  gain: GainNode;
  osc: OscillatorNode;
  timer: number;
  nextChirp: number;
  active: boolean;
}

interface BirdState {
  gain: GainNode;
  osc: OscillatorNode;
  timer: number;
  nextChirp: number;
  active: boolean;
}

// ─── Constants ───

const AMBIENT_MASTER_VOLUME = 0.12;
const NOISE_DURATION = 2; // seconds

// Wind
const WIND_FILTER_FREQ = 700;
const WIND_FILTER_Q = 0.4;
const WIND_GAIN_BASE = 0.08;
const WIND_GAIN_NIGHT_BOOST = 0.06;

// Water proximity (near rivers/ocean in main world)
const WATER_FILTER_FREQ = 350;
const WATER_LFO_FREQ = 0.12;
const WATER_LFO_DEPTH = 0.1;
const WATER_GAIN_MAX = 0.3;

// Crickets (night only)
const CRICKET_FREQ_MIN = 3500;
const CRICKET_FREQ_MAX = 4500;
const CRICKET_GAIN = 0.15;
const CRICKET_INTERVAL_MIN = 0.5;
const CRICKET_INTERVAL_MAX = 1.5;
const CRICKET_DURATION = 0.08;

// Birds (day only)
const BIRD_FREQ_MIN = 1600;
const BIRD_FREQ_MAX = 2800;
const BIRD_GAIN = 0.2;
const BIRD_INTERVAL_MIN = 3;
const BIRD_INTERVAL_MAX = 8;
const BIRD_CHIRP_ATTACK = 0.01;
const BIRD_CHIRP_SUSTAIN = 0.06;
const BIRD_CHIRP_RELEASE = 0.05;

// Day/night thresholds (0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset)
const DAY_START = 0.2;
const DAY_END = 0.72;

// Smooth crossfade
const FADE_TC = 0.4;

// ─── Class ───

export class AmbientSoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private windNodes: WindNodes | null = null;
  private waterNodes: WaterNodes | null = null;
  private cricketState: CricketState | null = null;
  private birdState: BirdState | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private initialized = false;
  private volume = 1.0;

  // ─── Public API ───

  /**
   * Initialize using AudioManager's shared context.
   * Call after AudioManager.init() and after a user gesture.
   */
  init(ctx: AudioContext, parentGain: GainNode): void {
    if (this.initialized) return;

    this.ctx = ctx;
    this.masterGain = parentGain;

    // Create ambient sub-gain
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = AMBIENT_MASTER_VOLUME * this.volume;
    this.ambientGain.connect(parentGain);

    this.noiseBuffer = this.createNoiseBuffer();

    this.initWind();
    this.initWater();
    this.initCrickets();
    this.initBirds();

    this.initialized = true;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(
        AMBIENT_MASTER_VOLUME * this.volume,
        this.ctx!.currentTime,
        0.1,
      );
    }
  }

  /**
   * Called every frame from the game loop.
   * @param dt         - Delta time in seconds
   * @param playerY    - Player Y position (for water proximity)
   * @param worldTime  - Normalised time of day 0-1
   * @param seaLevel   - Sea level Y coordinate
   * @param biome      - Current biome name
   */
  update(dt: number, playerY: number, worldTime: number, seaLevel: number, biome: string): void {
    if (!this.initialized || !this.ctx || this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;

    // Night factor: 0 = full day, 1 = full night
    const nightFactor = this.calcNightFactor(worldTime);
    const isDay = worldTime > DAY_START && worldTime < DAY_END;

    // Water proximity: based on distance to sea level
    const waterDist = Math.abs(playerY - seaLevel);
    const waterProximity = Math.max(0, 1 - waterDist / 15);

    // Biome-based wind adjustment
    const isWindyBiome =
      biome === 'Ashlands' || biome === 'Frostpeak' || biome === 'Sandstone Cliffs';
    const windMultiplier = isWindyBiome ? 1.5 : 1.0;

    // ── Wind ──
    if (this.windNodes) {
      const windTarget = (WIND_GAIN_BASE + WIND_GAIN_NIGHT_BOOST * nightFactor) * windMultiplier;
      this.windNodes.gain.gain.setTargetAtTime(windTarget, now, FADE_TC);
    }

    // ── Water ──
    if (this.waterNodes) {
      const waterTarget = WATER_GAIN_MAX * waterProximity;
      this.waterNodes.gain.gain.setTargetAtTime(waterTarget, now, FADE_TC);
    }

    // ── Crickets (night only) ──
    this.updateCrickets(dt, nightFactor > 0.5, now);

    // ── Birds (day only) ──
    this.updateBirds(dt, isDay, now);
  }

  dispose(): void {
    if (this.windNodes) {
      this.windNodes.source.stop();
      this.windNodes.source.disconnect();
      this.windNodes.filter.disconnect();
      this.windNodes.gain.disconnect();
      this.windNodes = null;
    }

    if (this.waterNodes) {
      this.waterNodes.lfo.stop();
      this.waterNodes.source.stop();
      this.waterNodes.lfo.disconnect();
      this.waterNodes.lfoGain.disconnect();
      this.waterNodes.source.disconnect();
      this.waterNodes.filter.disconnect();
      this.waterNodes.gain.disconnect();
      this.waterNodes = null;
    }

    if (this.cricketState) {
      this.cricketState.osc.stop();
      this.cricketState.osc.disconnect();
      this.cricketState.gain.disconnect();
      this.cricketState = null;
    }

    if (this.birdState) {
      this.birdState.osc.stop();
      this.birdState.osc.disconnect();
      this.birdState.gain.disconnect();
      this.birdState = null;
    }

    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }

    // Don't close the context — it belongs to AudioManager
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.initialized = false;
  }

  // ─── Initialization Helpers ───

  private createNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * NOISE_DURATION;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private initWind(): void {
    const ctx = this.ctx!;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer!;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = WIND_FILTER_FREQ;
    filter.Q.value = WIND_FILTER_Q;

    const gain = ctx.createGain();
    gain.gain.value = WIND_GAIN_BASE;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain!);
    source.start();

    this.windNodes = { source, filter, gain };
  }

  private initWater(): void {
    const ctx = this.ctx!;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer!;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = WATER_FILTER_FREQ;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = WATER_LFO_FREQ;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = WATER_LFO_DEPTH;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain!);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    source.start();
    lfo.start();

    this.waterNodes = { source, filter, gain, lfo, lfoGain };
  }

  private initCrickets(): void {
    const ctx = this.ctx!;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = CRICKET_FREQ_MIN;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    osc.connect(gain);
    gain.connect(this.ambientGain!);
    osc.start();

    this.cricketState = {
      osc,
      gain,
      timer: 0,
      nextChirp: 1 + Math.random() * 2,
      active: false,
    };
  }

  private initBirds(): void {
    const ctx = this.ctx!;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = BIRD_FREQ_MIN;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    osc.connect(gain);
    gain.connect(this.ambientGain!);
    osc.start();

    this.birdState = {
      osc,
      gain,
      timer: 0,
      nextChirp: 2 + Math.random() * 4,
      active: false,
    };
  }

  // ─── Per-frame Helpers ───

  private updateCrickets(dt: number, isNight: boolean, now: number): void {
    if (!this.cricketState) return;

    if (!isNight) {
      if (this.cricketState.active) {
        this.cricketState.gain.gain.setTargetAtTime(0, now, 0.05);
        this.cricketState.active = false;
      }
      this.cricketState.timer = 0;
      return;
    }

    this.cricketState.timer += dt;

    if (this.cricketState.timer >= this.cricketState.nextChirp) {
      this.cricketState.timer = 0;
      this.cricketState.nextChirp =
        CRICKET_INTERVAL_MIN + Math.random() * (CRICKET_INTERVAL_MAX - CRICKET_INTERVAL_MIN);

      this.cricketState.osc.frequency.value =
        CRICKET_FREQ_MIN + Math.random() * (CRICKET_FREQ_MAX - CRICKET_FREQ_MIN);

      const g = this.cricketState.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(0, now);
      g.linearRampToValueAtTime(CRICKET_GAIN, now + 0.005);
      g.setValueAtTime(CRICKET_GAIN, now + CRICKET_DURATION);
      g.linearRampToValueAtTime(0, now + CRICKET_DURATION + 0.02);

      this.cricketState.active = true;
    }
  }

  private updateBirds(dt: number, isDay: boolean, now: number): void {
    if (!this.birdState) return;

    if (!isDay) {
      if (this.birdState.active) {
        this.birdState.gain.gain.setTargetAtTime(0, now, 0.05);
        this.birdState.active = false;
      }
      this.birdState.timer = 0;
      return;
    }

    this.birdState.timer += dt;

    if (this.birdState.timer >= this.birdState.nextChirp) {
      this.birdState.timer = 0;
      this.birdState.nextChirp =
        BIRD_INTERVAL_MIN + Math.random() * (BIRD_INTERVAL_MAX - BIRD_INTERVAL_MIN);

      this.birdState.osc.frequency.value =
        BIRD_FREQ_MIN + Math.random() * (BIRD_FREQ_MAX - BIRD_FREQ_MIN);

      const g = this.birdState.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(0, now);
      g.linearRampToValueAtTime(BIRD_GAIN, now + BIRD_CHIRP_ATTACK);
      g.setValueAtTime(BIRD_GAIN, now + BIRD_CHIRP_ATTACK + BIRD_CHIRP_SUSTAIN);
      g.linearRampToValueAtTime(
        0,
        now + BIRD_CHIRP_ATTACK + BIRD_CHIRP_SUSTAIN + BIRD_CHIRP_RELEASE,
      );

      this.birdState.active = true;
    }
  }

  private calcNightFactor(worldTime: number): number {
    let dist = Math.abs(worldTime - 0.5);
    if (dist > 0.5) dist = 1 - dist;
    return Math.min(dist / 0.25, 1);
  }
}
