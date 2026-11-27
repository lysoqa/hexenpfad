'use strict';
// ===== Embleme: Element- und Belohnungssymbole, Belohnungs-Altar =====
// Jedes Emblem wird um (0, 0) gezeichnet und ist etwa 2*s groß.
// Sie leben: Flammen flackern, Frost dreht sich, Blitze knistern, Schatten wirbeln.

const EMB_LINE = '#140a1e';
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeOutBack = (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

function gLin(x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function gRad(x, y, r0, r1, stops, fx, fy) {
  const g = ctx.createRadialGradient(fx ?? x, fy ?? y, Math.max(0, r0), x, y, Math.max(0.01, r1));
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
// Pfad erst dick dunkel umranden, dann füllen: ergibt einen sauberen Umriss
function inkFill(path, fill, lw) {
  path();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = EMB_LINE;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}
function drawSparkle(x, y, r, color, alpha = 1) {
  if (r <= 0) return;
  const base = ctx.globalAlpha;
  ctx.globalAlpha = base * alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.globalAlpha = base;
}
function circleHits(x1, y1, r1, x2, y2, r2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const xm = x1 + (a * (x2 - x1)) / d, ym = y1 + (a * (y2 - y1)) / d;
  return [[xm + (h * (y2 - y1)) / d, ym - (h * (x2 - x1)) / d], [xm - (h * (y2 - y1)) / d, ym + (h * (x2 - x1)) / d]];
}
// Kreisbogen von a0 nach a1, der durch den Winkel "via" läuft
function arcThrough(cx, cy, r, a0, a1, via) {
  const norm = (v) => ((v % TAU) + TAU) % TAU;
  ctx.arc(cx, cy, r, a0, a1, !(norm(via - a0) < norm(a1 - a0)));
}
function jaggedLine(x0, y0, x1, y1, n, amp, seed) {
  ctx.moveTo(x0, y0);
  const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
  for (let i = 1; i < n; i++) {
    const k = i / n, off = (hash2(seed, i) - 0.5) * 2 * amp;
    ctx.lineTo(lerp(x0, x1, k) + (nx / nl) * off, lerp(y0, y1, k) + (ny / nl) * off);
  }
  ctx.lineTo(x1, y1);
}

const EMBLEMS = {
  fire(s, t) {
    const f = (k, p = 0) => Math.sin(t * k + p);
    // Flammenzunge: Spitze oben, runder Boden
    const tongue = (cx, cy, w, h, lean, b) => () => {
      ctx.beginPath();
      ctx.moveTo((cx + lean) * s, (cy - h) * s);
      ctx.bezierCurveTo((cx + w * 0.3 + lean * 0.5) * s, (cy - h * 0.5) * s, (cx + w) * s, (cy - h * 0.15) * s, (cx + w) * s, (cy + b * 0.3) * s);
      ctx.bezierCurveTo((cx + w) * s, (cy + b) * s, (cx - w) * s, (cy + b) * s, (cx - w) * s, (cy + b * 0.3) * s);
      ctx.bezierCurveTo((cx - w) * s, (cy - h * 0.15) * s, (cx - w * 0.3 + lean * 0.5) * s, (cy - h * 0.5) * s, (cx + lean) * s, (cy - h) * s);
      ctx.closePath();
    };
    const left = tongue(-0.42, 0.36, 0.34, 0.72 + 0.1 * f(11), -0.3 + 0.06 * f(7), 0.55);
    const right = tongue(0.44, 0.42, 0.3, 0.6 + 0.1 * f(13, 1), 0.28 + 0.05 * f(6), 0.5);
    const outer = tongue(0, 0.14, 0.76, 1.08 + 0.08 * f(9), 0.13 * f(5), 0.86);
    const lw = s * 0.3;
    for (const p of [left, right, outer]) { p(); ctx.lineJoin = 'round'; ctx.strokeStyle = EMB_LINE; ctx.lineWidth = lw; ctx.stroke(); }
    const sideFill = gLin(0, -0.5 * s, 0, s, [[0, '#ff9a3a'], [1, '#8a1a0a']]);
    left(); ctx.fillStyle = sideFill; ctx.fill();
    right(); ctx.fill();
    outer(); ctx.fillStyle = gLin(0, -1.1 * s, 0, s, [[0, '#ffb347'], [0.45, '#ff6a1f'], [1, '#a8220e']]); ctx.fill();
    tongue(0, 0.26, 0.52, 0.74 + 0.1 * f(12, 2), 0.08 * f(6, 1), 0.6)();
    ctx.fillStyle = gLin(0, -0.5 * s, 0, 0.9 * s, [[0, '#ffd86a'], [1, '#ff7a1f']]);
    ctx.fill();
    tongue(0, 0.36, 0.3, 0.42 + 0.08 * f(15), 0.05 * f(8, 2), 0.46)();
    ctx.fillStyle = gLin(0, 0, 0, 0.8 * s, [[0, '#fffbe6'], [1, '#ffd04a']]);
    ctx.fill();
    // Glanzlinie
    ctx.strokeStyle = 'rgba(255,240,200,0.55)';
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(-0.52 * s, 0.5 * s);
    ctx.quadraticCurveTo(-0.62 * s, -0.1 * s, -0.18 * s, -0.62 * s);
    ctx.stroke();
    // aufsteigende Glut
    const base = ctx.globalAlpha;
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.9 + i / 3) % 1;
      ctx.globalAlpha = base * (1 - k);
      ctx.fillStyle = i % 2 ? '#ffd08a' : '#ff8a3a';
      const sz = s * 0.16 * (1 - k * 0.6);
      ctx.fillRect(Math.sin(i * 2.3 + t * 2) * 0.6 * s - sz / 2, -0.9 * s - k * 0.9 * s, sz, sz);
    }
    ctx.globalAlpha = base;
  },

  frost(s, t) {
    ctx.save();
    ctx.rotate(t * 0.35);
    const arms = (w, col) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const c = Math.cos(a), si = Math.sin(a);
        ctx.moveTo(0, 0);
        ctx.lineTo(c * 1.05 * s, si * 1.05 * s);
        for (const sg of [1, -1]) {
          const bx = c * 0.64 * s, by = si * 0.64 * s;
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a + sg * 0.8) * 0.32 * s, by + Math.sin(a + sg * 0.8) * 0.32 * s);
        }
      }
      ctx.stroke();
    };
    arms(s * 0.36, EMB_LINE);
    arms(s * 0.17, gLin(-s, -s, s, s, [[0, '#ffffff'], [1, '#8fdcff']]));
    const hex = (r) => () => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6;
        i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    };
    inkFill(hex(0.5 * s), gRad(0, 0, 0, 0.62 * s, [[0, '#ffffff'], [0.5, '#a8e8ff'], [1, '#3a8fc0']], -0.18 * s, -0.18 * s), s * 0.22);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 0.5 * s, Math.sin(a) * 0.5 * s);
    }
    ctx.stroke();
    hex(0.2 * s)();
    ctx.fillStyle = '#eefcff';
    ctx.fill();
    ctx.restore();
    const tw = (Math.sin(t * 3) + 1) / 2;
    drawSparkle(0.62 * s, -0.66 * s, s * (0.2 + 0.22 * tw), '#ffffff', 0.6 + 0.4 * tw);
    drawSparkle(-0.7 * s, 0.55 * s, s * 0.16 * (1 - tw), '#e2f8ff', 0.8);
  },

  storm(s, t) {
    const seed = Math.floor(t * 14);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // knisternde Lichtbögen
    for (let i = 0; i < 2; i++) {
      const a0 = hash2(seed, i + 3) * TAU, len = 0.7 + hash2(i + 9, seed) * 0.6;
      for (const [w, col] of [[s * 0.28, 'rgba(255,233,90,0.25)'], [s * 0.09, '#fff6b0']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        jaggedLine(Math.cos(a0) * 0.5 * s, Math.sin(a0) * 0.5 * s, Math.cos(a0 + len) * 1.15 * s, Math.sin(a0 + len) * 1.15 * s, 4, 0.18 * s, seed + i);
        ctx.stroke();
      }
    }
    const pts = [[0.28, -1.1], [-0.58, 0.12], [-0.06, 0.12], [-0.36, 1.1], [0.62, -0.24], [0.1, -0.24]];
    const bolt = () => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * s, py * s) : ctx.moveTo(px * s, py * s)));
      ctx.closePath();
    };
    inkFill(bolt, gLin(0, -1.1 * s, 0, 1.1 * s, [[0, '#ffffff'], [0.35, '#fff27a'], [0.75, '#ffc828'], [1, '#d08a10']]), s * 0.32);
    if (hash2(seed, 7) > 0.78) { bolt(); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(0.16 * s, -0.82 * s);
    ctx.lineTo(-0.36 * s, 0.04 * s);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + (i * TAU) / 3;
      fillCircle(Math.cos(a) * 1.05 * s, Math.sin(a) * 0.5 * s, s * 0.08, '#fff6b0');
    }
  },

  shadow(s, t) {
    // Wirbel
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = t * 1.3 + (i * TAU) / 3;
      ctx.strokeStyle = 'rgba(181,131,255,0.5)';
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.arc(0, 0, 1.02 * s, a, a + 1.1);
      ctx.stroke();
    }
    fillCircle(0, 0, 0.94 * s, EMB_LINE);
    fillCircle(0, 0, 0.82 * s, gRad(0, 0, 0, 0.9 * s, [[0, '#4a2a7a'], [1, '#12081e']], 0.2 * s, -0.2 * s));
    // Sichel
    const R = 0.72 * s, cx2 = 0.32 * s, cy2 = -0.24 * s, r2 = 0.6 * s;
    const [p1, p2] = circleHits(0, 0, R, cx2, cy2, r2);
    const phi = Math.atan2(cy2, cx2);
    const moon = () => {
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      arcThrough(0, 0, R, Math.atan2(p1[1], p1[0]), Math.atan2(p2[1], p2[0]), phi + Math.PI);
      arcThrough(cx2, cy2, r2, Math.atan2(p2[1] - cy2, p2[0] - cx2), Math.atan2(p1[1] - cy2, p1[0] - cx2), phi + Math.PI);
      ctx.closePath();
    };
    inkFill(moon, gLin(-0.7 * s, 0.6 * s, 0.4 * s, -0.6 * s, [[0, '#f6ecff'], [0.5, '#c89aff'], [1, '#7a4ad8']]), s * 0.14);
    const tw = (Math.sin(t * 2.5) + 1) / 2;
    drawSparkle(0.42 * s, -0.05 * s, s * (0.12 + 0.1 * tw), '#ead9ff', 0.9);
    drawSparkle(0.12 * s, -0.48 * s, s * (0.08 + 0.08 * (1 - tw)), '#ffffff', 0.8);
    strokeCircle(0, 0, 0.88 * s, 'rgba(181,131,255,0.55)', s * 0.06);
  },
};

// ---------- Belohnungen (keine Elemente) ----------
const TYPE_EMBLEMS = {
  gold(s, t) {
    const coin = (cx, cy, r, front) => {
      fillCircle(cx, cy, r + s * 0.13, EMB_LINE);
      fillCircle(cx, cy, r, gRad(cx, cy, 0, r * 1.15, [[0, '#fff6c0'], [0.45, '#ffd24a'], [1, '#b8862a']], cx - r * 0.35, cy - r * 0.35));
      strokeCircle(cx, cy, r * 0.72, 'rgba(150,100,20,0.8)', s * 0.07);
      ctx.fillStyle = '#fff1a0';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.38); ctx.lineTo(cx + r * 0.26, cy); ctx.lineTo(cx, cy + r * 0.38); ctx.lineTo(cx - r * 0.26, cy);
      ctx.fill();
      if (front) {
        const k = (t * 0.6) % 1.6;
        if (k < 1) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, TAU);
          ctx.clip();
          ctx.translate(cx + lerp(-1.3, 1.3, k) * r, cy);
          ctx.rotate(0.5);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(-r * 0.15, -r * 2, r * 0.3, r * 4);
          ctx.restore();
        }
      }
    };
    coin(-0.48 * s, 0.34 * s, 0.52 * s);
    coin(0.48 * s, 0.38 * s, 0.52 * s);
    coin(0, -0.12 * s, 0.7 * s, true);
    const tw = (Math.sin(t * 3.3) + 1) / 2;
    drawSparkle(0.62 * s, -0.72 * s, s * 0.3 * tw, '#ffffff', 0.9);
  },
  heart(s, t) {
    const beat = 1 + Math.pow(Math.max(0, Math.sin(t * 5)), 10) * 0.14;
    ctx.save();
    ctx.scale(beat, beat);
    inkFill(() => {
      ctx.beginPath();
      ctx.moveTo(0, 0.95 * s);
      ctx.bezierCurveTo(-1.25 * s, 0.05 * s, -0.75 * s, -1.05 * s, 0, -0.42 * s);
      ctx.bezierCurveTo(0.75 * s, -1.05 * s, 1.25 * s, 0.05 * s, 0, 0.95 * s);
      ctx.closePath();
    }, gRad(0, 0, 0, 1.2 * s, [[0, '#ffd0dc'], [0.35, '#ff6a86'], [1, '#a0183a']], -0.3 * s, -0.35 * s), s * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-0.45 * s, -0.34 * s, 0.2 * s, 0.1 * s, -0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  forge(s, t) {
    const pts = [[-1.05, -0.12], [0.78, -0.12], [0.78, 0.14], [0.36, 0.2], [0.24, 0.5], [0.58, 0.78], [-0.58, 0.78], [-0.24, 0.5], [-0.36, 0.2], [-0.62, 0.14]];
    inkFill(() => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * s, py * s) : ctx.moveTo(px * s, py * s)));
      ctx.closePath();
    }, gLin(0, -0.12 * s, 0, 0.8 * s, [[0, '#d8dce8'], [0.35, '#8a90a0'], [1, '#3a3e4a']]), s * 0.24);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-0.9 * s, -0.12 * s, 1.6 * s, s * 0.07);
    // Hammer schlägt
    const sw = Math.pow((Math.sin(t * 4) + 1) / 2, 3);
    ctx.save();
    ctx.translate(0.55 * s, -0.25 * s);
    ctx.rotate(-1.1 + sw * 0.8);
    inkFill(() => { ctx.beginPath(); ctx.rect(-0.08 * s, -1.05 * s, 0.16 * s, 0.95 * s); }, '#8a5a32', s * 0.16);
    inkFill(() => { ctx.beginPath(); ctx.rect(-0.38 * s, -1.25 * s, 0.76 * s, 0.34 * s); }, gLin(0, -1.25 * s, 0, -0.9 * s, [[0, '#e8ecf4'], [1, '#6a7080']]), s * 0.16);
    ctx.restore();
    if (sw > 0.85) for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (hash2(Math.floor(t * 4), i) - 0.5) * 2.2;
      fillCircle(Math.cos(a) * 0.55 * s, -0.2 * s + Math.sin(a) * 0.45 * s, s * 0.07, i % 2 ? '#ffd08a' : '#ff8a3a');
    }
  },
  star(s, t) {
    const star = (r, inner, rot) => () => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = rot + (i / 8) * TAU - Math.PI / 2, rr = i % 2 ? inner : r;
        i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
    };
    const rot = Math.sin(t * 0.8) * 0.25;
    inkFill(star(1.15 * s, 0.34 * s, rot), gRad(0, 0, 0, 1.15 * s, [[0, '#ffffff'], [0.4, '#fff6a0'], [1, '#e0a830']]), s * 0.24);
    star(0.62 * s, 0.2 * s, rot + Math.PI / 4)();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    fillCircle(0, 0, s * 0.16, '#ffffff');
    const tw = (Math.sin(t * 4) + 1) / 2;
    drawSparkle(0.8 * s, 0.7 * s, s * 0.22 * tw, '#fff6a0', 1);
  },
  spring(s, t) {
    inkFill(() => {
      ctx.beginPath();
      ctx.moveTo(0, -1.05 * s);
      ctx.bezierCurveTo(0.55 * s, -0.35 * s, 0.85 * s, 0.05 * s, 0.85 * s, 0.38 * s);
      ctx.bezierCurveTo(0.85 * s, 0.95 * s, -0.85 * s, 0.95 * s, -0.85 * s, 0.38 * s);
      ctx.bezierCurveTo(-0.85 * s, 0.05 * s, -0.55 * s, -0.35 * s, 0, -1.05 * s);
      ctx.closePath();
    }, gLin(0, -1 * s, 0, 0.9 * s, [[0, '#e6fff6'], [0.5, '#6af0c8'], [1, '#1a8a78']]), s * 0.26);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = s * 0.09;
    ctx.beginPath();
    ctx.arc(0, 0.35 * s, 0.55 * s, Math.PI * 0.75, Math.PI * 1.15);
    ctx.stroke();
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.7 + i * 0.5) % 1;
      strokeCircle((i ? 0.25 : -0.1) * s, (0.55 - k * 0.9) * s, s * 0.1, `rgba(255,255,255,${0.8 * (1 - k)})`, s * 0.05);
    }
  },
  shop(s, t) {
    inkFill(() => {
      ctx.beginPath();
      ctx.moveTo(-0.35 * s, -0.42 * s);
      ctx.bezierCurveTo(-1.05 * s, -0.15 * s, -1.05 * s, 0.88 * s, 0, 0.88 * s);
      ctx.bezierCurveTo(1.05 * s, 0.88 * s, 1.05 * s, -0.15 * s, 0.35 * s, -0.42 * s);
      ctx.closePath();
    }, gRad(0, 0.2 * s, 0, 1.1 * s, [[0, '#d8a060'], [1, '#6a4020']], -0.3 * s, 0), s * 0.24);
    for (const [cx, cy] of [[-0.22, -0.82], [0.24, -0.76]]) {
      fillCircle(cx * s, cy * s, 0.3 * s, EMB_LINE);
      fillCircle(cx * s, cy * s, 0.22 * s, '#ffd24a');
    }
    inkFill(() => { ctx.beginPath(); ctx.ellipse(0, -0.5 * s, 0.42 * s, 0.14 * s, 0, 0, TAU); }, '#c9a24a', s * 0.14);
    fillCircle(0, 0.28 * s, 0.32 * s, EMB_LINE);
    fillCircle(0, 0.28 * s, 0.24 * s, gRad(0, 0.28 * s, 0, 0.3 * s, [[0, '#fff1a0'], [1, '#d8a030']]));
    const tw = (Math.sin(t * 3) + 1) / 2;
    drawSparkle(0.62 * s, -0.5 * s, s * 0.25 * tw, '#ffffff');
  },
  boss(s, t) {
    for (const sg of [-1, 1]) {
      inkFill(() => {
        ctx.beginPath();
        ctx.moveTo(sg * 0.35 * s, -0.55 * s);
        ctx.quadraticCurveTo(sg * 1.1 * s, -0.55 * s, sg * 1.05 * s, -1.15 * s);
        ctx.quadraticCurveTo(sg * 0.8 * s, -0.75 * s, sg * 0.5 * s, -0.25 * s);
        ctx.closePath();
      }, '#e8dcc0', s * 0.2);
    }
    inkFill(() => {
      ctx.beginPath();
      ctx.arc(0, -0.15 * s, 0.75 * s, Math.PI * 0.85, Math.PI * 0.15);
      ctx.lineTo(0.42 * s, 0.85 * s);
      ctx.lineTo(-0.42 * s, 0.85 * s);
      ctx.closePath();
    }, gRad(0, 0, 0, 0.9 * s, [[0, '#a84a3a'], [1, '#4a1616']], -0.2 * s, -0.3 * s), s * 0.24);
    const pulse = 0.7 + Math.sin(t * 5) * 0.3;
    for (const sg of [-1, 1]) {
      fillCircle(sg * 0.3 * s, -0.1 * s, 0.2 * s, EMB_LINE);
      fillCircle(sg * 0.3 * s, -0.1 * s, 0.13 * s, `rgba(255,${Math.round(120 + 100 * pulse)},60,1)`);
    }
    ctx.fillStyle = '#e8dcc0';
    for (let i = -1; i <= 1; i++) ctx.fillRect(i * 0.2 * s - 0.06 * s, 0.55 * s, 0.12 * s, 0.22 * s);
  },
  start(s, t) {
    inkFill(() => {
      ctx.beginPath();
      ctx.moveTo(0, -1.1 * s); ctx.lineTo(0.75 * s, 0); ctx.lineTo(0, 1.1 * s); ctx.lineTo(-0.75 * s, 0);
      ctx.closePath();
    }, gLin(0, -s, 0, s, [[0, '#ead9ff'], [0.5, '#b583ff'], [1, '#4b2a8a']]), s * 0.24);
    ctx.save();
    ctx.scale(1, 1.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.arc(0, 0, 0.35 * s, t * 3, t * 3 + 4);
    ctx.stroke();
    ctx.restore();
  },
  heal(s, t) {
    inkFill(() => { ctx.beginPath(); ctx.rect(-0.22 * s, -1.0 * s, 0.44 * s, 0.5 * s); }, '#c8e0e8', s * 0.2);
    inkFill(() => { ctx.beginPath(); ctx.rect(-0.28 * s, -1.15 * s, 0.56 * s, 0.22 * s); }, '#8a5a32', s * 0.16);
    inkFill(() => { ctx.beginPath(); ctx.arc(0, 0.25 * s, 0.72 * s, 0, TAU); }, gRad(0, 0.25 * s, 0, 0.8 * s, [[0, '#ffb0c0'], [0.5, '#ff4a6a'], [1, '#8a1030']], -0.25 * s, 0), s * 0.22);
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.8 + i * 0.5) % 1;
      fillCircle((i ? 0.22 : -0.18) * s, (0.5 - k * 0.6) * s, s * 0.08 * (1 - k), 'rgba(255,255,255,0.85)');
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-0.32 * s, 0.02 * s, 0.14 * s, 0.08 * s, -0.7, 0, TAU);
    ctx.fill();
  },
};

function drawEmblem(el, x, y, s, o = {}) {
  if (s <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  EMBLEMS[el](s, o.t ?? game.time);
  ctx.restore();
}
function drawTypeEmblem(type, x, y, s, o = {}) {
  if (s <= 0) return;
  if (type === 'boon') return drawEmblem(o.el, x, y, s, o);
  const f = TYPE_EMBLEMS[type];
  if (!f) return;
  ctx.save();
  ctx.translate(x, y);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  f(s, o.t ?? game.time);
  ctx.restore();
}

// ---------- Farben je Belohnung ----------
const REWARD_PAL = {
  gold: { color: '#ffd24a', light: '#fff1a0', dark: '#8a6a1a' },
  heart: { color: '#ff6a86', light: '#ffd0dc', dark: '#a0183a' },
  forge: { color: '#ffb070', light: '#ffe0b0', dark: '#8a4a20' },
  star: { color: '#fff6a0', light: '#ffffff', dark: '#c09030' },
};
function rewardPal(r) { return r.type === 'boon' ? ELEMENTS[r.el] : REWARD_PAL[r.type]; }
function rewardName(r) { return r.type === 'boon' ? `${ELEMENTS[r.el].name}-Segen` : REWARDS[r.type].name; }

// ---------- Belohnungs-Altar in der Kammer ----------
function rewardFloatY(pk) { return pk.y - 21 + Math.sin(game.time * 2.2) * 2; }
function drawRewardAltar(pk) {
  const r = pk.reward, P = rewardPal(r), t = game.time;
  const k = easeOutBack(clamp(pk.t / 0.55, 0, 1));
  const x = pk.x, y = pk.y;
  // Runenkreis am Boden (flach gedrückt, wirkt wie liegend)
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.42);
  const R = 17 * k;
  fillCircle(0, 0, R * 1.25, gRad(0, 0, 0, R * 1.25, [[0, hexA(P.color, 0.4)], [1, hexA(P.color, 0)]]));
  strokeCircle(0, 0, R, hexA(P.color, 0.9), 1.1);
  ctx.save();
  ctx.rotate(t * 0.7);
  ctx.strokeStyle = hexA(P.light, 0.8);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU, l = i % 4 === 0 ? 4 : 2;
    ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.lineTo(Math.cos(a) * (R - l), Math.sin(a) * (R - l));
  }
  ctx.stroke();
  ctx.fillStyle = P.light;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4, gx = Math.cos(a) * (R - 6), gy = Math.sin(a) * (R - 6);
    ctx.beginPath();
    ctx.moveTo(gx, gy - 2); ctx.lineTo(gx + 1.5, gy); ctx.lineTo(gx, gy + 2); ctx.lineTo(gx - 1.5, gy);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.rotate(-t * 1.1);
  ctx.setLineDash([2, 2]);
  strokeCircle(0, 0, R * 0.5, hexA(P.light, 0.6), 0.8);
  ctx.setLineDash([]);
  ctx.restore();
  ctx.restore();

  const fy = rewardFloatY(pk);
  shadowEllipse(x, y, 6 * k, 2 * k, 0.3);
  const motes = (front) => {
    for (let i = 0; i < 4; i++) {
      const a = t * 1.7 + (i * TAU) / 4;
      if ((Math.sin(a) > 0) !== front) continue;
      const mx = x + Math.cos(a) * 14 * k, my = fy + Math.sin(a) * 4.5 + Math.sin(t * 3 + i) * 1.5;
      ctx.fillStyle = i % 2 ? P.light : P.color;
      ctx.fillRect(mx - 0.9, my - 0.9, 1.8, 1.8);
    }
  };
  motes(false);
  fillCircle(x, fy, 15 * k, gRad(x, fy, 0, 15 * k, [[0, hexA(P.light, 0.55)], [0.45, hexA(P.color, 0.25)], [1, hexA(P.color, 0)]]));
  drawTypeEmblem(r.type, x, fy, (r.type === 'boon' ? 8 : 7.5) * k, { el: r.el });
  motes(true);
  if (pk.t > 0.6) text(rewardName(r), x, y + 5, { size: 5, align: 'center', color: P.light, alpha: clamp((pk.t - 0.6) * 3, 0, 0.9) });
}
function drawRewardAltarLight(pk) {
  const P = rewardPal(pk.reward), t = game.time;
  const k = clamp(pk.t / 0.55, 0, 1);
  const fy = rewardFloatY(pk);
  const pulse = 0.8 + Math.sin(t * 3) * 0.2;
  glow(pk.x, fy, 44 * k, P.color, 0.55 * pulse);
  glow(pk.x, pk.y, 26 * k, P.color, 0.35);
  // Lichtsäule
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const h = 95 * k;
  ctx.fillStyle = gLin(0, pk.y - h, 0, pk.y, [[0, hexA(P.color, 0)], [1, hexA(P.color, 0.28 * pulse)]]);
  ctx.fillRect(pk.x - 6, pk.y - h, 12, h);
  ctx.fillStyle = gLin(0, pk.y - h, 0, pk.y, [[0, hexA(P.light, 0)], [1, hexA(P.light, 0.35 * pulse)]]);
  ctx.fillRect(pk.x - 1.5, pk.y - h, 3, h);
  // Lichtstrahl von oben beim Erscheinen
  if (pk.t < 0.5) {
    const a = 1 - pk.t / 0.5;
    ctx.fillStyle = gLin(0, game.cam.y, 0, pk.y, [[0, hexA(P.light, 0)], [1, hexA(P.light, 0.8 * a)]]);
    ctx.fillRect(pk.x - 9 * a, game.cam.y, 18 * a, pk.y - game.cam.y);
  }
  ctx.restore();
}
// Teilchen, die vom Altar aufsteigen (je nach Element anders)
function emitRewardParticle(pk) {
  const r = pk.reward, P = rewardPal(r), fy = rewardFloatY(pk);
  const kind = r.type === 'boon' ? r.el : r.type;
  if (kind === 'fire') FX.burst(pk.x + rand(-5, 5), fy + rand(-2, 4), pick(['#ff8a3a', '#ffd08a', '#ff5a1a']), 1, 10, 1.0, 2, { up: 32, drag: 0.6, glow: 5 });
  else if (kind === 'frost') FX.burst(pk.x + rand(-16, 16), fy - rand(8, 16), pick(['#ffffff', '#bff0ff']), 1, 6, 1.4, 1.5, { grav: 12, drag: 1, glow: 4 });
  else if (kind === 'storm') {
    FX.burst(pk.x + rand(-4, 4), fy + rand(-4, 4), pick(['#fff6a0', '#ffffff']), 1, 70, 0.25, 1.5, { drag: 4, glow: 4 });
    if (chance(0.08)) FX.bolt(pk.x, fy, pk.x + rand(-14, 14), pk.y + rand(-2, 2), '#fff27a');
  } else if (kind === 'shadow') {
    const a = rand(0, TAU), d = rand(14, 20);
    FX.parts.push({ x: pk.x + Math.cos(a) * d, y: fy + Math.sin(a) * d * 0.6, vx: -Math.cos(a) * d * 1.6, vy: -Math.sin(a) * d, life: 0.6, max: 0.6, color: pick(['#b583ff', '#ead9ff', '#7a4ad8']), size: 1.6, grav: 0, drag: 0.5, glow: 4 });
  } else if (kind === 'forge') FX.burst(pk.x + rand(-3, 3), fy + 2, pick(['#ffd08a', '#ff8a3a']), 1, 50, 0.6, 1.5, { up: 50, grav: 160, drag: 0.5, glow: 4 });
  else FX.burst(pk.x + rand(-12, 12), fy + rand(-10, 8), pick([P.light, P.color, '#ffffff']), 1, 4, 0.8, 1.5, { up: 6, drag: 1, glow: 4 });
}
function collectRewardFX(pk) {
  const P = rewardPal(pk.reward), fy = rewardFloatY(pk);
  FX.ring(pk.x, fy, 4, 64, P.color, 0.55, 3);
  FX.ring(pk.x, fy, 2, 34, '#ffffff', 0.35, 2);
  FX.ring(pk.x, pk.y, 6, 40, P.light, 0.45, 1.5);
  FX.burst(pk.x, fy, P.color, 26, 140, 0.8, 2.5, { glow: 7 });
  FX.burst(pk.x, fy, P.light, 14, 90, 0.9, 2, { glow: 6, up: 20 });
  game.flash = { color: P.color, t: 0, dur: 0.4 };
  shake(2);
  Sound.play('magic');
}
