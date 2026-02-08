// ─── Ambient Synthesizer ───
// Procedural ambient drone synthesis using Web Audio API. Creates
// organic, evolving soundscapes for each biome mood. Each mood uses
// 2-3 oscillators with LFO gain modulation for a living feel.
// Crossfades smoothly between moods over 3 seconds.

// ─── Types ───

interface OscillatorVoice {
  oscillator: OscillatorNode;
  gain: GainNode;
}

interface MoodLayer {
  voices: OscillatorVoice[];
  masterGain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
}

interface MoodConfig {
  baseFrequencies: number[];
  waveforms: OscillatorType[];
  detune: number[]; // cents offset per voice
  lfoRate: number; // Hz
  lfoDepth: number; // 0-1 how much gain modulation
  masterVolume: number;
}

// ─── Mood Configurations ───

const MOOD_CONFIGS: Record<string, MoodConfig> = {
  peaceful: {
    baseFrequencies: [130.81, 164.81, 196.0], // C3, E3, G3 (major chord)
    waveforms: ['sine', 'triangle', 'sine'],
    detune: [0, 3, -2],
    lfoRate: 0.15,
    lfoDepth: 0.3,
    masterVolume: 0.06,
  },
  tense: {
    baseFrequencies: [110.0, 130.81, 164.81], // A2, C3, E3 (A minor)
    waveforms: ['triangle', 'sine', 'triangle'],
    detune: [0, -5, 7],
    lfoRate: 0.35,
    lfoDepth: 0.4,
    masterVolume: 0.07,
  },
  eerie: {
    baseFrequencies: [155.56, 185.0], // Eb3, ~F#3 (dissonant tritone)
    waveforms: ['sine', 'sine'],
    detune: [0, 12],
    lfoRate: 0.1,
    lfoDepth: 0.5,
    masterVolume: 0.04,
  },
  melancholy: {
    baseFrequencies: [146.83, 174.61, 220.0], // D3, F3, A3 (D minor)
    waveforms: ['sine', 'triangle', 'sine'],
    detune: [0, 2, -3],
    lfoRate: 0.12,
    lfoDepth: 0.35,
    masterVolume: 0.05,
  },
};

// ─── Constants ───

const CROSSFADE_DURATION = 3.0; // seconds

// ─── Ambient Synthesizer ───

export class AmbientSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private activeLayer: MoodLayer | null = null;
  private fadingLayer: MoodLayer | null = null;
  private currentMood: string = '';

  private crossfadeProgress = 1.0;
  private isFading = false;

  constructor() {
    // AudioContext is NOT created here — must be initialized from a user gesture
  }

  // ─── Initialization ───

  /** Must be called from a user gesture handler (click/keydown) */
  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);
  }

  // ─── Mood Control ───

  setMood(mood: string): void {
    if (!this.ctx || !this.masterGain) return;
    if (mood === this.currentMood) return;

    const config = MOOD_CONFIGS[mood];
    if (!config) return;

    // If we already have an active layer, move it to fading
    if (this.activeLayer) {
      // Stop any previous fading layer first
      if (this.fadingLayer) {
        this.destroyLayer(this.fadingLayer);
      }
      this.fadingLayer = this.activeLayer;
    }

    // Create new active layer
    this.activeLayer = this.createLayer(config);

    // Start crossfade
    this.crossfadeProgress = 0;
    this.isFading = true;
    this.currentMood = mood;

    // Start new layer at zero volume
    this.activeLayer.masterGain.gain.value = 0;
  }

  // ─── Update ───

  update(dt: number): void {
    if (!this.ctx || !this.isFading) return;

    this.crossfadeProgress = Math.min(1.0, this.crossfadeProgress + dt / CROSSFADE_DURATION);

    // Smooth crossfade curve
    const t = this.smoothstep(this.crossfadeProgress);

    // Fade in new layer
    if (this.activeLayer) {
      const config = MOOD_CONFIGS[this.currentMood];
      if (config) {
        this.activeLayer.masterGain.gain.value = config.masterVolume * t;
      }
    }

    // Fade out old layer
    if (this.fadingLayer) {
      // The fading layer starts at its original volume and fades to 0
      this.fadingLayer.masterGain.gain.value = this.fadingLayer.masterGain.gain.value * (1 - t);

      if (this.crossfadeProgress >= 1.0) {
        this.destroyLayer(this.fadingLayer);
        this.fadingLayer = null;
      }
    }

    if (this.crossfadeProgress >= 1.0) {
      this.isFading = false;
    }
  }

  // ─── Layer Management ───

  private createLayer(config: MoodConfig): MoodLayer {
    const ctx = this.ctx!;

    // Master gain for this layer
    const masterGain = ctx.createGain();
    masterGain.gain.value = config.masterVolume;
    masterGain.connect(this.masterGain!);

    // LFO for organic gain pulsing
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = config.lfoRate;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = config.lfoDepth * config.masterVolume;

    lfo.connect(lfoGain);
    lfoGain.connect(masterGain.gain);
    lfo.start();

    // Create oscillator voices
    const voices: OscillatorVoice[] = [];

    for (let i = 0; i < config.baseFrequencies.length; i++) {
      const freq = config.baseFrequencies[i]!;
      const waveform = config.waveforms[i] ?? 'sine';
      const detune = config.detune[i] ?? 0;

      const oscillator = ctx.createOscillator();
      oscillator.type = waveform;
      oscillator.frequency.value = freq;
      oscillator.detune.value = detune;

      const gain = ctx.createGain();
      // Higher voices are quieter for a natural harmonic balance
      gain.gain.value = 1.0 / (i + 1);

      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start();

      voices.push({ oscillator, gain });
    }

    return { voices, masterGain, lfo, lfoGain };
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
    this.currentMood = '';
  }
}
