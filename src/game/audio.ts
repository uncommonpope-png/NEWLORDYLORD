// ─── SOULFEILD RTS :: procedural WebAudio (no assets) ───

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let droneStarted = false;
let sparkleTimer: number | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  dur = 0.12,
  type: OscillatorType = "square",
  gain = 0.08,
  slideTo?: number,
  delay = 0
) {
  const c = ensure();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  init() {
    ensure();
    this.startDrone();
  },
  setMuted(m: boolean) {
    muted = m;
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05);
  },
  isMuted: () => muted,
  startDrone() {
    const c = ensure();
    if (!c || !master || droneStarted) return;
    droneStarted = true;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 240;
    const g = c.createGain();
    g.gain.value = 0.05;
    [55, 55.7, 110.4].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = i === 2 ? "triangle" : "sawtooth";
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    });
    lp.connect(g).connect(master);
    // ambient sparkle loop
    const pent = [523.25, 622.25, 698.46, 783.99, 932.33, 1046.5];
    const sparkle = () => {
      if (!muted) tone(pent[Math.floor(Math.random() * pent.length)], 0.5, "sine", 0.018);
      sparkleTimer = window.setTimeout(sparkle, 5000 + Math.random() * 9000);
    };
    sparkleTimer = window.setTimeout(sparkle, 4000);
  },
  stopAll() {
    if (sparkleTimer) clearTimeout(sparkleTimer);
  },
  ui: () => tone(880, 0.06, "square", 0.05),
  hover: () => tone(1320, 0.035, "sine", 0.02),
  interact: () => { tone(660, 0.08, "square", 0.06); tone(990, 0.1, "square", 0.05, undefined, 0.06); },
  buy: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.14, "square", 0.07, undefined, i * 0.07));
    tone(1568, 0.3, "triangle", 0.05, undefined, 0.3);
  },
  coin: () => { tone(1174, 0.07, "square", 0.06); tone(1568, 0.12, "square", 0.06, undefined, 0.06); },
  deny: () => tone(130, 0.22, "sawtooth", 0.08, 90),
  handshake: () => { tone(698, 0.1, "sine", 0.06); tone(932, 0.14, "sine", 0.06, undefined, 0.09); },
  alarm: () => { tone(392, 0.16, "square", 0.07, 330); tone(392, 0.16, "square", 0.07, 330, 0.22); },
  audit: () => { tone(220, 0.3, "sawtooth", 0.08, 110); tone(233, 0.34, "sawtooth", 0.07, 116, 0.16); },
  step: () => tone(180, 0.03, "triangle", 0.015, 120),
  win: () => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => tone(f, 0.22, "square", 0.07, undefined, i * 0.11));
  },
  lose: () => { [330, 262, 208, 156].forEach((f, i) => tone(f, 0.34, "sawtooth", 0.07, f * 0.8, i * 0.18)); },
};
