import type { PlayerSettings } from '../types/game.ts';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientTimer: number | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private isPlayingMusic = false;
  private stepIdx = 0;

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
    const mVol = this.settings.muted ? 0 : this.settings.musicVolume * 0.28;
    const sVol = this.settings.muted ? 0 : this.settings.sfxVolume * 0.45;
    this.musicGain.gain.setTargetAtTime(mVol, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(sVol, now, 0.05);
  }

  public unlockAndStartMusic() {
    const ctx = this.ensureContext();
    if (!ctx || this.isPlayingMusic) return;
    this.isPlayingMusic = true;

    // Warm dark ambient pad drone (D minor haunted manor chord)
    if (this.musicGain) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340;
      filter.connect(this.musicGain);

      const padGain = ctx.createGain();
      padGain.gain.value = 0.22;
      padGain.connect(filter);

      this.droneOsc1 = ctx.createOscillator();
      this.droneOsc1.type = 'sine';
      this.droneOsc1.frequency.value = 73.42; // D2
      this.droneOsc1.connect(padGain);
      this.droneOsc1.start();

      this.droneOsc2 = ctx.createOscillator();
      this.droneOsc2.type = 'triangle';
      this.droneOsc2.frequency.value = 110.0; // A2
      const subGain = ctx.createGain();
      subGain.gain.value = 0.08;
      this.droneOsc2.connect(subGain);
      subGain.connect(filter);
      this.droneOsc2.start();
    }

    // Haunting Victorian music-box celesta motif (D minor harmonic)
    const motif = [293.66, 349.23, 440.0, 415.3, 349.23, 329.63, 293.66, 220.0, 261.63, 329.63, 440.0, 523.25];
    const playNote = () => {
      if (!this.isPlayingMusic || !this.ctx || !this.musicGain) return;
      if (this.ctx.state === 'running' && !this.settings.muted && this.settings.musicVolume > 0.01) {
        const now = this.ctx.currentTime;
        const freq = motif[this.stepIdx % motif.length];
        this.stepIdx++;

        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        env.gain.setValueAtTime(0.0001, now);
        env.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);

        osc.connect(env);
        env.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 1.9);
      }
      this.ambientTimer = window.setTimeout(playNote, 920 + (this.stepIdx % 3 === 0 ? 460 : 0));
    };

    playNote();
  }

  public stopMusic() {
    this.isPlayingMusic = false;
    if (this.ambientTimer !== null) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
    try {
      this.droneOsc1?.stop();
      this.droneOsc2?.stop();
    } catch {
      // ignore
    }
    this.droneOsc1 = null;
    this.droneOsc2 = null;
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
