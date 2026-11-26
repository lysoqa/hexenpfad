'use strict';
// ===== Grundlagen: Bildschirm, Eingabe, Text, Licht, Hilfsfunktionen =====
// Die Spielwelt ist 480x270 Spielpixel groß. Gezeichnet wird aber in voller Bildschirmauflösung,
// dadurch bewegt sich alles butterweich, während die Pixel-Grafiken scharf bleiben.
const VIEW_W = 480;
const VIEW_H = 270;
const TILE = 16;
const TAU = Math.PI * 2;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let S = 1; // echte Bildschirmpixel pro Spielpixel

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  let s = Math.min((innerWidth * dpr) / VIEW_W, (innerHeight * dpr) / VIEW_H);
  const f = Math.floor(s);
  if (f >= 2 && f / s > 0.85) s = f; // ganzzahlig, wenn es kaum Platz kostet (gleichmäßige Pixel)
  S = Math.max(0.5, s);
  canvas.width = Math.round(VIEW_W * S);
  canvas.height = Math.round(VIEW_H * S);
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
}
addEventListener('resize', fitCanvas);
fitCanvas();

// ---------- Mathe ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const chance = (p) => Math.random() < p;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
// weiches Annähern, unabhängig von der Bildrate
const damp = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function weightedPick(items, wf) {
  const total = items.reduce((s, it) => s + wf(it), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= wf(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
// fester Zufall pro Kachel (für Bodenmuster)
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- Eingabe ----------
const Input = {
  keys: new Set(),
  pressed: new Set(),
  mx: VIEW_W / 2,
  my: VIEW_H / 2,
  down: [false, false, false],
  clicked: [false, false, false],
  any: false,

  isDown(code) { return this.keys.has(code); },
  hit(code) { return this.pressed.has(code); },
  endFrame() {
    this.pressed.clear();
    this.clicked = [false, false, false];
    this.any = false;
  },
  init() {
    addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.any = true;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mx = ((e.clientX - r.left) / r.width) * VIEW_W;
      this.my = ((e.clientY - r.top) / r.height) * VIEW_H;
    });
    addEventListener('mousedown', (e) => {
      if (e.button < 3) { this.down[e.button] = true; this.clicked[e.button] = true; }
      this.any = true;
    });
    addEventListener('mouseup', (e) => { if (e.button < 3) this.down[e.button] = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('blur', () => {
      this.keys.clear();
      this.down = [false, false, false];
    });
  },
};
Input.init();

// ---------- Text (scharf, mit normaler Schrift) ----------
const FONT_TITLE = 'Georgia, "Palatino Linotype", "Book Antiqua", serif';
const FONT_BODY = '"Segoe UI", "Trebuchet MS", Tahoma, sans-serif';
function setFont(size, o = {}) {
  ctx.font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${size}px ${o.title ? FONT_TITLE : FONT_BODY}`;
}
function text(str, x, y, o = {}) {
  const size = o.size || 7;
  setFont(size, o);
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'top';
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(8,4,14,0.9)';
    ctx.fillText(str, x + size * 0.07, y + size * 0.09);
  }
  ctx.fillStyle = o.color || '#efe6d8';
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}
function textWidth(str, size, o = {}) {
  setFont(size, o);
  return ctx.measureText(str).width;
}
function wrapText(str, maxW, size, o = {}) {
  setFont(size, o);
  const lines = [];
  let line = '';
  for (const word of String(str).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// ---------- Licht ----------
const glowCache = {};
function glowSprite(color) {
  if (glowCache[color]) return glowCache[color];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowCache[color] = c;
  return c;
}
function glow(x, y, r, color, alpha = 0.5) {
  if (r <= 0 || alpha <= 0) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- kleine Zeichenhilfen ----------
function fillCircle(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
  ctx.fill();
}
function strokeCircle(x, y, r, color, w = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
  ctx.stroke();
}
function shadowEllipse(x, y, rx, ry, a = 0.35) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
