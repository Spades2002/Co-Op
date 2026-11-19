import type { PlayerSettings } from '../types/game.ts';

export type PlayableScene = 'lobby' | 'easy' | 'medium' | 'hard';
/** 'none' means silence: used once a level has loaded. */
export type MusicScene = PlayableScene | 'none';

type SceneStyle = {
  pad: number[];
  padBright: number;
  tremoloHz: number;
  noteMs: number;
  noteGain: number;
  pulseMs: number;
  stingerMs: number;
};

// Each scene is a slow D minor haunted-house sound. Higher difficulty adds
// dissonance, a heartbeat and eerie high notes.
const SCENE_STYLES: Record<PlayableScene, SceneStyle> = {
  lobby: { pad: [146.83, 174.61, 220.0], padBright: 1100, tremoloHz: 0, noteMs: 1150, noteGain: 0.25, pulseMs: 0, stingerMs: 0 },
  easy: { pad: [146.83, 220.0, 293.66], padBright: 900, tremoloHz: 0, noteMs: 1400, noteGain: 0.2, pulseMs: 0, stingerMs: 0 },
  medium: { pad: [146.83, 155.56, 220.0], padBright: 800, tremoloHz: 0.18, noteMs: 1000, noteGain: 0.24, pulseMs: 1700, stingerMs: 0 },
  hard: { pad: [146.83, 207.65, 233.08], padBright: 700, tremoloHz: 0.45, noteMs: 720, noteGain: 0.26, pulseMs: 1150, stingerMs: 7000 },
};

const MOTIF = [293.66, 349.23, 440.0, 415.3, 349.23, 329.63, 293.66, 220.0, 261.63, 329.63, 440.0, 523.25];

type MusicHandle = { stop: () => void };

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private unlocked = false;
  private desiredScene: MusicScene = 'lobby';
  private activeScene: MusicScene | null = null;
  private sceneToken = 0;
  private current: MusicHandle | null = null;
  private fileEl: HTMLAudioElement | null = null;
  private fileChecks: Partial<Record<PlayableScene, boolean>> = {};

  private settings: PlayerSettings = {
    musicVolume: 0.45,
    sfxVolume: 0.7,
    muted: false,
    graphicsQuality: 'medium',
    cameraSensitivity: 1.0,
    invertY: false,
  };

  public updateSettings(next: PlayerSettings) {
    this.settings = next;
    this.applyVolumes();
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private applyVolumes() {
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const mVol = this.settings.muted ? 0 : this.settings.musicVolume * 0.5;
    const sVol = this.settings.muted ? 0 : this.settings.sfxVolume * 0.45;
    this.musicGain.gain.setTargetAtTime(mVol, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(sVol, now, 0.05);
    this.applyFileVolume();
  }

  private applyFileVolume() {
    const el = this.fileEl;
    if (!el) return;
    if (this.settings.muted || this.settings.musicVolume <= 0.01) {
      el.pause();
      return;
    }
    el.volume = Math.min(1, this.settings.musicVolume);
    if (el.paused) el.play().catch(() => {});
  }

  /** Choose which music plays. Takes effect straight away once audio is unlocked. */
  public setMusicScene(scene: MusicScene) {
    this.desiredScene = scene;
    if (this.unlocked && scene !== this.activeScene) {
      void this.startScene(scene);
    }
  }

  /** Call from a tap or key press: browsers only allow audio after one. */
  public unlockAndStartMusic() {
    const ctx = this.ensureContext();
    if (!ctx || this.unlocked) return;
    this.unlocked = true;
    void this.startScene(this.desiredScene);
  }

  public stopMusic() {
    this.sceneToken++;
    this.unlocked = false;
    this.activeScene = null;
    this.stopCurrent();
  }

  private stopCurrent() {
    this.current?.stop();
    this.current = null;
  }

  // Optional real music: put lobby.mp3, easy.mp3, medium.mp3 or hard.mp3 in public/audio.
  private async hasTrackFile(scene: PlayableScene): Promise<boolean> {
    const known = this.fileChecks[scene];
    if (known !== undefined) return known;
    let ok = false;
    try {
      const res = await fetch(`/audio/${scene}.mp3`, { method: 'HEAD' });
      ok = res.ok && (res.headers.get('content-type') || '').startsWith('audio');
    } catch {
      ok = false;
    }
    this.fileChecks[scene] = ok;
    return ok;
  }

  private async startScene(scene: MusicScene) {
    this.stopCurrent();
    this.activeScene = scene;
    const token = ++this.sceneToken;
    if (scene === 'none') return;

    if (await this.hasTrackFile(scene)) {
      if (token !== this.sceneToken) return;
      const el = new Audio(`/audio/${scene}.mp3`);
      el.loop = true;
      el.volume = Math.min(1, this.settings.musicVolume);
      this.fileEl = el;
      this.current = {
        stop: () => {
          el.pause();
          if (this.fileEl === el) this.fileEl = null;
        },
      };
      try {
        if (!this.settings.muted) await el.play();
        return;
      } catch {
        // fall through to the generated music
        if (this.fileEl === el) this.fileEl = null;
        this.current = null;
      }
    }

    if (token !== this.sceneToken) return;
    this.current = this.buildGeneratedScene(scene);
  }

  private buildGeneratedScene(scene: PlayableScene): MusicHandle | null {
    const ctx = this.ctx;
    const master = this.musicGain;
    if (!ctx || !master) return null;
    const style = SCENE_STYLES[scene];

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
    out.connect(master);

    const sources: AudioScheduledSourceNode[] = [];
    let alive = true;
    let noteTimer: number | undefined;
    let pulseTimer: number | undefined;
    let stingerTimer: number | undefined;

    // Soft chord in the middle of the range so small speakers can play it
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = style.padBright;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.11;
    filter.connect(padGain);
    padGain.connect(out);
    style.pad.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1) * 6;
      osc.connect(filter);
      osc.start();
      sources.push(osc);
    });
    if (style.tremoloHz > 0) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = style.tremoloHz;
      const depth = ctx.createGain();
      depth.gain.value = 0.06;
      lfo.connect(depth);
      depth.connect(padGain.gain);
      lfo.start();
      sources.push(lfo);
    }

    const audible = () => ctx.state === 'running' && !this.settings.muted && this.settings.musicVolume > 0.01;

    // Music-box melody
    let step = 0;
    const playNote = () => {
      if (!alive) return;
      if (audible()) {
        const now = ctx.currentTime;
        let freq = MOTIF[step % MOTIF.length];
        if (scene === 'hard' && step % 5 === 4) freq *= 0.943; // an uneasy flat note
        step++;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.exponentialRampToValueAtTime(style.noteGain, now + 0.03);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);
        osc.connect(env);
        env.connect(out);
        osc.start(now);
        osc.stop(now + 1.9);
      }
      noteTimer = window.setTimeout(playNote, style.noteMs + (step % 3 === 0 ? 400 : 0));
    };
    playNote();

    // Heartbeat for the tenser scenes
    if (style.pulseMs > 0) {
      const thump = (when: number, level: number) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(95, when);
        osc.frequency.exponentialRampToValueAtTime(52, when + 0.14);
        env.gain.setValueAtTime(level, when);
        env.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
        osc.connect(env);
        env.connect(out);
        osc.start(when);
        osc.stop(when + 0.25);
      };
      const beat = () => {
        if (!alive) return;
        if (audible()) {
          const now = ctx.currentTime;
          thump(now, 0.4);
          thump(now + 0.22, 0.26);
        }
        pulseTimer = window.setTimeout(beat, style.pulseMs);
      };
      pulseTimer = window.setTimeout(beat, 800);
    }

    // Eerie high note now and then on the hardest levels
    if (style.stingerMs > 0) {
      const stinger = () => {
        if (!alive) return;
        if (audible()) {
          const now = ctx.currentTime;
          [1318.5, 1329.0].forEach((freq) => {
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            env.gain.setValueAtTime(0.0001, now);
            env.gain.exponentialRampToValueAtTime(0.05, now + 0.7);
            env.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
            osc.connect(env);
            env.connect(out);
            osc.start(now);
            osc.stop(now + 2.7);
          });
        }
        stingerTimer = window.setTimeout(stinger, style.stingerMs + Math.random() * 4000);
      };
      stingerTimer = window.setTimeout(stinger, style.stingerMs);
    }

    return {
      stop: () => {
        alive = false;
        window.clearTimeout(noteTimer);
        window.clearTimeout(pulseTimer);
        window.clearTimeout(stingerTimer);
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
        out.gain.linearRampToValueAtTime(0.0001, t + 0.5);
        window.setTimeout(() => {
          sources.forEach((src) => {
            try {
              src.stop();
            } catch {
              // already stopped
            }
          });
          out.disconnect();
        }, 600);
      },
    };
  }

  public playFootstep() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.settings.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(105 + Math.random() * 25, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.06);
    env.gain.setValueAtTime(0.12, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playClueDiscovered() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.settings.muted) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.065;
      osc.frequency.setValueAtTime(freq, t);
      env.gain.setValueAtTime(0.001, t);
      env.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(env);
      env.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  }

  public playGhostSpeak() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.settings.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.4);
    env.gain.setValueAtTime(0.001, now);
    env.gain.exponentialRampToValueAtTime(0.18, now + 0.08);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  public playEmotePing() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.settings.muted) return;
    const now = ctx.currentTime;
    [587.33, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      env.gain.setValueAtTime(0.18, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(env);
      env.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.27);
    });
  }

  public playPuzzleSolved() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.settings.muted) return;
    const now = ctx.currentTime;
    [392.0, 493.88, 587.33, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      env.gain.setValueAtTime(0.24, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(env);
      env.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.52);
    });
  }

  public playCaseResult(won: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.settings.muted) return;
    const now = ctx.currentTime;
    const notes = won ? [293.66, 369.99, 440.0, 587.33] : [293.66, 277.18, 246.94, 196.0];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = won ? 'triangle' : 'sawtooth';
      const t = now + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      env.gain.setValueAtTime(won ? 0.24 : 0.14, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      osc.connect(env);
      env.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  }

  public playClick() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.settings.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    env.gain.setValueAtTime(0.1, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }
  // ---------------------------------------------------------------------
  // Interaction sound effects (no music is playing during a level)
  // ---------------------------------------------------------------------

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    start: number,
    dur: number,
    vol: number,
    opts: { vibHz?: number; vibDepth?: number; attack?: number; filter?: number } = {},
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
    const attack = opts.attack ?? 0.015;
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(vol, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let node: AudioNode = osc;
    if (opts.filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = opts.filter;
      osc.connect(lp);
      node = lp;
    }
    node.connect(env);
    env.connect(this.sfxGain);
    if (opts.vibHz) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = opts.vibHz;
      depth.gain.value = opts.vibDepth ?? 8;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + dur + 0.05);
    }
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  private noise(start: number, dur: number, vol: number, freq: number, q = 1, kind: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = kind;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.02, dur / 3));
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filt);
    filt.connect(env);
    env.connect(this.sfxGain);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  private ready(): number | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.settings.muted) return null;
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx.currentTime;
  }

  /** Paper rustle and a soft cover thud. */
  public playNotebookOpen() {
    const t = this.ready();
    if (t === null) return;
    this.noise(t, 0.12, 0.16, 2800, 0.8);
    this.noise(t + 0.09, 0.16, 0.12, 3600, 0.8);
    this.tone('sine', 150, 80, t + 0.02, 0.12, 0.14);
  }

  public playNotebookClose() {
    const t = this.ready();
    if (t === null) return;
    this.noise(t, 0.1, 0.12, 2200, 0.8);
    this.tone('sine', 120, 60, t + 0.05, 0.14, 0.18);
  }

  /** Sound for examining an object. Shaped by what kind of prop it is. */
  public playObjectInteract(propType?: string) {
    const t = this.ready();
    if (t === null) return;
    switch (propType) {
      case 'letter':
      case 'blueprint':
      case 'ledger':
        this.noise(t, 0.14, 0.14, 3200, 0.7);
        this.noise(t + 0.1, 0.12, 0.1, 4200, 0.7);
        break;
      case 'dagger':
        this.tone('triangle', 2400, 3100, t, 0.5, 0.07, { attack: 0.005 });
        this.noise(t, 0.08, 0.12, 6000, 2, 'highpass');
        break;
      case 'vial':
      case 'glass':
        this.tone('sine', 1760, 1760, t, 0.4, 0.09, { attack: 0.004 });
        this.tone('sine', 2637, 2637, t + 0.03, 0.35, 0.06, { attack: 0.004 });
        break;
      case 'key':
        this.tone('square', 1900, 1900, t, 0.05, 0.05, { attack: 0.003 });
        this.tone('square', 1500, 1500, t + 0.07, 0.07, 0.05, { attack: 0.003 });
        this.noise(t + 0.02, 0.1, 0.06, 5000, 2, 'highpass');
        break;
      case 'locket':
        this.tone('sine', 1319, 1319, t, 0.3, 0.08, { attack: 0.004 });
        this.tone('sine', 1568, 1568, t + 0.1, 0.35, 0.08, { attack: 0.004 });
        break;
      case 'candle':
        this.noise(t, 0.3, 0.1, 900, 0.5, 'lowpass');
        this.tone('sine', 180, 120, t, 0.25, 0.05);
        break;
      case 'footprint':
        this.tone('triangle', 110, 50, t, 0.12, 0.16);
        this.noise(t, 0.1, 0.1, 500, 0.6);
        break;
      default:
        this.tone('triangle', 330, 260, t, 0.16, 0.12);
        this.noise(t, 0.06, 0.06, 1800, 0.8);
    }
  }

  /** Cipher lock and puzzle-box mechanism sounds. */
  public playPuzzleInteract() {
    const t = this.ready();
    if (t === null) return;
    [0, 0.09, 0.18].forEach((d, i) => {
      this.tone('square', 900 + i * 140, 700 + i * 90, t + d, 0.04, 0.05, { attack: 0.002 });
      this.noise(t + d, 0.03, 0.08, 4000, 1.5, 'highpass');
    });
    this.tone('sine', 140, 90, t + 0.25, 0.2, 0.1);
  }

  public playPuzzleWrong() {
    const t = this.ready();
    if (t === null) return;
    this.tone('sawtooth', 190, 120, t, 0.28, 0.1, { filter: 700 });
    this.tone('sawtooth', 160, 90, t + 0.14, 0.32, 0.1, { filter: 700 });
  }

  /** Each suspect has their own synthesised voice: pitch, timbre, rhythm and wobble. */
  public playSuspectVoice(suspectId: string) {
    const t = this.ready();
    if (t === null) return;
    const v = VOICES[suspectId] ?? fallbackVoice(suspectId);
    let at = t;
    v.syllables.forEach((syl) => {
      const dur = syl.d * v.pace;
      const f0 = v.base * syl.from;
      const f1 = v.base * syl.to;
      this.tone(v.wave, f0, f1, at, dur, v.vol, {
        vibHz: v.vibHz,
        vibDepth: v.vibDepth,
        attack: v.attack,
        filter: v.filter,
      });
      if (v.breath) this.noise(at, dur, v.breath, 3000, 0.6);
      if (v.second) this.tone(v.second.wave, f0 * v.second.ratio, f1 * v.second.ratio, at, dur, v.vol * v.second.vol, { filter: v.filter });
      at += dur + v.gap;
    });
  }
}

type Syllable = { from: number; to: number; d: number };
type Voice = {
  wave: OscillatorType;
  base: number;
  vol: number;
  pace: number;
  gap: number;
  attack: number;
  filter: number;
  vibHz?: number;
  vibDepth?: number;
  breath?: number;
  second?: { wave: OscillatorType; ratio: number; vol: number };
  syllables: Syllable[];
};

const VOICES: Record<string, Voice> = {
  // Low, pompous and slow.
  lord_alistair: { wave: 'sawtooth', base: 105, vol: 0.12, pace: 1.25, gap: 0.05, attack: 0.04, filter: 650, vibHz: 4, vibDepth: 3,
    syllables: [{ from: 1, to: 1.12, d: 0.2 }, { from: 1.12, to: 0.9, d: 0.28 }, { from: 0.95, to: 0.8, d: 0.3 }] },
  // Soft, high and fluttery.
  lady_evelyn: { wave: 'sine', base: 520, vol: 0.14, pace: 1, gap: 0.04, attack: 0.05, filter: 3000, vibHz: 6.5, vibDepth: 14,
    syllables: [{ from: 1, to: 1.2, d: 0.16 }, { from: 1.2, to: 1.05, d: 0.18 }, { from: 1.1, to: 1.3, d: 0.2 }, { from: 1.3, to: 1, d: 0.22 }] },
  // Nasal, fast, buzzy.
  dr_vance: { wave: 'square', base: 300, vol: 0.06, pace: 0.7, gap: 0.03, attack: 0.01, filter: 1800,
    syllables: [{ from: 1, to: 1.1, d: 0.1 }, { from: 1.2, to: 1.05, d: 0.1 }, { from: 1.1, to: 1.3, d: 0.1 }, { from: 1.25, to: 1, d: 0.12 }, { from: 1.05, to: 1.2, d: 0.1 }] },
  // Breathy, gliding and wide vibrato.
  madame_isolde: { wave: 'triangle', base: 400, vol: 0.14, pace: 1.2, gap: 0.02, attack: 0.07, filter: 2200, vibHz: 5, vibDepth: 28, breath: 0.05,
    syllables: [{ from: 0.9, to: 1.3, d: 0.3 }, { from: 1.3, to: 0.95, d: 0.35 }] },
  // Gruff, low barks.
  capt_sterling: { wave: 'sawtooth', base: 85, vol: 0.15, pace: 0.75, gap: 0.09, attack: 0.008, filter: 500, breath: 0.03,
    syllables: [{ from: 1.3, to: 0.8, d: 0.12 }, { from: 1.2, to: 0.75, d: 0.14 }] },
  // Bright, quick blips.
  clara_holloway: { wave: 'triangle', base: 700, vol: 0.12, pace: 0.6, gap: 0.04, attack: 0.006, filter: 4000,
    syllables: [{ from: 1, to: 1.25, d: 0.09 }, { from: 1.5, to: 1.3, d: 0.09 }, { from: 1.2, to: 1.6, d: 0.09 }, { from: 1.7, to: 1.4, d: 0.1 }] },
  // Old, wavering, tremulous.
  prof_ash: { wave: 'triangle', base: 230, vol: 0.14, pace: 1.3, gap: 0.05, attack: 0.05, filter: 1500, vibHz: 9, vibDepth: 16,
    syllables: [{ from: 1, to: 0.9, d: 0.22 }, { from: 0.95, to: 1.05, d: 0.2 }, { from: 1.05, to: 0.8, d: 0.3 }] },
  // Haughty, descending sneer.
  baroness_vane: { wave: 'sawtooth', base: 330, vol: 0.08, pace: 1.1, gap: 0.03, attack: 0.02, filter: 1400, second: { wave: 'sine', ratio: 1.5, vol: 0.6 },
    syllables: [{ from: 1.5, to: 1.25, d: 0.2 }, { from: 1.25, to: 1, d: 0.2 }, { from: 1, to: 0.7, d: 0.3 }] },
  // Monotone chant.
  father_crowe: { wave: 'sine', base: 196, vol: 0.16, pace: 1.1, gap: 0.06, attack: 0.05, filter: 1200, second: { wave: 'sine', ratio: 2, vol: 0.4 },
    syllables: [{ from: 1, to: 1, d: 0.22 }, { from: 1, to: 1, d: 0.22 }, { from: 1, to: 1, d: 0.22 }, { from: 1, to: 0.94, d: 0.3 }] },
  // Sharp, clipped staccato.
  inspector_graves: { wave: 'square', base: 160, vol: 0.07, pace: 0.55, gap: 0.12, attack: 0.004, filter: 1100,
    syllables: [{ from: 1, to: 1, d: 0.1 }, { from: 1.35, to: 1.35, d: 0.1 }, { from: 1.1, to: 1.1, d: 0.1 }] },
};

function fallbackVoice(id: string): Voice {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const waves: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth'];
  return {
    wave: waves[h % 4],
    base: 120 + (h % 400),
    vol: 0.1,
    pace: 0.8 + ((h >> 3) % 6) / 10,
    gap: 0.04,
    attack: 0.02,
    filter: 1800,
    vibHz: (h >> 5) % 2 ? 6 : undefined,
    vibDepth: 10,
    syllables: [{ from: 1, to: 1.2, d: 0.15 }, { from: 1.2, to: 0.9, d: 0.2 }, { from: 1, to: 1.1, d: 0.15 }],
  };
}

export const soundEngine = new SoundEngine();
