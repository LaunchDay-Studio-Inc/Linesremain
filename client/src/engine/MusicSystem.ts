// ─── Music System ───
// Procedural ambient music using Web Audio API.
// Generates evolving soundscapes with layered oscillators and filters.
// Each mood creates a distinct atmosphere through chord voicings,
// waveform choices, LFO modulation, and optional melody fragments.

// ─── Types ───

export type MusicMood = 'exploration' | 'night' | 'combat' | 'building' | 'menu' | 'tension' | 'death' | 'respawn' | 'underwater';

interface MoodVoice {
  oscillator: OscillatorNode;
  gain: GainNode;
}

interface MoodLayer {
  voices: MoodVoice[];
  masterGain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  filter?: BiquadFilterNode;
  filterLfo?: OscillatorNode;
  filterLfoGain?: GainNode;
}

interface MoodConfig {
  frequencies: number[];
  waveforms: OscillatorType[];
  detune: number[];
  lfoRate: number;
  lfoDepth: number;
  volume: number;
  filterCutoff?: number;
  filterLfoRate?: number;
  filterLfoDepth?: number;
}

// ─── Mood Configurations ───

// Exploration (day): Calm major chord pads, airy and warm
const EXPLORATION_CONFIG: MoodConfig = {
  frequencies: [130.81, 164.81, 196.0], // C3, E3, G3 (C major)
  waveforms: ['sine', 'sine', 'triangle'],
  detune: [0, 5, -3],
  lfoRate: 0.08,
  lfoDepth: 0.35,
  volume: 0.12,
};

// Night: Dark minor drones, hollow and eerie
const NIGHT_CONFIG: MoodConfig = {
  frequencies: [65.41, 77.78], // C2, Eb2 (C minor low)
  waveforms: ['triangle', 'triangle'],
  detune: [0, 8],
  lfoRate: 0.03,
  lfoDepth: 0.4,
  volume: 0.09,
};

// Combat: Tense pulsing dissonance
const COMBAT_CONFIG: MoodConfig = {
  frequencies: [110.0, 116.54, 164.81], // A2, Bb2, E3 (tension)
  waveforms: ['sawtooth', 'square', 'sine'],
  detune: [0, -10, 5],
  lfoRate: 1.5,
  lfoDepth: 0.6,
  volume: 0.14,
  filterCutoff: 800,
  filterLfoRate: 2.0,
  filterLfoDepth: 400,
};

// Building: Warm creative major 7th chord
const BUILDING_CONFIG: MoodConfig = {
  frequencies: [130.81, 164.81, 196.0, 246.94], // C3, E3, G3, B3 (Cmaj7)
  waveforms: ['sine', 'sine', 'triangle', 'sine'],
  detune: [0, 3, -2, 6],
  lfoRate: 0.1,
  lfoDepth: 0.3,
  volume: 0.11,
};

// Menu: Grand, rich layered open voicing
const MENU_CONFIG: MoodConfig = {
  frequencies: [65.41, 98.0, 146.83, 220.0], // C2, G2, D3, A3 (open 5ths)
  waveforms: ['sine', 'triangle', 'sine', 'sine'],
  detune: [0, -2, 4, -3],
  lfoRate: 0.015,
  lfoDepth: 0.25,
  volume: 0.15,
};

// Tension (low health): Dissonant minor 2nd cluster, uneasy
const TENSION_CONFIG: MoodConfig = {
  frequencies: [110.0, 116.54, 130.81], // A2, Bb2, C3 (minor cluster)
  waveforms: ['triangle', 'triangle', 'sine'],
  detune: [0, -15, 8],
  lfoRate: 0.5,
  lfoDepth: 0.5,
  volume: 0.1,
  filterCutoff: 600,
  filterLfoRate: 0.3,
  filterLfoDepth: 200,
};

// Death: Very low drone, hollow, desolate
const DEATH_CONFIG: MoodConfig = {
  frequencies: [32.7, 49.0], // C1, G1 (low open 5th)
  waveforms: ['sine', 'triangle'],
  detune: [0, -20],
  lfoRate: 0.02,
  lfoDepth: 0.3,
  volume: 0.08,
};

// Respawn: Rising, hopeful major chord
const RESPAWN_CONFIG: MoodConfig = {
  frequencies: [196.0, 246.94, 293.66, 392.0], // G3, B3, D4, G4 (G major spread)
  waveforms: ['sine', 'sine', 'sine', 'triangle'],
  detune: [0, 4, -2, 3],
  lfoRate: 0.12,
  lfoDepth: 0.25,
  volume: 0.13,
};

// Underwater: Muffled, deep, filtered
const UNDERWATER_CONFIG: MoodConfig = {
  frequencies: [65.41, 82.41, 98.0], // C2, E2, G2 (C major low)
  waveforms: ['sine', 'sine', 'triangle'],
  detune: [0, 6, -4],
  lfoRate: 0.06,
  lfoDepth: 0.35,
  volume: 0.09,
  filterCutoff: 300,
  filterLfoRate: 0.08,
  filterLfoDepth: 100,
};

const MOOD_CONFIGS: Record<MusicMood, MoodConfig> = {
  exploration: EXPLORATION_CONFIG,
  night: NIGHT_CONFIG,
  combat: COMBAT_CONFIG,
  building: BUILDING_CONFIG,
  menu: MENU_CONFIG,
  tension: TENSION_CONFIG,
  death: DEATH_CONFIG,
  respawn: RESPAWN_CONFIG,
  underwater: UNDERWATER_CONFIG,
};

// Pentatonic scale notes for melody fragments (exploration & building)
const PENTATONIC_C = [261.63, 293.66, 329.63, 392.0, 440.0]; // C4, D4, E4, G4, A4
const PENTATONIC_Am = [220.0, 246.94, 261.63, 329.63, 392.0]; // A3, B3, C4, E4, G4

// ─── Constants ───

const CROSSFADE_SECONDS = 3.0;
const MELODY_MIN_INTERVAL = 6.0; // seconds between melody notes
const MELODY_MAX_INTERVAL = 14.0;

// ─── Music System ───

class MusicSystem {
  private static instance: MusicSystem | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private activeLayer: MoodLayer | null = null;
  private fadingLayer: MoodLayer | null = null;
  private currentMood: MusicMood | null = null;
  private targetMood: MusicMood | null = null;

  private crossfadeProgress = 1.0;
  private isFading = false;

  private volume = 0.5; // 0-1 from settings (musicVolume / 100)
  private enabled = true;

  // Melody scheduling
  private melodyTimer = 0;
  private nextMelodyAt = 0;
  private activeMelodyOsc: OscillatorNode | null = null;
  private activeMelodyGain: GainNode | null = null;

  // Temporary mood override
  private tempMood: MusicMood | null = null;
  private tempMoodTimer = 0;
  private tempMoodDuration = 0;

  private constructor() {
    // Private — use getInstance()
  }

  static getInstance(): MusicSystem {
    if (!MusicSystem.instance) {
      MusicSystem.instance = new MusicSystem();
    }
    return MusicSystem.instance;
  }

  // ─── Initialization ───

  /** Must be called from a user gesture handler (click/keydown) */
  init(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.enabled ? this.volume : 0;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // AudioContext unavailable
      this.ctx = null;
      this.masterGain = null;
    }
  }

  // ─── Volume & Enable ───

  setVolume(normalized: number): void {
    this.volume = Math.max(0, Math.min(1, normalized));
    if (this.masterGain && this.enabled) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx!.currentTime, 0.1);
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(on ? this.volume : 0, this.ctx!.currentTime, 0.3);
    }
  }

  // ─── Mood Control ───

  setMood(mood: MusicMood): void {
    this.targetMood = mood;
  }

  /** Play a mood for a fixed duration, then revert to auto-determined mood */
  playTemporaryMood(mood: MusicMood, durationSeconds: number): void {
    this.tempMood = mood;
    this.tempMoodTimer = 0;
    this.tempMoodDuration = durationSeconds;
    this.setMood(mood);
  }

  private transitionTo(mood: MusicMood): void {
    if (!this.ctx || !this.masterGain) return;
    if (mood === this.currentMood) return;

    const config = MOOD_CONFIGS[mood];

    // Move active → fading
    if (this.activeLayer) {
      if (this.fadingLayer) {
        this.destroyLayer(this.fadingLayer);
      }
      this.fadingLayer = this.activeLayer;
      // Record the current volume for fade-out
      this.fadingLayerStartVolume = this.fadingLayer.masterGain.gain.value;
    }

    // Create new active layer at zero
    this.activeLayer = this.createLayer(config);
    this.activeLayer.masterGain.gain.value = 0;

    this.crossfadeProgress = 0;
    this.isFading = true;
    this.currentMood = mood;

    // Reset melody timer for new mood
    this.scheduleMelody();
  }

  // ─── Update ───

  /** Call once per frame with delta time in seconds */
  update(dt: number, timeOfDay?: number, inCombat?: boolean, buildingMode?: boolean, lowHealth?: boolean, isUnderwater?: boolean, isDead?: boolean): void {
    if (!this.ctx || !this.masterGain) return;

    // Handle temporary mood countdown
    if (this.tempMood !== null) {
      this.tempMoodTimer += dt;
      if (this.tempMoodTimer >= this.tempMoodDuration) {
        this.tempMood = null;
        this.tempMoodTimer = 0;
        this.tempMoodDuration = 0;
      } else {
        // Don't auto-determine mood while temp mood active
        // Check if we need to transition
        if (this.targetMood && this.targetMood !== this.currentMood) {
          this.transitionTo(this.targetMood);
          this.targetMood = null;
        }
        // ... rest of crossfade and melody (fall through below)
      }
    }

    // Auto-determine mood if game-state params are provided (and no temp mood)
    if (this.tempMood === null && timeOfDay !== undefined) {
      let newMood: MusicMood = 'exploration';
      if (isDead) {
        newMood = 'death';
      } else if (inCombat) {
        newMood = 'combat';
      } else if (isUnderwater) {
        newMood = 'underwater';
      } else if (lowHealth) {
        newMood = 'tension';
      } else if (buildingMode) {
        newMood = 'building';
      } else if (timeOfDay > 0.75 || timeOfDay < 0.25) {
        newMood = 'night';
      }
      this.setMood(newMood);
    }

    // Check if we need to transition
    if (this.targetMood && this.targetMood !== this.currentMood) {
      this.transitionTo(this.targetMood);
      this.targetMood = null;
    }

    // Crossfade update
    if (this.isFading) {
      this.crossfadeProgress = Math.min(1.0, this.crossfadeProgress + dt / CROSSFADE_SECONDS);
      const t = this.smoothstep(this.crossfadeProgress);

      // Fade in new layer
      if (this.activeLayer && this.currentMood) {
        const config = MOOD_CONFIGS[this.currentMood];
        this.activeLayer.masterGain.gain.value = config.volume * t;
      }

      // Fade out old layer
      if (this.fadingLayer) {
        this.fadingLayer.masterGain.gain.value = this.fadingLayerStartVolume * (1 - t);

        if (this.crossfadeProgress >= 1.0) {
          this.destroyLayer(this.fadingLayer);
          this.fadingLayer = null;
        }
      }

      if (this.crossfadeProgress >= 1.0) {
        this.isFading = false;
      }
    }

    // Melody fragments (only for exploration, building, menu)
    if (
      this.currentMood === 'exploration' ||
      this.currentMood === 'building' ||
      this.currentMood === 'menu'
    ) {
      this.melodyTimer += dt;
      if (this.melodyTimer >= this.nextMelodyAt) {
        this.playMelodyNote();
        this.scheduleMelody();
      }
    }
  }

  // ─── Melody Fragments ───

  private scheduleMelody(): void {
    this.melodyTimer = 0;
    this.nextMelodyAt =
      MELODY_MIN_INTERVAL + Math.random() * (MELODY_MAX_INTERVAL - MELODY_MIN_INTERVAL);
  }

  private playMelodyNote(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;

    const scale = this.currentMood === 'night' ? PENTATONIC_Am : PENTATONIC_C;
    const freq = scale[Math.floor(Math.random() * scale.length)]!;
    const duration = 2.0 + Math.random() * 2.0; // 2-4 seconds
    const now = this.ctx.currentTime;

    // Clean up previous melody if still playing
    this.cleanupMelody();

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 10; // slight random detune

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    // Slow attack, sustain, slow release envelope
    const attackTime = 0.8;
    const releaseTime = 1.2;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + attackTime);
    gain.gain.setValueAtTime(0.04, now + duration - releaseTime);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.1);

    this.activeMelodyOsc = osc;
    this.activeMelodyGain = gain;

    // Auto-cleanup after note ends
    osc.onended = () => {
      if (this.activeMelodyOsc === osc) {
        this.cleanupMelody();
      }
    };
  }

  private cleanupMelody(): void {
    if (this.activeMelodyOsc) {
      try {
        this.activeMelodyOsc.stop();
      } catch {
        // Already stopped
      }
      this.activeMelodyOsc.disconnect();
      this.activeMelodyOsc = null;
    }
    if (this.activeMelodyGain) {
      this.activeMelodyGain.disconnect();
      this.activeMelodyGain = null;
    }
  }

  // ─── Layer Management ───

  private fadingLayerStartVolume = 0;

  private createLayer(config: MoodConfig): MoodLayer {
    const ctx = this.ctx!;

    // Master gain for this layer
    const masterGain = ctx.createGain();
    masterGain.gain.value = config.volume;
    masterGain.connect(this.masterGain!);

    // Optional lowpass filter (combat mood)
    let filter: BiquadFilterNode | undefined;
    let filterLfo: OscillatorNode | undefined;
    let filterLfoGain: GainNode | undefined;

    if (config.filterCutoff) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = config.filterCutoff;
      filter.Q.value = 2;
    }

    if (config.filterLfoRate && filter) {
      filterLfo = ctx.createOscillator();
      filterLfo.type = 'sine';
      filterLfo.frequency.value = config.filterLfoRate;

      filterLfoGain = ctx.createGain();
      filterLfoGain.gain.value = config.filterLfoDepth ?? 200;

      filterLfo.connect(filterLfoGain);
      filterLfoGain.connect(filter.frequency);
      filterLfo.start();
    }

    // LFO for organic gain pulsing
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = config.lfoRate;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = config.lfoDepth * config.volume;

    lfo.connect(lfoGain);
    lfoGain.connect(masterGain.gain);
    lfo.start();

    // Create oscillator voices
    const voices: MoodVoice[] = [];
    const destination = filter ?? masterGain;

    for (let i = 0; i < config.frequencies.length; i++) {
      const freq = config.frequencies[i]!;
      const waveform = config.waveforms[i] ?? 'sine';
      const detune = config.detune[i] ?? 0;

      const oscillator = ctx.createOscillator();
      oscillator.type = waveform;
      oscillator.frequency.value = freq;
      oscillator.detune.value = detune;

      const gain = ctx.createGain();
      // Higher voices are progressively quieter
      gain.gain.value = 1.0 / (1 + i * 0.5);

      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();

      voices.push({ oscillator, gain });
    }

    // Wire filter into master if present
    if (filter) {
      filter.connect(masterGain);
    }

    return {
      voices,
      masterGain,
      lfo,
      lfoGain,
      filter,
      filterLfo,
      filterLfoGain,
    };
  }

  private destroyLayer(layer: MoodLayer): void {
    // Stop LFO
    try {
      layer.lfo.stop();
      layer.lfo.disconnect();
    } catch {
      // Already stopped
    }
    layer.lfoGain.disconnect();

    // Stop filter LFO
    if (layer.filterLfo) {
      try {
        layer.filterLfo.stop();
        layer.filterLfo.disconnect();
      } catch {
        // Already stopped
      }
    }
    if (layer.filterLfoGain) {
      layer.filterLfoGain.disconnect();
    }
    if (layer.filter) {
      layer.filter.disconnect();
    }

    // Stop all voices
    for (const voice of layer.voices) {
      try {
        voice.oscillator.stop();
        voice.oscillator.disconnect();
      } catch {
        // Already stopped
      }
      voice.gain.disconnect();
    }

    // Disconnect master
    layer.masterGain.disconnect();
  }

  // ─── Helpers ───

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  // ─── Cleanup ───

  dispose(): void {
    this.cleanupMelody();

    if (this.activeLayer) {
      this.destroyLayer(this.activeLayer);
      this.activeLayer = null;
    }
    if (this.fadingLayer) {
      this.destroyLayer(this.fadingLayer);
      this.fadingLayer = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
    this.currentMood = null;
    this.targetMood = null;
    this.tempMood = null;
    this.tempMoodTimer = 0;
    this.tempMoodDuration = 0;
  }
}

// ─── Singleton Export ───

export const musicSystem = MusicSystem.getInstance();
