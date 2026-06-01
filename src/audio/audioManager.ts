export type BgmKey = 'menu' | 'match';
export type SoundKey =
  | 'select'
  | 'cancel'
  | 'start'
  | 'score'
  | 'fail'
  | 'tagHit'
  | 'throw'
  | 'kick'
  | 'whistle'
  | 'timerTick';

export type AudioSettings = {
  bgmVolume: number;
  seVolume: number;
  muted: boolean;
  currentBgm: BgmKey | null;
};

type AudioSettingsListener = (settings: AudioSettings) => void;
type OscillatorTypeName = OscillatorType;
type BrowserAudioContext = AudioContext;
type WebAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

type BgmNote = {
  beat: number;
  frequency: number;
  duration: number;
  volume?: number;
  type?: OscillatorTypeName;
};

const storageKeys = {
  bgmVolume: 'hsa_bgm_volume',
  seVolume: 'hsa_se_volume',
  muted: 'hsa_muted',
} as const;

const defaultSettings: AudioSettings = {
  bgmVolume: 0.35,
  seVolume: 0.65,
  muted: false,
  currentBgm: null,
};

const bgmPatterns: Record<BgmKey, { bpm: number; beats: number; notes: BgmNote[] }> = {
  menu: {
    bpm: 108,
    beats: 16,
    notes: [
      { beat: 0, frequency: 261.63, duration: 0.45, type: 'square' },
      { beat: 1, frequency: 329.63, duration: 0.45, type: 'square' },
      { beat: 2, frequency: 392, duration: 0.45, type: 'square' },
      { beat: 3, frequency: 329.63, duration: 0.45, type: 'square' },
      { beat: 4, frequency: 246.94, duration: 0.45, type: 'square' },
      { beat: 5, frequency: 329.63, duration: 0.45, type: 'square' },
      { beat: 6, frequency: 392, duration: 0.45, type: 'square' },
      { beat: 7, frequency: 493.88, duration: 0.45, type: 'square' },
      { beat: 8, frequency: 220, duration: 0.45, type: 'square' },
      { beat: 9, frequency: 277.18, duration: 0.45, type: 'square' },
      { beat: 10, frequency: 329.63, duration: 0.45, type: 'square' },
      { beat: 11, frequency: 277.18, duration: 0.45, type: 'square' },
      { beat: 12, frequency: 196, duration: 0.45, type: 'square' },
      { beat: 13, frequency: 246.94, duration: 0.45, type: 'square' },
      { beat: 14, frequency: 329.63, duration: 0.45, type: 'square' },
      { beat: 15, frequency: 392, duration: 0.45, type: 'square' },
      { beat: 0, frequency: 130.81, duration: 1.8, volume: 0.36, type: 'triangle' },
      { beat: 4, frequency: 123.47, duration: 1.8, volume: 0.36, type: 'triangle' },
      { beat: 8, frequency: 110, duration: 1.8, volume: 0.36, type: 'triangle' },
      { beat: 12, frequency: 98, duration: 1.8, volume: 0.36, type: 'triangle' },
    ],
  },
  match: {
    bpm: 132,
    beats: 16,
    notes: [
      { beat: 0, frequency: 440, duration: 0.32, type: 'square' },
      { beat: 0.5, frequency: 523.25, duration: 0.32, type: 'square' },
      { beat: 1, frequency: 659.25, duration: 0.32, type: 'square' },
      { beat: 1.5, frequency: 523.25, duration: 0.32, type: 'square' },
      { beat: 2, frequency: 392, duration: 0.32, type: 'square' },
      { beat: 2.5, frequency: 523.25, duration: 0.32, type: 'square' },
      { beat: 3, frequency: 659.25, duration: 0.32, type: 'square' },
      { beat: 3.5, frequency: 783.99, duration: 0.32, type: 'square' },
      { beat: 4, frequency: 349.23, duration: 0.32, type: 'square' },
      { beat: 4.5, frequency: 440, duration: 0.32, type: 'square' },
      { beat: 5, frequency: 587.33, duration: 0.32, type: 'square' },
      { beat: 5.5, frequency: 440, duration: 0.32, type: 'square' },
      { beat: 6, frequency: 329.63, duration: 0.32, type: 'square' },
      { beat: 6.5, frequency: 440, duration: 0.32, type: 'square' },
      { beat: 7, frequency: 587.33, duration: 0.32, type: 'square' },
      { beat: 7.5, frequency: 659.25, duration: 0.32, type: 'square' },
      { beat: 8, frequency: 392, duration: 0.32, type: 'square' },
      { beat: 8.5, frequency: 493.88, duration: 0.32, type: 'square' },
      { beat: 9, frequency: 659.25, duration: 0.32, type: 'square' },
      { beat: 9.5, frequency: 493.88, duration: 0.32, type: 'square' },
      { beat: 10, frequency: 349.23, duration: 0.32, type: 'square' },
      { beat: 10.5, frequency: 493.88, duration: 0.32, type: 'square' },
      { beat: 11, frequency: 659.25, duration: 0.32, type: 'square' },
      { beat: 11.5, frequency: 783.99, duration: 0.32, type: 'square' },
      { beat: 12, frequency: 293.66, duration: 0.32, type: 'square' },
      { beat: 12.5, frequency: 440, duration: 0.32, type: 'square' },
      { beat: 13, frequency: 587.33, duration: 0.32, type: 'square' },
      { beat: 13.5, frequency: 440, duration: 0.32, type: 'square' },
      { beat: 14, frequency: 329.63, duration: 0.32, type: 'square' },
      { beat: 14.5, frequency: 440, duration: 0.32, type: 'square' },
      { beat: 15, frequency: 587.33, duration: 0.32, type: 'square' },
      { beat: 15.5, frequency: 659.25, duration: 0.32, type: 'square' },
      { beat: 0, frequency: 110, duration: 1.2, volume: 0.42, type: 'triangle' },
      { beat: 4, frequency: 87.31, duration: 1.2, volume: 0.42, type: 'triangle' },
      { beat: 8, frequency: 98, duration: 1.2, volume: 0.42, type: 'triangle' },
      { beat: 12, frequency: 73.42, duration: 1.2, volume: 0.42, type: 'triangle' },
    ],
  },
};

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const audioWindow = window as WebAudioWindow;
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStoredNumber(key: string, fallback: number): number {
  const storage = getLocalStorage();

  if (!storage) {
    return fallback;
  }

  const stored = storage.getItem(key);

  if (stored === null) {
    return fallback;
  }

  return clampVolume(Number(stored));
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  const storage = getLocalStorage();

  if (!storage) {
    return fallback;
  }

  const stored = storage.getItem(key);

  if (stored === null) {
    return fallback;
  }

  return stored === 'true';
}

class AudioManager {
  private readonly listeners = new Set<AudioSettingsListener>();

  private audioContext: BrowserAudioContext | null = null;

  private bgmGain: GainNode | null = null;

  private seGain: GainNode | null = null;

  private bgmTimer: number | null = null;

  private readonly activeBgmNodes = new Set<AudioScheduledSourceNode>();

  private settings: AudioSettings = {
    ...defaultSettings,
    bgmVolume: readStoredNumber(storageKeys.bgmVolume, defaultSettings.bgmVolume),
    seVolume: readStoredNumber(storageKeys.seVolume, defaultSettings.seVolume),
    muted: readStoredBoolean(storageKeys.muted, defaultSettings.muted),
  };

  preload(): void {
    // Procedural audio has no external assets to fetch; keep this no-op so page load never starts audio.
  }

  playBgm(key: BgmKey): void {
    const context = this.ensureAudioGraph();

    if (!context || !this.bgmGain) {
      return;
    }

    void context.resume();
    this.stopBgmNodes();
    this.settings = { ...this.settings, currentBgm: key };
    this.notify();
    this.scheduleBgmLoop(key);
  }

  stopBgm(): void {
    this.stopBgmNodes();

    if (this.settings.currentBgm !== null) {
      this.settings = { ...this.settings, currentBgm: null };
      this.notify();
    }
  }

  playSe(key: SoundKey): void {
    if (this.settings.muted) {
      return;
    }

    const context = this.ensureAudioGraph();

    if (!context || !this.seGain) {
      return;
    }

    void context.resume();

    const seGain = this.seGain;
    const startTime = context.currentTime + 0.01;

    if (key === 'select') {
      this.playTone({ frequency: 620, startTime, duration: 0.07, destination: seGain, type: 'square', volume: 0.34 });
      this.playTone({ frequency: 930, startTime: startTime + 0.055, duration: 0.08, destination: seGain, type: 'square', volume: 0.3 });
    }

    if (key === 'cancel') {
      this.playTone({ frequency: 330, endFrequency: 180, startTime, duration: 0.18, destination: seGain, type: 'triangle', volume: 0.44 });
    }

    if (key === 'start') {
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        this.playTone({ frequency, startTime: startTime + index * 0.08, duration: 0.1, destination: seGain, type: 'square', volume: 0.32 });
      });
    }

    if (key === 'score') {
      [880, 1174.66, 1567.98].forEach((frequency, index) => {
        this.playTone({ frequency, startTime: startTime + index * 0.07, duration: 0.16, destination: seGain, type: 'square', volume: 0.3 });
      });
    }

    if (key === 'fail') {
      this.playTone({ frequency: 240, endFrequency: 90, startTime, duration: 0.38, destination: seGain, type: 'sawtooth', volume: 0.32 });
    }

    if (key === 'tagHit') {
      this.playTone({ frequency: 170, startTime, duration: 0.08, destination: seGain, type: 'square', volume: 0.4 });
      this.playNoise({ startTime, duration: 0.07, destination: seGain, volume: 0.28 });
    }

    if (key === 'throw') {
      this.playTone({ frequency: 130, endFrequency: 540, startTime, duration: 0.24, destination: seGain, type: 'triangle', volume: 0.3 });
      this.playNoise({ startTime, duration: 0.12, destination: seGain, volume: 0.12 });
    }

    if (key === 'kick') {
      this.playTone({ frequency: 120, endFrequency: 50, startTime, duration: 0.14, destination: seGain, type: 'sine', volume: 0.55 });
    }

    if (key === 'whistle') {
      this.playTone({ frequency: 1760, startTime, duration: 0.18, destination: seGain, type: 'sine', volume: 0.34 });
      this.playTone({ frequency: 1760, startTime: startTime + 0.23, duration: 0.22, destination: seGain, type: 'sine', volume: 0.34 });
    }

    if (key === 'timerTick') {
      this.playTone({ frequency: 1250, startTime, duration: 0.055, destination: seGain, type: 'square', volume: 0.28 });
    }
  }

  setBgmVolume(value: number): void {
    const bgmVolume = clampVolume(value);
    this.settings = { ...this.settings, bgmVolume };
    this.updateGainVolumes();
    this.persist();
    this.notify();
  }

  setSeVolume(value: number): void {
    const seVolume = clampVolume(value);
    this.settings = { ...this.settings, seVolume };
    this.updateGainVolumes();
    this.persist();
    this.notify();
  }

  setMuted(value: boolean): void {
    this.settings = { ...this.settings, muted: value };
    this.updateGainVolumes();
    this.persist();
    this.notify();
  }

  isMuted(): boolean {
    return this.settings.muted;
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  subscribe(listener: AudioSettingsListener): () => void {
    this.listeners.add(listener);
    listener(this.getSettings());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private ensureAudioGraph(): BrowserAudioContext | null {
    if (this.audioContext && this.bgmGain && this.seGain) {
      return this.audioContext;
    }

    const AudioContextConstructor = getAudioContextConstructor();

    if (!AudioContextConstructor) {
      return null;
    }

    const context = new AudioContextConstructor();
    const bgmGain = context.createGain();
    const seGain = context.createGain();

    bgmGain.connect(context.destination);
    seGain.connect(context.destination);

    this.audioContext = context;
    this.bgmGain = bgmGain;
    this.seGain = seGain;
    this.updateGainVolumes();

    return context;
  }

  private scheduleBgmLoop(key: BgmKey): void {
    if (!this.audioContext || !this.bgmGain || this.settings.currentBgm !== key) {
      return;
    }

    const pattern = bgmPatterns[key];
    const secondsPerBeat = 60 / pattern.bpm;
    const patternDuration = pattern.beats * secondsPerBeat;
    const startTime = this.audioContext.currentTime + 0.03;

    pattern.notes.forEach((note) => {
      this.playTone({
        frequency: note.frequency,
        startTime: startTime + note.beat * secondsPerBeat,
        duration: note.duration * secondsPerBeat,
        destination: this.bgmGain as GainNode,
        type: note.type ?? 'square',
        volume: note.volume ?? 0.24,
        trackAsBgm: true,
      });
    });

    this.scheduleBgmPulse(startTime, pattern.beats, secondsPerBeat);

    this.bgmTimer = window.setTimeout(() => {
      this.scheduleBgmLoop(key);
    }, patternDuration * 1000);
  }

  private scheduleBgmPulse(startTime: number, beats: number, secondsPerBeat: number): void {
    if (!this.audioContext || !this.bgmGain) {
      return;
    }

    for (let beat = 0; beat < beats; beat += 1) {
      this.playTone({
        frequency: 82,
        endFrequency: 48,
        startTime: startTime + beat * secondsPerBeat,
        duration: 0.08,
        destination: this.bgmGain,
        type: 'sine',
        volume: beat % 4 === 0 ? 0.22 : 0.12,
        trackAsBgm: true,
      });
    }
  }

  private stopBgmNodes(): void {
    if (this.bgmTimer !== null) {
      window.clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }

    this.activeBgmNodes.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Ignore nodes that have already stopped naturally.
      }
    });
    this.activeBgmNodes.clear();
  }

  private playTone({
    frequency,
    endFrequency,
    startTime,
    duration,
    destination,
    type = 'square',
    volume = 0.25,
    trackAsBgm = false,
  }: {
    frequency: number;
    endFrequency?: number;
    startTime: number;
    duration: number;
    destination: AudioNode;
    type?: OscillatorTypeName;
    volume?: number;
    trackAsBgm?: boolean;
  }): void {
    if (!this.audioContext) {
      return;
    }

    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const stopTime = startTime + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), stopTime);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(startTime);
    oscillator.stop(stopTime + 0.02);

    if (trackAsBgm) {
      this.activeBgmNodes.add(oscillator);
      oscillator.addEventListener('ended', () => {
        this.activeBgmNodes.delete(oscillator);
      });
    }
  }

  private playNoise({
    startTime,
    duration,
    destination,
    volume = 0.2,
  }: {
    startTime: number;
    duration: number;
    destination: AudioNode;
    volume?: number;
  }): void {
    if (!this.audioContext) {
      return;
    }

    const sampleRate = this.audioContext.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const stopTime = startTime + duration;

    source.buffer = buffer;
    gain.gain.setValueAtTime(Math.max(0.0001, volume), startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    source.connect(gain);
    gain.connect(destination);
    source.start(startTime);
    source.stop(stopTime + 0.01);
  }

  private updateGainVolumes(): void {
    const bgmVolume = this.settings.muted ? 0 : this.settings.bgmVolume;
    const seVolume = this.settings.muted ? 0 : this.settings.seVolume;

    if (this.bgmGain) {
      this.bgmGain.gain.value = bgmVolume;
    }

    if (this.seGain) {
      this.seGain.gain.value = seVolume;
    }
  }

  private persist(): void {
    const storage = getLocalStorage();

    if (!storage) {
      return;
    }

    try {
      storage.setItem(storageKeys.bgmVolume, String(this.settings.bgmVolume));
      storage.setItem(storageKeys.seVolume, String(this.settings.seVolume));
      storage.setItem(storageKeys.muted, String(this.settings.muted));
    } catch {
      // Ignore storage failures so audio controls keep working in private or restricted contexts.
    }
  }

  private notify(): void {
    const snapshot = this.getSettings();

    this.listeners.forEach((listener) => {
      listener(snapshot);
    });
  }
}

export const audioManager = new AudioManager();
