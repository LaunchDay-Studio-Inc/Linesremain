/**
 * IslandAmbientSound
 *
 * Procedural ambient audio for the island world using the Web Audio API.
 * All sounds are generated in real-time -- no audio files are required.
 *
 * Sound layers:
 *   1. Ocean waves   -- filtered noise modulated by a slow LFO
 *   2. Bird chirps    -- periodic sine-wave bursts (Haven, daytime only)
 *   3. Volcanic rumble -- low-frequency sawtooth drone (Ember Isle only)
 *   4. Wind           -- bandpass-filtered noise, always present
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OceanNodes {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
}

interface WindNodes {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

interface VolcanoNodes {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MASTER_VOLUME = 0.15;

// Island boundaries (world-space X)
const HAVEN_MAX_X = 160;
const EMBER_MIN_X = 256;

// Ocean layer
const OCEAN_FILTER_FREQ = 400;
const OCEAN_LFO_FREQ = 0.15;
const OCEAN_GAIN_MIN = 0.0;
const OCEAN_GAIN_MAX = 0.4;

// Wind layer
const WIND_FILTER_FREQ = 800;
const WIND_FILTER_Q = 0.5;
const WIND_GAIN_DAY = 0.05;
const WIND_GAIN_NIGHT = 0.15;

// Volcanic rumble layer
const VOLCANO_FREQ = 40;
const VOLCANO_FILTER_FREQ = 80;
const VOLCANO_GAIN_MAX = 0.2;

// Bird chirps
const BIRD_FREQ_MIN = 1800;
const BIRD_FREQ_MAX = 2400;
const BIRD_GAIN_MAX = 0.3;
const BIRD_INTERVAL_MIN = 2;
const BIRD_INTERVAL_MAX = 5;

// Day window for bird chirps
const DAY_START = 0.15;
const DAY_END = 0.75;

// Smooth crossfade time constant (seconds)
const FADE_TC = 0.5;

// Noise buffer duration (seconds)
const NOISE_DURATION = 2;

// Bird chirp envelope durations (seconds)
const CHIRP_ATTACK = 0.01;
const CHIRP_SUSTAIN = 0.08;
const CHIRP_RELEASE = 0.06;

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

export class IslandAmbientSound {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Layer nodes
  private oceanNodes: OceanNodes | null = null;
  private windNodes: WindNodes | null = null;
  private volcanoNodes: VolcanoNodes | null = null;

  // Bird chirp state
  private birdGain: GainNode | null = null;
  private birdOsc: OscillatorNode | null = null;
  private birdTimer = 0;
  private birdNextChirp = 3;
  private birdChirping = false;

  // Shared noise buffer (created once)
  private noiseBuffer: AudioBuffer | null = null;

  private initialized = false;

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Call after a user gesture to create (or resume) the AudioContext.
   */
  init(): void {
    if (this.initialized) {
      // If the context was suspended (e.g. tab went to background), resume it.
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = MASTER_VOLUME;
    this.masterGain.connect(this.ctx.destination);

    this.noiseBuffer = this.createNoiseBuffer();

    this.initOcean();
    this.initWind();
    this.initVolcano();
    this.initBird();

    this.initialized = true;
  }

  /**
   * Called every frame from the game loop.
   *
   * @param dt        - Delta time in seconds
   * @param playerX   - Player world X position
   * @param playerZ   - Player world Z position (unused for now but reserved)
   * @param worldTime - Normalised time of day 0-1 (0.25 = noon, 0.75 = midnight)
   */
  update(dt: number, playerX: number, _playerZ: number, worldTime: number): void {
    if (!this.initialized || !this.ctx || this.ctx.state !== 'running') {
      return;
    }

    const now = this.ctx.currentTime;

    // ---- Determine location blend factors ----
    // 0 = deep haven centre, 1 = coast/ocean
    const oceanProximity = this.calcOceanProximity(playerX);
    const onHaven = playerX < HAVEN_MAX_X;
    const onEmber = playerX >= EMBER_MIN_X;
    const isDay = worldTime > DAY_START && worldTime < DAY_END;

    // Night factor: 0 during day peak, 1 at midnight
    // Simple triangle: peak night at worldTime 0.75
    const nightFactor = this.calcNightFactor(worldTime);

    // ---- Ocean ----
    if (this.oceanNodes) {
      const oceanTarget = OCEAN_GAIN_MIN + (OCEAN_GAIN_MAX - OCEAN_GAIN_MIN) * oceanProximity;
      this.oceanNodes.gain.gain.setTargetAtTime(oceanTarget, now, FADE_TC);
    }

    // ---- Wind ----
    if (this.windNodes) {
      const windTarget = WIND_GAIN_DAY + (WIND_GAIN_NIGHT - WIND_GAIN_DAY) * nightFactor;
      this.windNodes.gain.gain.setTargetAtTime(windTarget, now, FADE_TC);
    }

    // ---- Volcanic rumble ----
    if (this.volcanoNodes) {
      const volcanoTarget = onEmber ? VOLCANO_GAIN_MAX : 0;
      this.volcanoNodes.gain.gain.setTargetAtTime(volcanoTarget, now, FADE_TC);
    }

    // ---- Bird chirps ----
    this.updateBirds(dt, onHaven, isDay, now);
  }

  /**
   * Tear down all audio nodes and close the context.
   */
  dispose(): void {
    if (this.oceanNodes) {
      this.oceanNodes.lfo.stop();
      this.oceanNodes.source.stop();
      this.oceanNodes.lfo.disconnect();
      this.oceanNodes.lfoGain.disconnect();
      this.oceanNodes.source.disconnect();
      this.oceanNodes.filter.disconnect();
      this.oceanNodes.gain.disconnect();
      this.oceanNodes = null;
    }

    if (this.windNodes) {
      this.windNodes.source.stop();
      this.windNodes.source.disconnect();
      this.windNodes.filter.disconnect();
      this.windNodes.gain.disconnect();
      this.windNodes = null;
    }

    if (this.volcanoNodes) {
      this.volcanoNodes.osc.stop();
      this.volcanoNodes.osc.disconnect();
      this.volcanoNodes.filter.disconnect();
      this.volcanoNodes.gain.disconnect();
      this.volcanoNodes = null;
    }

    if (this.birdOsc) {
      this.birdOsc.stop();
      this.birdOsc.disconnect();
      this.birdOsc = null;
    }
    if (this.birdGain) {
      this.birdGain.disconnect();
      this.birdGain = null;
    }

    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }

    this.noiseBuffer = null;
    this.initialized = false;
    this.birdTimer = 0;
    this.birdNextChirp = 3;
    this.birdChirping = false;
  }

  // ------------------------------------------------------------------
  // Initialisation helpers (called once from init)
  // ------------------------------------------------------------------

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

  private initOcean(): void {
    const ctx = this.ctx!;
    const masterGain = this.masterGain!;

    // Noise source
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer!;
    source.loop = true;

    // Lowpass filter for wave character
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = OCEAN_FILTER_FREQ;

    // Output gain (controlled by update)
    const gain = ctx.createGain();
    gain.gain.value = 0;

    // LFO to modulate gain for wave rhythm
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = OCEAN_LFO_FREQ;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15; // depth of modulation

    // Routing: source -> filter -> gain -> master
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    // LFO -> gain.gain (modulates volume)
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    source.start();
    lfo.start();

    this.oceanNodes = { source, filter, gain, lfo, lfoGain };
  }

  private initWind(): void {
    const ctx = this.ctx!;
    const masterGain = this.masterGain!;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer!;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = WIND_FILTER_FREQ;
    filter.Q.value = WIND_FILTER_Q;

    const gain = ctx.createGain();
    gain.gain.value = WIND_GAIN_DAY;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    source.start();

    this.windNodes = { source, filter, gain };
  }

  private initVolcano(): void {
    const ctx = this.ctx!;
    const masterGain = this.masterGain!;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = VOLCANO_FREQ;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = VOLCANO_FILTER_FREQ;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start();

    this.volcanoNodes = { osc, filter, gain };
  }

  private initBird(): void {
    const ctx = this.ctx!;
    const masterGain = this.masterGain!;

    // Persistent oscillator kept silent until a chirp fires.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = BIRD_FREQ_MIN;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start();

    this.birdOsc = osc;
    this.birdGain = gain;
  }

  // ------------------------------------------------------------------
  // Per-frame helpers (no allocations)
  // ------------------------------------------------------------------

  private updateBirds(dt: number, onHaven: boolean, isDay: boolean, now: number): void {
    if (!this.birdGain || !this.birdOsc) {
      return;
    }

    const shouldChirp = onHaven && isDay;

    if (!shouldChirp) {
      // Silence birds quickly when leaving haven or nightfall
      if (this.birdChirping) {
        this.birdGain.gain.setTargetAtTime(0, now, 0.05);
        this.birdChirping = false;
      }
      this.birdTimer = 0;
      return;
    }

    this.birdTimer += dt;

    if (this.birdTimer >= this.birdNextChirp) {
      this.birdTimer = 0;
      this.birdNextChirp =
        BIRD_INTERVAL_MIN + Math.random() * (BIRD_INTERVAL_MAX - BIRD_INTERVAL_MIN);

      // Randomise pitch for variety
      this.birdOsc.frequency.value =
        BIRD_FREQ_MIN + Math.random() * (BIRD_FREQ_MAX - BIRD_FREQ_MIN);

      // Quick envelope: attack -> sustain -> release
      const gain = this.birdGain.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(0, now);
      gain.linearRampToValueAtTime(BIRD_GAIN_MAX, now + CHIRP_ATTACK);
      gain.setValueAtTime(BIRD_GAIN_MAX, now + CHIRP_ATTACK + CHIRP_SUSTAIN);
      gain.linearRampToValueAtTime(0, now + CHIRP_ATTACK + CHIRP_SUSTAIN + CHIRP_RELEASE);

      this.birdChirping = true;
    }
  }

  /**
   * Returns 0 when the player is deep inside an island centre, 1 when in open
   * ocean, and a gradient along coastlines.
   */
  private calcOceanProximity(playerX: number): number {
    // Haven centre is roughly x = 80
    // Ember centre is roughly x = 320  (256 + 64)
    // Ocean band: 160 .. 256

    if (playerX >= HAVEN_MAX_X && playerX < EMBER_MIN_X) {
      // In the ocean band -- full ocean
      return 1;
    }

    if (playerX < HAVEN_MAX_X) {
      // On Haven -- proximity increases towards coast (x = 160)
      // Island "centre" at x = 0..80 -> proximity ~0
      const coastDist = HAVEN_MAX_X - playerX; // 0 at coast, 160 at far edge
      return 1 - Math.min(coastDist / HAVEN_MAX_X, 1);
    }

    // On Ember Isle -- proximity increases towards coast (x = 256)
    const emberWidth = 128; // approximate island width
    const coastDist = playerX - EMBER_MIN_X; // 0 at coast, grows inland
    return 1 - Math.min(coastDist / emberWidth, 1);
  }

  /**
   * Returns 0 during day peak (noon = 0.25), 1 at midnight (0.75).
   */
  private calcNightFactor(worldTime: number): number {
    // Distance from noon (0.25) on a circular 0-1 scale
    let dist = Math.abs(worldTime - 0.25);
    if (dist > 0.5) {
      dist = 1 - dist;
    }
    // dist is 0 at noon, 0.5 at midnight -> normalise to 0..1
    return Math.min(dist / 0.5, 1);
  }
}
