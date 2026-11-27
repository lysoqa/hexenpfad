'use strict';
// ===== Räume: Zufallserzeugung, Kollision, Zeichnen =====
const T_FLOOR = 0, T_WALL = 1, T_PILLAR = 2, T_SPIKE = 3;

const THEMES = {
  hub: {
    floor: ['#3b3046', '#41354d', '#372c42'], grout: '#2a2134', top: '#120c18',
    face: ['#4c3b5e', '#58456c'], faceDark: '#2b2038', moss: null, bg: '#0b0710', torch: '#ffb35c',
  },
  ruins: {
    floor: ['#2e3934', '#33403a', '#2a342f'], grout: '#202a25', top: '#0d1311',
    face: ['#46544b', '#52614f'], faceDark: '#26302a', moss: '#3e5e3a', bg: '#070b09', torch: '#9fe8ff',
  },
  boss: {
    floor: ['#3a2723', '#402b26', '#352320'], grout: '#271916', top: '#130a08',
    face: ['#5a3a30', '#6a4436'], faceDark: '#2f1d18', moss: null, bg: '#0c0605', torch: '#ff8a3a',
  },
};

function makeRoom(w, h, theme) {
  return {
    w, h, pw: w * TILE, ph: h * TILE, theme, kind: '',
    tiles: new Uint8Array(w * h).fill(T_WALL),
    doors: [], spikes: [], pillars: [], pillarSpots: [], torches: [], cache: null,
    entry: { x: 0, y: 0 },
  };
}
const tileAt = (room, tx, ty) => (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h ? T_WALL : room.tiles[ty * room.w + tx]);
function setTile(room, tx, ty, v) { if (tx >= 0 && ty >= 0 && tx < room.w && ty < room.h) room.tiles[ty * room.w + tx] = v; }
const isFloorish = (t) => t === T_FLOOR || t === T_SPIKE;

function solidAt(room, x, y, fly) {
  const t = tileAt(room, Math.floor(x / TILE), Math.floor(y / TILE));
  return t === T_WALL || (!fly && t === T_PILLAR);
}
function boxSolid(room, x, y, r, fly) {
  const ry = r * 0.6;
  for (const ox of [-r, 0, r]) for (const oy of [-ry, 0, ry]) if (solidAt(room, x + ox, y + oy, fly)) return true;
  return false;
}
// Bewegen mit Wand-Kollision. Gibt true zurück, wenn etwas im Weg war.
// slide: an Ecken leicht seitlich vorbeischieben (fühlt sich weicher an)
function moveEnt(e, dx, dy, slide = false) {
  const room = game.room;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
  let hit = false;
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (!boxSolid(room, e.x + sx, e.y, e.r, e.fly)) e.x += sx;
    else {
      hit = true;
      if (slide && Math.abs(sy) < 0.01 && sx !== 0) {
        for (const k of [2, -2, 4, -4]) if (!boxSolid(room, e.x + sx, e.y + k, e.r, e.fly)) { e.y += Math.sign(k) * Math.min(Math.abs(sx), 1); break; }
      }
    }
    if (!boxSolid(room, e.x, e.y + sy, e.r, e.fly)) e.y += sy;
    else {
      hit = true;
      if (slide && Math.abs(sx) < 0.01 && sy !== 0) {
        for (const k of [2, -2, 4, -4]) if (!boxSolid(room, e.x + k, e.y + sy, e.r, e.fly)) { e.x += Math.sign(k) * Math.min(Math.abs(sy), 1); break; }
      }
    }
  }
  return hit;
}
function lineOfSight(x1, y1, x2, y2) {
  const d = dist(x1, y1, x2, y2);
  const n = Math.ceil(d / 6);
  for (let i = 1; i < n; i++) {
    const k = i / n;
    if (solidAt(game.room, lerp(x1, x2, k), lerp(y1, y2, k), false)) return false;
  }
  return true;
}
function floodFrom(room, sx, sy) {
  const seen = new Set();
  const q = [[sx, sy]];
  seen.add(sy * room.w + sx);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, i = ny * room.w + nx;
      if (seen.has(i) || !isFloorish(tileAt(room, nx, ny))) continue;
      seen.add(i);
      q.push([nx, ny]);
    }
  }
  return seen;
}
// freie Bodenkachel möglichst nah an (x, y)
function findFloorNear(room, x, y) {
  let best = null, bd = Infinity;
  for (let ty = 2; ty < room.h - 1; ty++) for (let tx = 1; tx < room.w - 1; tx++) {
    if (tileAt(room, tx, ty) !== T_FLOOR) continue;
    let free = true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tileAt(room, tx + dx, ty + dy) !== T_FLOOR) free = false;
    if (!free) continue;
    const d = dist(x, y, tx * TILE + 8, ty * TILE + 8);
    if (d < bd) { bd = d; best = { x: tx * TILE + 8, y: ty * TILE + 8 }; }
  }
  return best || { x, y };
}
function randomSpawnPos(room, minDist) {
  const p = game.player;
  for (let i = 0; i < 200; i++) {
    const tx = randi(2, room.w - 3), ty = randi(3, room.h - 3);
    if (tileAt(room, tx, ty) !== T_FLOOR) continue;
    let free = true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tileAt(room, tx + dx, ty + dy) === T_WALL || tileAt(room, tx + dx, ty + dy) === T_PILLAR) free = false;
    if (!free) continue;
    const x = tx * TILE + 8, y = ty * TILE + 8;
    if (p && dist(x, y, p.x, p.y) < minDist) continue;
    return { x, y };
  }
  return findFloorNear(room, room.pw / 2, room.ph / 2);
}

// ---------- Zufallsraum ----------
function generateRoom(spec, depth) {
  const kind = spec.kind;
  const theme = kind === 'boss' ? 'boss' : 'ruins';
  const doorCount = spec.next ? spec.next.length : 0;
  const fight = kind === 'combat' || kind === 'elite' || kind === 'guardian';
  for (let tries = 0; tries < 60; tries++) {
    const plain = tries > 50; // Notfall: schlichter Raum
    let w, h;
    if (kind === 'boss') { w = 32; h = 22; }
    else if (kind === 'shop' || kind === 'spring') { w = 22; h = 15; }
    else if (kind === 'guardian') { w = 30; h = 20; }
    else { w = randi(24, 34); h = randi(16, 22); }
    const room = makeRoom(w, h, theme);
    room.kind = kind;
    room.spec = spec;
    for (let y = 2; y < h - 1; y++) for (let x = 1; x < w - 1; x++) setTile(room, x, y, T_FLOOR);
    const cx = Math.floor(w / 2);
    const doorCols = [];
    for (let i = 0; i < doorCount; i++) doorCols.push(Math.round((w * (i + 1)) / (doorCount + 1)) - 1);

    // Ecken ausschneiden (L-Formen, Nischen)
    if (fight && !plain) {
      const corners = shuffle([0, 1, 2, 3]).slice(0, randi(0, 2));
      for (const c of corners) {
        const cw = randi(3, Math.floor(w * 0.22)), ch = randi(2, Math.floor(h * 0.3));
        const left = c % 2 === 0, top = c < 2;
        const x0 = left ? 1 : w - 1 - cw, y0 = top ? 2 : h - 1 - ch;
        if (top && doorCols.some((dc) => dc + 2 >= x0 && dc - 1 <= x0 + cw)) continue;
        for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) setTile(room, x, y, T_WALL);
      }
    }
    // Säulen
    const spots = [];
    if (kind === 'boss') spots.push([7, 6, 2], [w - 9, 6, 2], [7, h - 7, 2], [w - 9, h - 7, 2]);
    else if (kind === 'shop' || kind === 'spring') spots.push([4, 5, 1], [w - 5, 5, 1]);
    else if (fight && !plain) {
      const n = randi(2, 6);
      for (let i = 0; i < n * 6 && spots.length < n; i++) {
        const s = chance(0.3) ? 2 : 1;
        const tx = randi(3, w - 4 - s), ty = randi(5, h - 4 - s);
        if (Math.abs(tx - cx) < 3 && ty > h - 7) continue;
        let ok = true;
        for (let y = ty - 1; y <= ty + s; y++) for (let x = tx - 1; x <= tx + s; x++) if (tileAt(room, x, y) !== T_FLOOR) ok = false;
        if (spots.some(([px, py, ps]) => tx < px + ps + 2 && tx + s + 2 > px && ty < py + ps + 2 && ty + s + 2 > py)) ok = false;
        if (ok) spots.push([tx, ty, s]);
      }
    }
    for (const [tx, ty, s] of spots) for (let y = ty; y < ty + s; y++) for (let x = tx; x < tx + s; x++) setTile(room, x, y, T_PILLAR);
    room.pillarSpots = spots;
    // Stachelfallen
    if (fight && depth >= 3 && !plain) {
      const n = randi(0, depth >= 7 ? 3 : 2);
      for (let i = 0; i < n; i++) {
        const [sw, sh] = pick([[2, 2], [3, 1], [1, 3], [2, 1]]);
        const tx = randi(2, w - 3 - sw), ty = randi(4, h - 4 - sh);
        if (Math.abs(tx - cx) < 3 && ty > h - 6) continue;
        const tiles = [];
        let ok = true;
        for (let y = ty; y < ty + sh; y++) for (let x = tx; x < tx + sw; x++) { if (tileAt(room, x, y) !== T_FLOOR) ok = false; tiles.push([x, y]); }
        if (!ok) continue;
        tiles.forEach(([x, y]) => setTile(room, x, y, T_SPIKE));
        room.spikes.push({ tiles, t: rand(0, 3), period: 3.2, state: 'idle', id: 0, uid: Math.random() });
      }
    }
    // alles muss vom Eingang erreichbar sein
    const reach = floodFrom(room, cx, h - 2);
    if (doorCols.some((dc) => !reach.has(2 * w + dc) || !reach.has(2 * w + dc + 1))) continue;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (isFloorish(tileAt(room, x, y)) && !reach.has(y * w + x)) setTile(room, x, y, T_WALL);
    }
    room.spikes.forEach((g) => { g.tiles = g.tiles.filter(([x, y]) => tileAt(room, x, y) === T_SPIKE); });
    room.spikes = room.spikes.filter((g) => g.tiles.length);
    room.doors = doorCols.map((dc, i) => ({ tx: dc, x: (dc + 1) * TILE, y: 2 * TILE, spec: spec.next[i], open: false }));
    room.entry = { x: cx * TILE, y: (h - 2) * TILE + 8 };
    finishRoom(room);
    return room;
  }
  throw new Error('Raum konnte nicht erzeugt werden');
}

// ---------- Zuflucht (Startgebiet) ----------
function buildHub() {
  const w = 30, h = 17;
  const room = makeRoom(w, h, 'hub');
  room.kind = 'hub';
  for (let y = 2; y < h - 1; y++) for (let x = 1; x < w - 1; x++) setTile(room, x, y, T_FLOOR);
  room.pillarSpots = [[4, 4, 1], [w - 5, 4, 1], [2, h - 4, 1], [w - 3, h - 4, 1]];
  for (const [tx, ty] of room.pillarSpots) setTile(room, tx, ty, T_PILLAR);
  room.doors = [{ tx: 14, x: 15 * TILE, y: 2 * TILE, spec: { kind: 'start' }, open: true }];
  room.entry = { x: 15 * TILE, y: (h - 3) * TILE };
  finishRoom(room);
  return room;
}

function finishRoom(room) {
  room.pillars = room.pillarSpots.map(([tx, ty, s]) => ({ x: tx * TILE, y: ty * TILE, w: s * TILE, h: s * TILE }));
  room.torches = [];
  let x = randi(2, 4);
  while (x < room.w - 2) {
    const tooClose = room.doors.some((d) => Math.abs(x - d.tx - 0.5) < 3);
    if (!tooClose && tileAt(room, x, 2) !== T_WALL) room.torches.push({ x: x * TILE + 8, y: TILE + 7, ph: rand(0, 10) });
    x += randi(5, 7);
  }
  renderRoomCache(room);
}

function renderRoomCache(room) {
  const th = THEMES[room.theme];
  const c = document.createElement('canvas');
  c.width = room.pw;
  c.height = room.ph;
  const g = c.getContext('2d');
  g.fillStyle = th.bg;
  g.fillRect(0, 0, c.width, c.height);
  const open = (t) => t !== T_WALL;
  for (let ty = 0; ty < room.h; ty++) for (let tx = 0; tx < room.w; tx++) {
    const t = tileAt(room, tx, ty);
    const X = tx * TILE, Y = ty * TILE;
    const hv = hash2(tx, ty);
    if (t !== T_WALL) {
      g.fillStyle = th.floor[Math.floor(hv * 3)];
      g.fillRect(X, Y, TILE, TILE);
      g.fillStyle = th.grout;
      g.fillRect(X, Y, TILE, 1);
      if ((tx + (ty % 2)) % 2 === 0) g.fillRect(X, Y, 1, TILE);
      for (let i = 0; i < 5; i++) {
        const px = Math.floor(hash2(tx * 7 + i, ty * 13 + i) * 14) + 1;
        const py = Math.floor(hash2(tx + i * 31, ty * 3 + i) * 14) + 1;
        g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.14)';
        g.fillRect(X + px, Y + py, 1, 1);
      }
      if (hv > 0.87) {
        g.fillStyle = 'rgba(0,0,0,0.3)';
        let px = X + 3 + (Math.floor(hv * 100) % 8), py = Y + 3;
        for (let i = 0; i < 8; i++) { g.fillRect(px, py, 1, 1); px += hash2(tx + i, ty) > 0.5 ? 1 : -1; py++; }
      }
      if (th.moss && hv < 0.12) {
        g.fillStyle = th.moss;
        for (let i = 0; i < 7; i++) g.fillRect(X + 3 + ((i * 5) % 9), Y + 4 + ((i * 3) % 7), 2, 1);
      }
      if (t === T_SPIKE) {
        g.fillStyle = '#2b2a33';
        g.fillRect(X + 1, Y + 1, 14, 14);
        g.fillStyle = '#3c3b46';
        g.fillRect(X + 1, Y + 1, 14, 1);
        g.fillStyle = '#111016';
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) g.fillRect(X + 3 + i * 4, Y + 3 + j * 4, 2, 2);
      }
      if (tileAt(room, tx, ty - 1) === T_WALL) {
        const gr = g.createLinearGradient(0, Y, 0, Y + 8);
        gr.addColorStop(0, 'rgba(0,0,0,0.5)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(X, Y, TILE, 8);
      }
      if (tileAt(room, tx - 1, ty) === T_WALL) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(X, Y, 3, TILE); }
      if (tileAt(room, tx + 1, ty) === T_WALL) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(X + TILE - 2, Y, 2, TILE); }
    } else if (open(tileAt(room, tx, ty + 1))) {
      // Wandfront mit Ziegeln
      g.fillStyle = th.face[0];
      g.fillRect(X, Y, TILE, TILE);
      for (let r = 0; r < 4; r++) {
        const yy = Y + r * 4;
        if (hash2(tx * 3 + r, ty * 5) > 0.65) { g.fillStyle = th.face[1]; g.fillRect(X + ((r * 5 + tx * 3) % 9) + 1, yy, 6, 3); }
        g.fillStyle = th.faceDark;
        g.fillRect(X, yy + 3, TILE, 1);
        for (let bx = (r % 2) * 4 + 2; bx < TILE; bx += 8) g.fillRect(X + bx, yy, 1, 3);
      }
      g.fillStyle = 'rgba(255,255,255,0.1)';
      g.fillRect(X, Y, TILE, 1);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(X, Y + TILE - 2, TILE, 2);
    } else {
      g.fillStyle = th.top;
      g.fillRect(X, Y, TILE, TILE);
      g.fillStyle = th.faceDark;
      if (open(tileAt(room, tx + 1, ty))) g.fillRect(X + TILE - 2, Y, 2, TILE);
      if (open(tileAt(room, tx - 1, ty))) g.fillRect(X, Y, 2, TILE);
      if (open(tileAt(room, tx, ty - 1))) g.fillRect(X, Y, TILE, 2);
    }
  }
  // Schmuck je nach Gebiet
  if (room.theme === 'hub') {
    const x0 = (room.w / 2 - 2) * TILE + 4, x1 = (room.w / 2 + 2) * TILE - 4;
    g.fillStyle = '#4a1d3e';
    g.fillRect(x0, 2 * TILE, x1 - x0, (room.h - 3) * TILE);
    g.fillStyle = '#c9a24a';
    g.fillRect(x0 + 2, 2 * TILE, 1, (room.h - 3) * TILE);
    g.fillRect(x1 - 3, 2 * TILE, 1, (room.h - 3) * TILE);
    g.fillStyle = '#6a2a58';
    for (let y = 2 * TILE + 8; y < (room.h - 1) * TILE; y += 16) {
      const mx = (x0 + x1) / 2;
      g.fillRect(mx - 1, y - 3, 2, 6);
      g.fillRect(mx - 3, y - 1, 6, 2);
    }
  } else if (room.theme === 'boss') {
    g.strokeStyle = 'rgba(255,110,40,0.25)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(room.pw / 2, room.ph / 2 + 8, 70, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(room.pw / 2, room.ph / 2 + 8, 56, 0, TAU);
    g.stroke();
    for (let i = 0; i < 40; i++) {
      const tx = randi(1, room.w - 2), ty = randi(2, room.h - 2);
      if (tileAt(room, tx, ty) !== T_FLOOR) continue;
      g.fillStyle = 'rgba(255,120,40,0.55)';
      let px = tx * TILE + randi(2, 12), py = ty * TILE + randi(2, 10);
      for (let k = 0; k < 6; k++) { g.fillRect(px, py, 1, 1); px += randi(-1, 1); py += 1; }
    }
  } else {
    for (let i = 0; i < room.w * room.h * 0.06; i++) {
      const tx = randi(1, room.w - 2), ty = randi(2, room.h - 2);
      if (tileAt(room, tx, ty) !== T_FLOOR) continue;
      const X = tx * TILE + randi(2, 12), Y = ty * TILE + randi(3, 12);
      if (chance(0.5)) {
        g.fillStyle = '#4f7a40';
        g.fillRect(X, Y, 1, 2); g.fillRect(X + 2, Y - 1, 1, 3); g.fillRect(X + 4, Y, 1, 2);
      } else {
        g.fillStyle = '#5a6660';
        g.fillRect(X, Y, 3, 2);
        g.fillStyle = '#7a8680';
        g.fillRect(X, Y, 2, 1);
      }
    }
  }
  // Eingang unten
  const ex = Math.floor(room.w / 2) * TILE;
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(ex - 12, (room.h - 1) * TILE, 24, TILE);
  room.cache = c;
}

// ---------- bewegliche Teile des Raums ----------
function updateSpikes(room, dt) {
  const p = game.player;
  for (const g of room.spikes) {
    g.t += dt;
    const ph = g.t % g.period;
    const st = ph < 2.0 ? 'idle' : ph < 2.6 ? 'warn' : 'up';
    if (st === 'up' && g.state !== 'up') { g.id++; if (onScreen(g.tiles[0][0] * TILE, g.tiles[0][1] * TILE)) Sound.play('spike'); }
    g.state = st;
    if (st !== 'up') continue;
    const inside = (x, y) => g.tiles.some(([tx, ty]) => x >= tx * TILE && x < tx * TILE + TILE && y >= ty * TILE && y < ty * TILE + TILE);
    if (inside(p.x, p.y)) hurtPlayer(12, p.x, p.y + 10, 'spike');
    for (const e of game.enemies) {
      if (e.dead || e.fly || e.boss || e.spawnT > 0) continue;
      const key = `${g.uid}:${g.id}`;
      if (e.spikeKey !== key && inside(e.x, e.y)) { e.spikeKey = key; damageEnemy(e, 20, 'trap'); }
    }
  }
}

function drawFloorDynamic(room) {
  const t = game.time;
  for (const g of room.spikes) {
    for (const [tx, ty] of g.tiles) {
      const X = tx * TILE, Y = ty * TILE;
      if (g.state === 'warn') {
        ctx.fillStyle = '#8b93a6';
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ctx.fillRect(X + 3 + i * 4, Y + 3 + j * 4, 2, 1);
      } else if (g.state === 'up') {
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const px = X + 4 + i * 4, py = Y + 5 + j * 4;
          ctx.fillStyle = '#dde2ec';
          ctx.beginPath();
          ctx.moveTo(px - 1.5, py);
          ctx.lineTo(px, py - 6);
          ctx.lineTo(px + 1.5, py);
          ctx.fill();
        }
      }
    }
  }
  // Türen in der Wand
  for (const d of room.doors) {
    const col = doorColor(d.spec);
    ctx.fillStyle = '#05030a';
    ctx.beginPath();
    ctx.moveTo(d.x - 12, 2 * TILE);
    ctx.lineTo(d.x - 12, 15);
    ctx.arc(d.x, 15, 12, Math.PI, 0);
    ctx.lineTo(d.x + 12, 2 * TILE);
    ctx.fill();
    if (d.open) {
      const pulse = 0.55 + Math.sin(t * 4) * 0.15;
      ctx.fillStyle = hexA(col, pulse * 0.6);
      ctx.fill();
      ctx.strokeStyle = hexA(col, 0.8);
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const r = ((t * 8 + i * 4) % 12);
        ctx.globalAlpha = 1 - r / 12;
        ctx.beginPath();
        ctx.arc(d.x, 22, r, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = THEMES[room.theme].face[1];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(d.x - 13, 2 * TILE);
    ctx.lineTo(d.x - 13, 15);
    ctx.arc(d.x, 15, 13, Math.PI, 0);
    ctx.lineTo(d.x + 13, 2 * TILE);
    ctx.stroke();
    if (!d.open) {
      ctx.fillStyle = '#3a3640';
      for (let i = -8; i <= 8; i += 4) ctx.fillRect(d.x + i - 0.5, 6, 1.5, 26);
    }
    if (d.spec) drawRewardIcon(d.spec, d.x, 20 + Math.sin(t * 3 + d.x) * 1.2, d.open ? 1 : 0.55);
  }
  // Fackeln
  for (const tc of room.torches) {
    ctx.fillStyle = '#2a2026';
    ctx.fillRect(tc.x - 2, tc.y, 4, 3);
    const f = Math.sin(t * 17 + tc.ph) * 0.8 + Math.sin(t * 7 + tc.ph * 2) * 0.6;
    const col = THEMES[room.theme].torch;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(tc.x, tc.y - 3, 2.5, 4 + f * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.fillRect(tc.x - 1, tc.y - 3, 2, 2);
  }
}
function drawRoomLights(room) {
  const t = game.time;
  for (const tc of room.torches) {
    const f = 1 + Math.sin(t * 11 + tc.ph) * 0.08;
    glow(tc.x, tc.y, 46 * f, THEMES[room.theme].torch, 0.32);
  }
  for (const d of room.doors) if (d.open) glow(d.x, 26, 40, doorColor(d.spec), 0.45);
}
function drawPillar(room, pl) {
  const th = THEMES[room.theme];
  const x = pl.x + 2, w = pl.w - 4, top = pl.y - 18, bottom = pl.y + pl.h;
  shadowEllipse(pl.x + pl.w / 2, bottom - 1, pl.w / 2 + 2, 4, 0.4);
  ctx.fillStyle = th.face[0];
  ctx.fillRect(x, top, w, bottom - top);
  ctx.fillStyle = th.face[1];
  ctx.fillRect(x + 2, top, 3, bottom - top);
  ctx.fillStyle = th.faceDark;
  ctx.fillRect(x + w - 3, top, 3, bottom - top);
  for (let yy = top + 6; yy < bottom - 4; yy += 7) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, yy, w, 1); }
  // Kapitell und Sockel
  ctx.fillStyle = th.face[1];
  ctx.fillRect(x - 2, top - 3, w + 4, 4);
  ctx.fillStyle = th.top;
  ctx.fillRect(x - 2, top - 5, w + 4, 2);
  ctx.fillStyle = th.faceDark;
  ctx.fillRect(x - 2, bottom - 3, w + 4, 3);
  if (th.moss && hash2(pl.x, pl.y) > 0.4) {
    ctx.fillStyle = th.moss;
    ctx.fillRect(x, bottom - 6, 4, 3);
    ctx.fillRect(x + 1, bottom - 9, 2, 3);
  }
}
function onScreen(x, y, m = 40) {
  return x > game.cam.x - m && x < game.cam.x + VIEW_W + m && y > game.cam.y - m && y < game.cam.y + VIEW_H + m;
}
