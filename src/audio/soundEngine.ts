import type { PlayerSettings } from '../types/game.ts';

export type MusicScene = 'lobby' | 'easy' | 'medium' | 'hard';

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
const SCENE_STYLES: Record<MusicScene, SceneStyle> = {
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
  private fileChecks: Partial<Record<MusicScene, boolean>> = {};

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
  private async hasTrackFile(scene: MusicScene): Promise<boolean> {
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

  private buildGeneratedScene(scene: MusicScene): MusicHandle | null {
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
}

export const soundEngine = new SoundEngine();
