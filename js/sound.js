'use strict';
// ===== Töne und Musik, komplett im Code erzeugt (keine Sounddateien) =====
const Sound = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  muted: localStorage.getItem('hexenpfad-muted') === '1',
  musicOn: localStorage.getItem('hexenpfad-music') !== '0',
  last: {},
  noiseBuf: null,
  track: null,
  want: null,
  nextNote: 0,
  step: 0,

  // Der Browser erlaubt Ton erst nach einem Klick oder Tastendruck
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.55;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.2 : 0;
    this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, len);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    setInterval(() => this.schedule(), 50);
    if (this.want) { const w = this.want; this.want = null; this.music(w); }
  },
  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('hexenpfad-muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
  },
  toggleMusic() {
    this.musicOn = !this.musicOn;
    localStorage.setItem('hexenpfad-music', this.musicOn ? '1' : '0');
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.2 : 0, this.ctx.currentTime, 0.05);
  },

  tone(f, { f2 = null, dur = 0.1, type = 'square', vol = 0.2, at = 0, bus = null } = {}) {
    const c = this.ctx;
    const t = c.currentTime + Math.max(0, at);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.03);
  },
  noise({ dur = 0.1, vol = 0.2, freq = 2000, f2 = null, type = 'lowpass', at = 0, bus = null } = {}) {
    const c = this.ctx;
    const t = c.currentTime + Math.max(0, at);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(freq, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl);
    fl.connect(g);
    g.connect(bus || this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  },
  play(name) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 40) return; // gleiche Töne nicht stapeln
    this.last[name] = now;
    const f = SFX[name];
    if (f) f(this);
  },

  // ---------- Musik ----------
  music(name) {
    if (!this.ctx) { this.want = name; return; }
    if (this.track === name) return;
    this.track = name;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.15;
  },
  schedule() {
    if (!this.ctx || !this.track) return;
    const tr = TRACKS[this.track];
    if (!tr) return;
    const stepDur = 60 / tr.bpm / 2;
    if (this.nextNote < this.ctx.currentTime - 0.2) this.nextNote = this.ctx.currentTime + 0.05;
    while (this.nextNote < this.ctx.currentTime + 0.25) {
      this.playStep(tr, this.step, this.nextNote - this.ctx.currentTime, stepDur);
      this.nextNote += stepDur;
      this.step++;
    }
  },
  playStep(tr, step, at, sd) {
    const bus = this.musicBus;
    const bar = Math.floor(step / 8) % tr.chords.length;
    const s = step % 8;
    const chord = tr.chords[bar];
    if (tr.pad && s === 0) chord.forEach((n) => this.tone(mtof(n), { type: 'sine', dur: sd * 8, vol: 0.06, at, bus }));
    if (tr.bass[s]) this.tone(mtof(chord[0] - 12), { type: 'triangle', dur: sd * 0.9, vol: 0.4, at, bus });
    const arpNote = chord[tr.arp[s] % 3] + (tr.arp[s] >= 3 ? 12 : 0) + 12;
    if (tr.arp[s] >= 0) this.tone(mtof(arpNote), { type: tr.lead, dur: sd * 0.85, vol: tr.leadVol, at, bus });
    if (tr.melody) {
      const m = tr.melody[(step % (tr.melody.length))];
      if (m) this.tone(mtof(m), { type: 'triangle', dur: sd * 1.8, vol: 0.12, at, bus });
    }
    if (tr.drums) {
      if (s === 0 || s === 4 || (tr.heavy && s === 6)) this.tone(150, { f2: 40, type: 'sine', dur: 0.16, vol: 0.55, at, bus });
      if (s === 2 || s === 6) this.noise({ dur: 0.1, vol: 0.18, freq: 1500, type: 'highpass', at, bus });
      this.noise({ dur: 0.03, vol: 0.05, freq: 7000, type: 'highpass', at, bus });
    }
  },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Akkorde als MIDI-Noten. arp: Index im Akkord (3+ = eine Oktave höher, -1 = Pause)
const TRACKS = {
  hub: {
    bpm: 72, lead: 'triangle', leadVol: 0.06, pad: true, drums: false,
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    bass: [1, 0, 0, 0, 1, 0, 0, 0],
    arp: [0, 1, 2, 4, 3, 2, 1, -1],
  },
  run: {
    bpm: 116, lead: 'square', leadVol: 0.045, pad: false, drums: true,
    chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
    bass: [1, 0, 1, 0, 1, 0, 1, 1],
    arp: [0, 1, 2, 1, 3, 2, 1, 2],
    melody: [74, 0, 0, 0, 72, 0, 69, 0, 70, 0, 0, 0, 69, 0, 65, 0, 67, 0, 0, 0, 69, 0, 72, 0, 73, 0, 0, 0, 0, 0, 0, 0],
  },
  boss: {
    bpm: 138, lead: 'sawtooth', leadVol: 0.035, pad: false, drums: true, heavy: true,
    chords: [[45, 48, 52], [46, 49, 53], [43, 47, 50], [44, 48, 51]],
    bass: [1, 1, 0, 1, 1, 0, 1, 0],
    arp: [0, 2, 1, 3, 0, 2, 4, 3],
    melody: [69, 0, 72, 0, 76, 0, 75, 0, 70, 0, 73, 0, 77, 0, 76, 0, 67, 0, 71, 0, 74, 0, 72, 0, 68, 0, 71, 0, 75, 0, 80, 0],
  },
};

const SFX = {
  swing: (s) => s.noise({ dur: 0.09, vol: 0.2, freq: 3000, f2: 700, type: 'bandpass' }),
  heavy: (s) => { s.noise({ dur: 0.16, vol: 0.25, freq: 1800, f2: 300, type: 'bandpass' }); s.tone(140, { f2: 60, dur: 0.12, type: 'triangle', vol: 0.2 }); },
  thrust: (s) => s.noise({ dur: 0.08, vol: 0.18, freq: 1200, f2: 4000, type: 'bandpass' }),
  hit: (s) => { s.noise({ dur: 0.06, vol: 0.22, freq: 1400 }); s.tone(190, { f2: 80, dur: 0.07, type: 'square', vol: 0.1 }); },
  crit: (s) => { s.tone(900, { f2: 1800, dur: 0.08, type: 'square', vol: 0.1 }); s.noise({ dur: 0.08, vol: 0.2, freq: 3000 }); },
  armor: (s) => s.tone(700, { f2: 500, dur: 0.06, type: 'square', vol: 0.08 }),
  bow: (s) => { s.tone(500, { f2: 180, dur: 0.1, type: 'triangle', vol: 0.18 }); s.noise({ dur: 0.05, vol: 0.1, freq: 4000, type: 'highpass' }); },
  magic: (s) => s.tone(520, { f2: 1100, dur: 0.12, type: 'sine', vol: 0.16 }),
  charge: (s) => s.tone(300, { f2: 900, dur: 0.35, type: 'sine', vol: 0.08 }),
  boom: (s) => { s.noise({ dur: 0.35, vol: 0.32, freq: 900, f2: 90 }); s.tone(120, { f2: 40, dur: 0.3, type: 'sine', vol: 0.32 }); },
  dash: (s) => s.noise({ dur: 0.13, vol: 0.16, freq: 700, f2: 3200, type: 'bandpass' }),
  hurt: (s) => { s.tone(320, { f2: 90, dur: 0.22, type: 'sawtooth', vol: 0.2 }); s.noise({ dur: 0.12, vol: 0.2, freq: 900 }); },
  eshoot: (s) => s.tone(420, { f2: 220, dur: 0.1, type: 'square', vol: 0.06 }),
  zap: (s) => { s.noise({ dur: 0.12, vol: 0.14, freq: 5000, type: 'highpass' }); s.tone(1400, { f2: 220, dur: 0.1, type: 'sawtooth', vol: 0.05 }); },
  freeze: (s) => { s.tone(1700, { f2: 2700, dur: 0.15, type: 'sine', vol: 0.1 }); s.tone(2400, { dur: 0.1, type: 'triangle', vol: 0.05, at: 0.05 }); },
  burn: (s) => s.noise({ dur: 0.18, vol: 0.08, freq: 700 }),
  mark: (s) => s.tone(300, { f2: 150, dur: 0.15, type: 'triangle', vol: 0.1 }),
  coin: (s) => { s.tone(988, { dur: 0.06, type: 'square', vol: 0.06 }); s.tone(1319, { dur: 0.1, type: 'square', vol: 0.06, at: 0.05 }); },
  pickup: (s) => [523, 659, 784, 1047].forEach((f, i) => s.tone(f, { dur: 0.14, type: 'triangle', vol: 0.13, at: i * 0.06 })),
  heal: (s) => [392, 523, 659].forEach((f, i) => s.tone(f, { dur: 0.2, type: 'sine', vol: 0.13, at: i * 0.07 })),
  door: (s) => { s.tone(180, { f2: 420, dur: 0.5, type: 'triangle', vol: 0.15 }); s.noise({ dur: 0.4, vol: 0.06, freq: 600 }); },
  clear: (s) => [392, 494, 587, 784].forEach((f, i) => s.tone(f, { dur: 0.22, type: 'triangle', vol: 0.13, at: i * 0.08 })),
  select: (s) => s.tone(660, { dur: 0.05, type: 'square', vol: 0.06 }),
  choose: (s) => [659, 880, 1175].forEach((f, i) => s.tone(f, { dur: 0.16, type: 'triangle', vol: 0.12, at: i * 0.05 })),
  spawn: (s) => s.tone(250, { f2: 520, dur: 0.25, type: 'sine', vol: 0.05 }),
  edie: (s) => s.noise({ dur: 0.15, vol: 0.12, freq: 800, f2: 200 }),
  slam: (s) => { s.tone(90, { f2: 35, dur: 0.4, type: 'sine', vol: 0.4 }); s.noise({ dur: 0.3, vol: 0.25, freq: 500 }); },
  roar: (s) => { s.noise({ dur: 1.1, vol: 0.35, freq: 450, f2: 110 }); s.tone(95, { f2: 48, dur: 1.1, type: 'sawtooth', vol: 0.18 }); },
  die: (s) => [440, 349, 262, 196].forEach((f, i) => s.tone(f, { dur: 0.35, type: 'triangle', vol: 0.16, at: i * 0.16 })),
  win: (s) => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => s.tone(f, { dur: 0.3, type: 'triangle', vol: 0.14, at: i * 0.11 })),
  spike: (s) => s.noise({ dur: 0.08, vol: 0.1, freq: 3000, type: 'highpass' }),
};
