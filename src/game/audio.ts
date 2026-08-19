/**
 * SOULFEILD :: WEB AUDIO SYNTH
 * Zero-asset procedural sound: drones, blips, lasers, booms, horns.
 */
class SoulAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private last: Record<string, number> = {};

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startDrone();
    } catch { /* audio unavailable */ }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  private throttle(key: string, ms: number): boolean {
    const now = performance.now();
    if (this.last[key] && now - this.last[key] < ms) return true;
    this.last[key] = now;
    return false;
  }

  private tone(
    type: OscillatorType, f0: number, f1: number, dur: number,
    vol = 0.2, delay = 0, curve: "exp" | "lin" = "exp",
  ) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t);
    if (curve === "exp") osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    else osc.frequency.linearRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 0.2, freq = 800, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.2), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  private startDrone() {
    if (!this.ctx || !this.master) return;
    const mk = (f: number, v: number) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.value = v;
      osc.connect(g).connect(this.master!);
      osc.start();
    };
    mk(55, 0.045);
    mk(82.5, 0.03);
    mk(110.7, 0.016);
    // slow LFO shimmer
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain);
    lfo.start();
  }

  // ── UI ─────────────────────────────────────────────
  blip() { this.tone("square", 760, 980, 0.06, 0.1); }
  error() { this.tone("sawtooth", 160, 110, 0.16, 0.14); }
  interact() { this.tone("triangle", 520, 780, 0.09, 0.14); this.tone("triangle", 780, 1040, 0.08, 0.1, 0.06); }
  purchase() {
    [440, 554, 659, 880].forEach((f, i) => this.tone("triangle", f, f * 1.01, 0.14, 0.14, i * 0.07));
  }
  coin() { this.tone("square", 1180, 1560, 0.07, 0.09); this.tone("square", 1560, 2100, 0.09, 0.07, 0.05); }
  handshake() { this.tone("sine", 392, 392, 0.1, 0.12); this.tone("sine", 587, 587, 0.14, 0.12, 0.1); }

  // ── COMBAT ─────────────────────────────────────────
  select() { if (this.throttle("sel", 60)) return; this.tone("square", 620, 720, 0.045, 0.08); }
  order() { this.tone("square", 480, 640, 0.06, 0.1); this.tone("square", 640, 840, 0.06, 0.08, 0.05); }
  hit() { if (this.throttle("hit", 70)) return; this.tone("square", 220, 90, 0.06, 0.1); this.noise(0.05, 0.06, 2200); }
  laser() { if (this.throttle("laser", 90)) return; this.tone("sawtooth", 1300, 220, 0.11, 0.09); }
  death() { if (this.throttle("death", 90)) return; this.tone("square", 300, 55, 0.2, 0.12); }
  boom() { this.noise(0.42, 0.3, 900); this.tone("sine", 130, 28, 0.4, 0.26); }
  bigBoom() { this.noise(0.7, 0.34, 1200); this.tone("sine", 110, 24, 0.65, 0.3); this.tone("sawtooth", 400, 40, 0.5, 0.12, 0.05); }
  horn() { this.tone("sawtooth", 196, 190, 0.26, 0.16); this.tone("sawtooth", 147, 140, 0.34, 0.16, 0.24); }
  prod() { [330, 415, 494].forEach((f, i) => this.tone("triangle", f, f, 0.1, 0.12, i * 0.06)); }
  build() { [262, 330, 392, 523].forEach((f, i) => this.tone("triangle", f, f * 1.02, 0.12, 0.13, i * 0.05)); this.noise(0.1, 0.08, 3000, 0.2); }
  shield() { this.tone("sine", 300, 900, 0.3, 0.14, 0, "lin"); this.tone("sine", 900, 300, 0.3, 0.1, 0.3, "lin"); }
  slash() { this.noise(0.16, 0.2, 5000); this.tone("sawtooth", 900, 300, 0.14, 0.12); }
  cannonIn() { this.tone("sine", 1600, 300, 0.5, 0.14, 0, "lin"); }
}

export const sfx = new SoulAudio();
