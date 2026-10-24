// Synthesised sound effects (no audio files). M toggles mute.
CS.Sfx = {
  ctx: null,
  master: null,
  noiseBuf: null,
  muted: false,
  lastCoin: 0,

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  toggleMute() { this.muted = !this.muted; },

  tone(f0, f1, dur, type = 'square', vol = 0.1) {
    const c = this.ctx;
    if (!c || this.muted) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  noise(dur, vol, freq = 1500) {
    const c = this.ctx;
    if (!c || this.muted) return;
    const t = c.currentTime, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    fl.type = 'lowpass';
    fl.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur);
  },

  shot(weaponId, loud) {
    const v = loud ? 1 : 0.25;
    if (weaponId === 'shotgun') this.noise(0.28, 0.55 * v, 900);
    else if (weaponId === 'sniper') { this.noise(0.4, 0.6 * v, 2600); this.tone(260, 50, 0.25, 'sawtooth', 0.08 * v); }
    else this.noise(0.08, 0.32 * v, weaponId === 'smg' ? 2400 : 1700);
  },
  hit() { this.tone(220, 120, 0.06, 'square', 0.05); },
  headshot() { this.tone(1400, 1800, 0.08, 'triangle', 0.12); },
  hurt() { this.tone(160, 70, 0.15, 'sawtooth', 0.09); },
  swing() { this.noise(0.1, 0.15, 4000); },
  explosion() { this.noise(0.7, 0.8, 500); this.tone(90, 30, 0.5, 'sine', 0.3); },
  coin() {
    const now = performance.now();
    if (now - this.lastCoin < 45) return;
    this.lastCoin = now;
    this.tone(1300, 1900, 0.07, 'square', 0.04);
  },
  buy() { this.tone(600, 1200, 0.12, 'triangle', 0.12); },
};
