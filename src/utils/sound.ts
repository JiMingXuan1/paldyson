// Procedural WebAudio sound effects + ambient pad. No audio assets needed.

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture at least once. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startPad();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "sine",
    vol = 0.3,
    slideTo?: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol = 0.2, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  private startPad(): void {
    if (!this.ctx || !this.master) return;
    const master = this.master;
    const notes = [110, 164.81, 220, 329.63];
    notes.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.value = 0.028;
      const lfo = this.ctx!.createOscillator();
      const lfoG = this.ctx!.createGain();
      lfo.frequency.value = 0.05 + i * 0.03;
      lfoG.gain.value = 0.012;
      lfo.connect(lfoG).connect(g.gain);
      osc.connect(g).connect(master);
      osc.start();
      lfo.start();
    });
  }

  click(): void { this.tone(880, 0.06, "square", 0.08); }
  build(): void { this.tone(220, 0.12, "square", 0.15, 330); this.noise(0.08, 0.1); }
  error(): void { this.tone(160, 0.15, "sawtooth", 0.12, 110); }
  gather(): void { this.noise(0.05, 0.06); this.tone(500 + Math.random() * 200, 0.05, "triangle", 0.06); }
  capture(): void { this.tone(523, 0.1, "sine", 0.2); this.tone(659, 0.12, "sine", 0.2, undefined, 0.09); this.tone(784, 0.2, "sine", 0.22, undefined, 0.18); }
  captureFail(): void { this.tone(300, 0.25, "sawtooth", 0.15, 150); }
  research(): void { this.tone(440, 0.12, "triangle", 0.18, 660); this.tone(660, 0.2, "triangle", 0.15, 880, 0.12); }
  feed(): void { this.tone(700, 0.08, "sine", 0.12, 900); }
  deconstruct(): void { this.noise(0.15, 0.15); this.tone(200, 0.1, "sawtooth", 0.1, 100); }
  insert(): void { this.tone(600, 0.05, "triangle", 0.1, 700); }
  victory(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.2, undefined, i * 0.15));
    this.noise(0.6, 0.08, 0.6);
  }
  tick(): void { this.tone(1200, 0.03, "square", 0.04); }
}

export const Sfx = new SoundManager();
