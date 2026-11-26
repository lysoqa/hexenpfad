'use strict';
// ===== Effekte: Partikel, Hiebe, Ringe, Blitze, Nachbilder, Schadenszahlen =====
const FX = {
  parts: [], texts: [], slashes: [], rings: [], bolts: [], ghosts: [],

  reset() {
    this.parts = []; this.texts = []; this.slashes = []; this.rings = []; this.bolts = []; this.ghosts = [];
  },
  burst(x, y, color, n = 8, sp = 60, life = 0.4, size = 2, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.ang !== undefined ? o.ang + rand(-(o.spread || 0.5), o.spread || 0.5) : rand(0, TAU);
      const s = rand(sp * 0.3, sp);
      this.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0),
        life: rand(life * 0.6, life), max: life, color, size: o.sizeR ? rand(size * 0.5, size) : size,
        grav: o.grav || 0, drag: o.drag ?? 3, glow: o.glow || 0,
      });
    }
  },
  text(x, y, str, color = '#fff', size = 7) {
    this.texts.push({ x: x + rand(-3, 3), y, str: String(str), color, size, t: 0, life: 0.75, vy: -28 });
  },
  slash(x, y, ang, r, arc, color, dur = 0.16, inner = 0.55) {
    this.slashes.push({ kind: 'arc', x, y, ang, r, arc, color, t: 0, dur, inner });
  },
  thrust(x, y, ang, len, width, color, dur = 0.14) {
    this.slashes.push({ kind: 'thrust', x, y, ang, r: len, width, color, t: 0, dur });
  },
  ring(x, y, r0, r1, color, dur = 0.3, width = 2) {
    this.rings.push({ x, y, r0, r1, color, t: 0, dur, width });
  },
  bolt(x1, y1, x2, y2, color = '#fff6a0') {
    const pts = [[x1, y1]];
    const n = Math.max(3, Math.round(dist(x1, y1, x2, y2) / 10));
    const nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < n; i++) {
      const k = i / n, off = rand(-6, 6);
      pts.push([lerp(x1, x2, k) + (nx / nl) * off, lerp(y1, y2, k) + (ny / nl) * off]);
    }
    pts.push([x2, y2]);
    this.bolts.push({ pts, color, t: 0, dur: 0.18 });
  },
  ghost(img, x, y, w, h, color) {
    this.ghosts.push({ img, x, y, w, h, t: 0, life: 0.25, color });
  },

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vx *= Math.exp(-p.drag * dt);
      p.vy = p.vy * Math.exp(-p.drag * dt) + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= Math.exp(-4 * dt); }
    this.texts = this.texts.filter((t) => t.t < t.life);
    for (const list of [this.slashes, this.rings, this.bolts]) for (const s of list) s.t += dt;
    this.slashes = this.slashes.filter((s) => s.t < s.dur);
    this.rings = this.rings.filter((s) => s.t < s.dur);
    this.bolts = this.bolts.filter((s) => s.t < s.dur);
    for (const g of this.ghosts) g.t += dt;
    this.ghosts = this.ghosts.filter((g) => g.t < g.life);
  },

  drawGhosts() {
    for (const g of this.ghosts) {
      ctx.globalAlpha = 0.45 * (1 - g.t / g.life);
      ctx.drawImage(g.img, snap(g.x - g.w / 2), snap(g.y - g.h), g.w, g.h);
    }
    ctx.globalAlpha = 1;
  },

  draw() {
    for (const s of this.slashes) {
      const k = s.t / s.dur;
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = s.color;
      if (s.kind === 'arc') {
        const sweep = Math.min(1, k / 0.3);
        const a0 = s.ang - s.arc / 2;
        const a1 = a0 + s.arc * sweep;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, a0, a1);
        ctx.arc(s.x, s.y, s.r * s.inner, a1, a0, true);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, a0, a1);
        ctx.stroke();
      } else {
        const len = s.r * Math.min(1, k / 0.25 + 0.3);
        const c = Math.cos(s.ang), si = Math.sin(s.ang);
        const w = s.width / 2 * (1 - k * 0.5);
        ctx.beginPath();
        ctx.moveTo(s.x - si * w, s.y + c * w);
        ctx.lineTo(s.x + c * len, s.y + si * len);
        ctx.lineTo(s.x + si * w, s.y - c * w);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const k = r.t / r.dur;
      ctx.globalAlpha = 1 - k;
      strokeCircle(r.x, r.y, lerp(r.r0, r.r1, 1 - (1 - k) * (1 - k)), r.color, r.width * (1 - k * 0.5));
    }
    ctx.globalAlpha = 1;
    for (const b of this.bolts) {
      const k = b.t / b.dur;
      ctx.globalAlpha = 1 - k;
      for (const [w, col] of [[3, b.color], [1, '#ffffff']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    for (const p of this.parts) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillStyle = p.color;
      const sz = p.size * (0.4 + 0.6 * p.life / p.max);
      ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  },
  drawLights() {
    for (const p of this.parts) if (p.glow) glow(p.x, p.y, p.glow, p.color, 0.35 * p.life / p.max);
    for (const b of this.bolts) {
      const [x, y] = b.pts[b.pts.length - 1];
      glow(x, y, 22, b.color, 0.6 * (1 - b.t / b.dur));
    }
  },
  drawTexts() {
    for (const t of this.texts) {
      const k = t.t / t.life;
      const pop = k < 0.15 ? 1 + (0.15 - k) * 3 : 1;
      text(t.str, t.x, t.y, { size: t.size * pop, color: t.color, align: 'center', bold: true, alpha: 1 - Math.max(0, k - 0.6) / 0.4 });
    }
  },
};
