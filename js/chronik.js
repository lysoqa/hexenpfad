'use strict';
// ===== Chronik: Statistik sammeln, speichern und anzeigen =====
// Die Chronistin in der Zuflucht zeigt alles an (Taste E bei ihr).
const STATS_KEY = 'hexenpfad-stats';
const ENEMY_ORDER = ['imp', 'spitter', 'shroom', 'ram', 'eye', 'knight', 'boss'];
const CHRONIK_TABS = ['Übersicht', 'Waffen', 'Elemente', 'Gegner', 'Verlauf'];
const CHRONIK_COLOR = '#5fd0c8';
const enemyName = (id) => (id === 'boss' ? BOSS.name : id === 'spike' ? 'Stachelfalle' : ENEMIES[id] ? ENEMIES[id].name : 'Unbekannt');

function defaultStats() {
  const weapons = {};
  for (const id of WEAPON_ORDER) weapons[id] = { runs: 0, wins: 0, deaths: 0, best: 0, kills: 0, dmg: 0, fastest: 0, time: 0 };
  const elements = {};
  for (const el of ELEMENT_ORDER) elements[el] = { picks: 0, mainRuns: 0, mainWins: 0 };
  return {
    runs: 0, wins: 0, deaths: 0, abandoned: 0, best: 0, kills: 0, dmg: 0, taken: 0, maxHit: 0,
    gold: 0, goldSpent: 0, dashes: 0, rooms: 0, boonPicks: 0, legendary: 0, duos: 0, time: 0, fastest: 0,
    weapon: 'sword', weapons, elements, boons: {}, killsBy: {}, killedBy: {}, deathRooms: {}, history: [],
  };
}
function loadStats() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STATS_KEY) || '{}') || {}; } catch (err) { saved = {}; }
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const merge = (a, b) => {
    for (const k of Object.keys(b)) { if (isObj(a[k]) && isObj(b[k])) merge(a[k], b[k]); else a[k] = b[k]; }
    return a;
  };
  return merge(defaultStats(), saved);
}
function saveStats() { localStorage.setItem(STATS_KEY, JSON.stringify(game.stats)); }
function newRunStats(active = false) {
  return {
    active, kills: 0, dmg: 0, taken: 0, time: 0, maxHit: 0, gold: 0, goldSpent: 0, dashes: 0, rooms: 0,
    killsBy: {}, picks: [], legendary: 0, duos: 0, killer: null,
  };
}
const add = (obj, k, n = 1) => { obj[k] = (obj[k] || 0) + n; };
function boonIdEls(id) {
  if (DUOS[id]) return DUOS[id].els;
  if (PASSIVES[id]) return [PASSIVES[id].el];
  return [id.split('_')[0]];
}
function boonIdName(id) {
  if (DUOS[id]) return DUOS[id].name;
  if (PASSIVES[id]) return PASSIVES[id].name;
  const [el, slot] = id.split('_');
  return SLOT_BOONS[el] && SLOT_BOONS[el][slot] ? SLOT_BOONS[el][slot].name : id;
}
// stärkstes Element des aktuellen Laufs
function mainElement() {
  let best = null, bv = 0;
  for (const el of ELEMENT_ORDER) { const v = resonance(el); if (v > bv) { bv = v; best = el; } }
  return best;
}

// Lauf abschließen und alles in die Chronik schreiben. result: 'win' | 'death' | 'abandon'
function finishRun(result) {
  const r = game.run;
  if (!r || !r.active || game.mode !== 'run') return;
  r.active = false;
  const S = game.stats, wid = game.player.weapon, w = S.weapons[wid];
  S.runs++; w.runs++;
  if (result === 'win') {
    S.wins++; w.wins++;
    S.fastest = S.fastest ? Math.min(S.fastest, r.time) : r.time;
    w.fastest = w.fastest ? Math.min(w.fastest, r.time) : r.time;
  } else if (result === 'death') {
    S.deaths++; w.deaths++;
    add(S.killedBy, r.killer || 'unknown');
    add(S.deathRooms, game.depth);
  } else S.abandoned++;
  S.kills += r.kills; w.kills += r.kills;
  S.dmg += r.dmg; w.dmg += r.dmg;
  S.taken += r.taken;
  S.maxHit = Math.max(S.maxHit, r.maxHit);
  S.gold += r.gold; S.goldSpent += r.goldSpent;
  S.dashes += r.dashes; S.rooms += r.rooms;
  S.time += r.time; w.time += r.time;
  w.best = Math.max(w.best, game.depth);
  S.best = Math.max(S.best, game.depth);
  for (const [k, v] of Object.entries(r.killsBy)) add(S.killsBy, k, v);
  for (const id of r.picks) {
    add(S.boons, id);
    S.boonPicks++;
    for (const el of boonIdEls(id)) if (S.elements[el]) S.elements[el].picks++;
  }
  S.legendary += r.legendary; S.duos += r.duos;
  const main = mainElement();
  if (main) { S.elements[main].mainRuns++; if (result === 'win') S.elements[main].mainWins++; }
  S.history.unshift({ w: wid, res: result, depth: game.depth, time: r.time, kills: r.kills, el: main, boons: allBoons().length, date: Date.now() });
  S.history.length = Math.min(S.history.length, 20);
  saveStats();
}
addEventListener('beforeunload', () => { if (game.run && game.run.active) finishRun('abandon'); });

// ---------- Auswertungen ----------
function argMax(obj, f = (v) => v) {
  let best = null, bv = 0;
  for (const [k, v] of Object.entries(obj)) { const n = f(v); if (n > bv) { bv = n; best = k; } }
  return best ? [best, bv] : null;
}
const fmtNum = (n) => Math.round(n || 0).toLocaleString('de-DE');
function fmtTime(sec) {
  if (!sec) return '–';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function fmtLong(sec) {
  const m = Math.round((sec || 0) / 60);
  if (m < 60) return `${m} Min`;
  return `${Math.floor(m / 60)} Std ${m % 60} Min`;
}
function fmtAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min`;
  if (m < 60 * 24) return `vor ${Math.floor(m / 60)} Std`;
  const d = Math.floor(m / 1440);
  return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');

// ---------- Chronistin (NPC) ----------
function addChronist() {
  game.interact.push({
    kind: 'chronist', x: 192, y: 138, r: 14,
    label: () => '[E] Chronik ansehen',
    sub: () => 'Die Chronistin kennt jeden deiner Läufe',
    use() { openChronik(); },
  });
}
function drawChronist(it) {
  const t = game.time, p = game.player;
  const bob = Math.sin(t * 1.8) * 0.6;
  shadowEllipse(it.x, it.y, 7, 2.5, 0.4);
  drawSprite(SPR.chronist, it.x, it.y + bob * 0.3, { flip: p.x < it.x, sy: 1 + Math.sin(t * 1.8) * 0.012 });
  // schwebende Feder und Seiten
  const fx = it.x + (p.x < it.x ? -9 : 9), fy = it.y - 22 + Math.sin(t * 2.4) * 2;
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(Math.sin(t * 1.7) * 0.3 - 0.5);
  ctx.fillStyle = '#f5ecd0';
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.6, 4.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2a1a2a';
  ctx.fillRect(-0.3, 1, 0.6, 5);
  ctx.restore();
  // Zeichen über dem Kopf
  const near = dist(p.x, p.y, it.x, it.y) < it.r + 10;
  const my = it.y - 27 + Math.sin(t * 3) * 1.2;
  ctx.fillStyle = CHRONIK_COLOR;
  diamond(it.x, my, near ? 2.8 : 2.2);
  ctx.fillStyle = '#e8fffb';
  diamond(it.x, my, 1);
}
function drawChronistLight(it) {
  glow(it.x + 1, it.y - 9, 20, CHRONIK_COLOR, 0.35 + Math.sin(game.time * 2) * 0.08);
  glow(it.x, it.y - 27, 10, CHRONIK_COLOR, 0.5);
}

// ---------- Chronik-Bildschirm ----------
function openChronik() {
  game.chronik = { tab: game.chronik ? game.chronik.tab : 0, t: 0 };
  setGameState('chronik');
  Sound.play('pickup');
}
const CH = { x: 14, y: 8, w: 452, h: 254 };
function tabRect(i) { return { x: CH.x + 14 + i * 78, y: CH.y + 26, w: 74, h: 13 }; }
function updateChronik(dt) {
  const c = game.chronik;
  c.t += dt;
  let hover = -1;
  for (let i = 0; i < CHRONIK_TABS.length; i++) {
    const r = tabRect(i);
    if (Input.mx >= r.x && Input.mx <= r.x + r.w && Input.my >= r.y && Input.my <= r.y + r.h) hover = i;
  }
  c.hover = hover;
  const go = (i) => { if (i !== c.tab) { c.tab = i; c.tabT = 0; Sound.play('select'); } };
  if (Input.clicked[0] && hover >= 0) go(hover);
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].forEach((k, i) => { if (Input.hit(k)) go(i); });
  if (Input.hit('ArrowRight') || Input.hit('KeyD') || Input.hit('Tab')) go((c.tab + 1) % CHRONIK_TABS.length);
  if (Input.hit('ArrowLeft') || Input.hit('KeyA')) go((c.tab + CHRONIK_TABS.length - 1) % CHRONIK_TABS.length);
  c.tabT = (c.tabT || 0) + dt;
  const closeHover = Input.mx > CH.x + CH.w - 20 && Input.mx < CH.x + CH.w - 4 && Input.my > CH.y + 4 && Input.my < CH.y + 20;
  if (c.t > 0.2 && (Input.hit('Escape') || Input.hit('KeyE') || (Input.clicked[0] && closeHover))) {
    setGameState('play');
    game.player.blockAtk = true;
    Sound.play('select');
  }
}

function drawChronik() {
  const c = game.chronik, S = game.stats, t = game.time;
  const k = easeOut(clamp(c.t / 0.25, 0, 1));
  ctx.fillStyle = `rgba(4,2,8,${0.8 * k})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(0, (1 - k) * 10);
  // Buchseite
  glow(VIEW_W / 2, VIEW_H / 2, 260, CHRONIK_COLOR, 0.12);
  roundRect(CH.x, CH.y, CH.w, CH.h, 6);
  ctx.fillStyle = gLin(0, CH.y, 0, CH.y + CH.h, [[0, '#132228'], [0.25, '#0e1418'], [1, '#0a0c10']]);
  ctx.fill();
  ctx.strokeStyle = hexA(CHRONIK_COLOR, 0.7);
  ctx.lineWidth = 1;
  ctx.stroke();
  roundRect(CH.x + 3, CH.y + 3, CH.w - 6, CH.h - 6, 4);
  ctx.strokeStyle = 'rgba(201,162,74,0.35)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.fillStyle = '#c9a24a';
  for (const [px, py] of [[CH.x + 3, CH.y + 3], [CH.x + CH.w - 3, CH.y + 3], [CH.x + 3, CH.y + CH.h - 3], [CH.x + CH.w - 3, CH.y + CH.h - 3]]) diamond(px, py, 2.2);
  // Kopf
  text('Chronik', CH.x + 16, CH.y + 7, { size: 13, title: true, color: '#e8fffb' });
  text(`${fmtNum(S.runs)} Läufe aufgezeichnet`, CH.x + 76, CH.y + 12.5, { size: 5.5, color: '#7aa8a4', italic: true });
  // Schließen
  const cx = CH.x + CH.w - 12, cy = CH.y + 12;
  ctx.strokeStyle = '#9ac8c4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy - 3); ctx.lineTo(cx + 3, cy + 3); ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx - 3, cy + 3);
  ctx.stroke();
  text('ESC', cx - 8, cy - 2.5, { size: 4.5, align: 'right', color: '#5a7a78' });
  // Reiter
  CHRONIK_TABS.forEach((name, i) => {
    const r = tabRect(i), on = c.tab === i, hv = c.hover === i;
    roundRect(r.x, r.y, r.w, r.h, 3);
    ctx.fillStyle = on ? hexA(CHRONIK_COLOR, 0.25) : hv ? 'rgba(95,208,200,0.1)' : 'rgba(0,0,0,0.3)';
    ctx.fill();
    ctx.strokeStyle = on ? CHRONIK_COLOR : 'rgba(95,208,200,0.25)';
    ctx.lineWidth = on ? 0.9 : 0.5;
    ctx.stroke();
    text(`${i + 1}  ${name}`, r.x + r.w / 2, r.y + 3.3, { size: 5.8, align: 'center', bold: on, color: on ? '#e8fffb' : '#8ab8b4' });
  });
  ctx.fillStyle = gLin(CH.x + 10, 0, CH.x + CH.w - 10, 0, [[0, 'rgba(95,208,200,0)'], [0.5, 'rgba(95,208,200,0.6)'], [1, 'rgba(95,208,200,0)']]);
  ctx.fillRect(CH.x + 10, CH.y + 43, CH.w - 20, 0.6);
  // Inhalt
  const tk = easeOut(clamp((c.tabT ?? 1) / 0.2, 0, 1));
  ctx.save();
  ctx.globalAlpha *= tk;
  ctx.translate((1 - tk) * 6, 0);
  if (S.runs === 0 && c.tab !== 1 && c.tab !== 2) {
    text('Noch keine Läufe aufgezeichnet.', VIEW_W / 2, 120, { size: 9, title: true, align: 'center', color: '#c8e8e4' });
    text('Durchschreite das Tor oben, dann füllt sich die Chronik.', VIEW_W / 2, 134, { size: 6, align: 'center', color: '#7aa8a4' });
  } else [drawChronikOverview, drawChronikWeapons, drawChronikElements, drawChronikEnemies, drawChronikHistory][c.tab](S, t);
  ctx.restore();
  text('1–5 oder Klick: Seite wechseln  ·  E / ESC: schließen', VIEW_W / 2, CH.y + CH.h - 9, { size: 4.8, align: 'center', color: '#5a7a78' });
  ctx.restore();
}

// kleine Bausteine
function chTile(x, y, w, h, value, label, color = '#e8fffb') {
  roundRect(x, y, w, h, 3);
  ctx.fillStyle = 'rgba(95,208,200,0.07)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(95,208,200,0.3)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  text(String(value), x + w / 2, y + 5, { size: 11, title: true, bold: true, align: 'center', color });
  text(label, x + w / 2, y + h - 9, { size: 5, align: 'center', color: '#7aa8a4' });
}
function chRow(x, y, w, label, value, color = '#e8fffb') {
  text(label, x, y, { size: 5.8, color: '#9ac8c4' });
  const vw = textWidth(String(value), 5.8, { bold: true });
  const lw = textWidth(label, 5.8);
  ctx.fillStyle = 'rgba(95,208,200,0.25)';
  for (let px = x + lw + 3; px < x + w - vw - 3; px += 2.5) ctx.fillRect(px, y + 5, 0.7, 0.7);
  text(String(value), x + w, y, { size: 5.8, bold: true, align: 'right', color });
}
function chBar(x, y, w, k, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x, y, w, 2.5);
  ctx.fillStyle = gLin(x, 0, x + w, 0, [[0, hexA(color, 0.6)], [1, color]]);
  ctx.fillRect(x, y, w * clamp(k, 0, 1), 2.5);
}
function chHeading(x, y, label) {
  ctx.letterSpacing = '1px';
  text(label.toUpperCase(), x, y, { size: 5.2, bold: true, color: '#c9a24a' });
  ctx.letterSpacing = '0px';
}
function drawWeaponIcon(id, x, y, scale = 1) {
  const spr = SPR[id], [gx, gy] = WEAPON_GRIP[id];
  const ang = -Math.PI / 4;
  const len = (spr.w - gx) * scale;
  drawRotated(spr, x - Math.cos(ang) * len * 0.45, y - Math.sin(ang) * len * 0.45, ang, gx, gy, { scale });
}
function highlightCard(x, y, w, h, title, draw, name, sub, color) {
  roundRect(x, y, w, h, 3);
  ctx.fillStyle = gLin(0, y, 0, y + h, [[0, hexA(color, 0.16)], [1, 'rgba(0,0,0,0.25)']]);
  ctx.fill();
  ctx.strokeStyle = hexA(color, 0.5);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.letterSpacing = '0.8px';
  text(title, x + w / 2, y + 3.5, { size: 4.6, bold: true, align: 'center', color: '#c9a24a' });
  ctx.letterSpacing = '0px';
  glow(x + w / 2, y + 24, 16, color, 0.25);
  draw(x + w / 2, y + 24);
  text(name, x + w / 2, y + h - 17, { size: 6.2, bold: true, align: 'center', color });
  text(sub, x + w / 2, y + h - 9, { size: 5, align: 'center', color: '#7aa8a4' });
}

function drawChronikOverview(S) {
  const y0 = CH.y + 50, x0 = CH.x + 12;
  const tiles = [
    [fmtNum(S.runs), 'Läufe'], [fmtNum(S.wins), 'Siege', '#ffd86a'], [pct(S.wins, S.runs), 'Siegquote'],
    [`${S.best}/${RUN.rooms}`, 'Beste Kammer'], [fmtLong(S.time), 'Spielzeit'], [fmtTime(S.fastest), 'Schnellster Sieg', '#ffd86a'],
  ];
  tiles.forEach(([v, l, col], i) => chTile(x0 + i * 72, y0, 68, 30, v, l, col));
  const ly = y0 + 38;
  chHeading(x0, ly, 'Kampf');
  chHeading(x0 + 222, ly, 'Abenteuer');
  const left = [
    ['Gegner besiegt', fmtNum(S.kills)], [`${BOSS.name} besiegt`, fmtNum(S.wins)], ['Schaden ausgeteilt', fmtNum(S.dmg)],
    ['Stärkster Treffer', fmtNum(S.maxHit)], ['Schaden erlitten', fmtNum(S.taken)], ['Tode', fmtNum(S.deaths)], ['Abgebrochene Läufe', fmtNum(S.abandoned)],
  ];
  const right = [
    ['Kammern gesäubert', fmtNum(S.rooms)], ['Sprints', fmtNum(S.dashes)], ['Gold gesammelt', fmtNum(S.gold)],
    ['Gold ausgegeben', fmtNum(S.goldSpent)], ['Segen gewählt', fmtNum(S.boonPicks)], ['Legendäre Segen', fmtNum(S.legendary)], ['Duo-Segen', fmtNum(S.duos)],
  ];
  left.forEach(([l, v], i) => chRow(x0, ly + 9 + i * 8.6, 206, l, v));
  right.forEach(([l, v], i) => chRow(x0 + 222, ly + 9 + i * 8.6, 206, l, v));

  // Höhepunkte
  const hy = ly + 74, hw = 82, hh = 54;
  const fw = argMax(S.weapons, (v) => v.runs);
  const fe = argMax(S.elements, (v) => v.picks);
  const fb = argMax(S.boons);
  const nem = argMax(S.killedBy);
  const dr = argMax(S.deathRooms);
  const cards = [
    ['LIEBLINGSWAFFE', fw ? (x, y) => drawWeaponIcon(fw[0], x, y + 2, 1.5) : null, fw ? WEAPONS[fw[0]].name : '–', fw ? `${fw[1]} ${fw[1] === 1 ? 'Lauf' : 'Läufe'}` : '', fw ? WEAPONS[fw[0]].color : '#8ab8b4'],
    ['LIEBLINGSELEMENT', fe ? (x, y) => drawEmblem(fe[0], x, y, 9) : null, fe ? ELEMENTS[fe[0]].name : '–', fe ? `${fe[1]} Segen` : '', fe ? ELEMENTS[fe[0]].color : '#8ab8b4'],
    ['LIEBLINGSSEGEN', fb ? (x, y) => { const els = boonIdEls(fb[0]); els.forEach((el, i) => drawEmblem(el, x + (i - (els.length - 1) / 2) * 12, y, 8)); } : null, fb ? boonIdName(fb[0]) : '–', fb ? `${fb[1]}× gewählt` : '', fb ? ELEMENTS[boonIdEls(fb[0])[0]].color : '#8ab8b4'],
    ['ERZFEIND', nem ? (x, y) => drawEnemyIcon(nem[0], x, y + 9, 1) : null, nem ? enemyName(nem[0]) : '–', nem ? `hat dich ${nem[1]}× besiegt` : 'Noch niemand', '#ff7a6a'],
    ['TÜCKISCHSTE KAMMER', dr ? (x, y) => { text(dr[0], x, y - 9, { size: 16, title: true, bold: true, align: 'center', color: '#ff9a6a' }); } : null, dr ? `Kammer ${dr[0]}` : '–', dr ? `${dr[1]}× dort gefallen` : 'Noch nie gefallen', '#ff9a6a'],
  ];
  cards.forEach(([title, draw, name, sub, col], i) => highlightCard(x0 + i * 86, hy, hw, hh, title, draw || (() => {}), name, sub, col));
}

function drawEnemyIcon(id, x, y, scale) {
  if (id === 'spike') {
    for (let i = -1; i <= 1; i++) {
      ctx.fillStyle = '#dde2ec';
      ctx.beginPath();
      ctx.moveTo(x + i * 5 - 2, y); ctx.lineTo(x + i * 5, y - 9); ctx.lineTo(x + i * 5 + 2, y);
      ctx.fill();
    }
    return;
  }
  if (!SPR[id]) { drawTypeEmblem('boss', x, y - 8, 7); return; }
  drawSprite(SPR[id], x, y, { scale: id === 'boss' ? Math.max(0.5, scale * 0.5) : scale });
}

function drawChronikWeapons(S) {
  const y0 = CH.y + 50, x0 = CH.x + 12, cw = 104, t = game.time;
  const top = argMax(S.weapons, (v) => v.wins);
  WEAPON_ORDER.forEach((id, i) => {
    const W = WEAPONS[id], st = S.weapons[id];
    const x = x0 + i * (cw + 4);
    roundRect(x, y0, cw, 186, 4);
    ctx.fillStyle = gLin(0, y0, 0, y0 + 186, [[0, hexA(W.color, 0.14)], [0.4, 'rgba(0,0,0,0.2)'], [1, 'rgba(0,0,0,0.3)']]);
    ctx.fill();
    ctx.strokeStyle = hexA(W.color, top && top[0] === id ? 0.9 : 0.35);
    ctx.lineWidth = top && top[0] === id ? 1 : 0.6;
    ctx.stroke();
    const cx = x + cw / 2, cy = y0 + 26;
    fillCircle(cx, cy, 19, gRad(cx, cy, 0, 19, [[0, hexA(W.color, 0.35)], [1, hexA(W.color, 0.02)]]));
    strokeCircle(cx, cy, 19, hexA(W.color, 0.6), 0.7);
    glow(cx, cy, 24, W.color, 0.2);
    drawWeaponIcon(id, cx, cy + Math.sin(t * 2 + i) * 1, 2);
    if (top && top[0] === id) drawCrown(cx, y0 + 4);
    text(W.name, cx, y0 + 50, { size: 9, title: true, align: 'center', color: W.color });
    text(W.kind.toUpperCase(), cx, y0 + 61, { size: 4.8, bold: true, align: 'center', color: '#7aa8a4' });
    const rx = x + 7, rw = cw - 14;
    let yy = y0 + 72;
    const row = (l, v, col) => { chRow(rx, yy, rw, l, v, col); yy += 9; };
    row('Läufe', fmtNum(st.runs));
    row('Siege', fmtNum(st.wins), '#ffd86a');
    row('Siegquote', pct(st.wins, st.runs));
    chBar(rx, yy - 1.5, rw, st.runs ? st.wins / st.runs : 0, '#ffd86a');
    yy += 4;
    row('Beste Kammer', `${st.best}/${RUN.rooms}`);
    chBar(rx, yy - 1.5, rw, st.best / RUN.rooms, W.color);
    yy += 4;
    row('Gegner besiegt', fmtNum(st.kills));
    row('Schaden', fmtNum(st.dmg));
    row('Tode', fmtNum(st.deaths));
    row('Schnellster Sieg', fmtTime(st.fastest));
    row('Spielzeit', fmtLong(st.time));
    row('Ø Gegner pro Lauf', st.runs ? fmtNum(st.kills / st.runs) : '–');
  });
}
function drawCrown(x, y) {
  ctx.fillStyle = EMB_LINE;
  ctx.beginPath();
  ctx.moveTo(x - 7, y + 6); ctx.lineTo(x - 7, y - 1); ctx.lineTo(x - 3.5, y + 2); ctx.lineTo(x, y - 3); ctx.lineTo(x + 3.5, y + 2); ctx.lineTo(x + 7, y - 1); ctx.lineTo(x + 7, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = gLin(0, y - 2, 0, y + 5, [[0, '#fff1a0'], [1, '#c9902a']]);
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 5); ctx.lineTo(x - 6, y + 0.5); ctx.lineTo(x - 3.5, y + 3); ctx.lineTo(x, y - 1.5); ctx.lineTo(x + 3.5, y + 3); ctx.lineTo(x + 6, y + 0.5); ctx.lineTo(x + 6, y + 5);
  ctx.closePath();
  ctx.fill();
}

function drawChronikElements(S) {
  const y0 = CH.y + 50, x0 = CH.x + 12, cw = 104;
  const total = ELEMENT_ORDER.reduce((s, el) => s + S.elements[el].picks, 0);
  ELEMENT_ORDER.forEach((el, i) => {
    const E = ELEMENTS[el], st = S.elements[el];
    const x = x0 + i * (cw + 4), cx = x + cw / 2, cy = y0 + 26;
    roundRect(x, y0, cw, 186, 4);
    ctx.fillStyle = gLin(0, y0, 0, y0 + 186, [[0, hexA(E.color, 0.15)], [0.4, 'rgba(0,0,0,0.2)'], [1, 'rgba(0,0,0,0.3)']]);
    ctx.fill();
    ctx.strokeStyle = hexA(E.color, 0.4);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    fillCircle(cx, cy, 19, gRad(cx, cy, 0, 19, [[0, hexA(E.color, 0.4)], [1, hexA(E.color, 0.02)]]));
    strokeCircle(cx, cy, 19, hexA(E.color, 0.6), 0.7);
    glow(cx, cy, 26, E.color, 0.25);
    drawEmblem(el, cx, cy, 11);
    text(E.name, cx, y0 + 50, { size: 9, title: true, align: 'center', color: E.color });
    text(STATUS_TEXT[el].split(':')[0].toUpperCase(), cx, y0 + 61, { size: 4.8, bold: true, align: 'center', color: '#7aa8a4' });
    const rx = x + 7, rw = cw - 14;
    let yy = y0 + 72;
    const row = (l, v, col) => { chRow(rx, yy, rw, l, v, col); yy += 9; };
    row('Segen gewählt', fmtNum(st.picks));
    row('Anteil', pct(st.picks, total));
    chBar(rx, yy - 1.5, rw, total ? st.picks / total : 0, E.color);
    yy += 4;
    row('Hauptelement', `${fmtNum(st.mainRuns)} ${st.mainRuns === 1 ? 'Lauf' : 'Läufe'}`);
    row('Siege damit', fmtNum(st.mainWins), '#ffd86a');
    row('Siegquote', pct(st.mainWins, st.mainRuns));
    yy += 4;
    chHeading(rx, yy, 'Lieblingssegen');
    yy += 9;
    const fav = argMax(Object.fromEntries(Object.entries(S.boons).filter(([id]) => boonIdEls(id)[0] === el || boonIdEls(id)[1] === el)));
    if (fav) {
      for (const l of wrapText(boonIdName(fav[0]), rw, 6.5, { bold: true })) { text(l, cx, yy, { size: 6.5, bold: true, align: 'center', color: E.light }); yy += 8; }
      text(`${fav[1]}× gewählt`, cx, yy, { size: 5, align: 'center', color: '#7aa8a4' });
    } else text('noch keiner', cx, yy, { size: 5.5, align: 'center', color: '#5a7a78', italic: true });
  });
}

function drawChronikEnemies(S) {
  const y0 = CH.y + 50, x0 = CH.x + 12;
  const nem = argMax(S.killedBy);
  const cw = 104, chh = 88;
  ENEMY_ORDER.forEach((id, i) => {
    const col = i % 4, rowI = Math.floor(i / 4);
    const x = x0 + col * (cw + 4) + (rowI === 1 ? (cw + 4) / 2 : 0), y = y0 + rowI * (chh + 6);
    const isNem = nem && nem[0] === id;
    const color = id === 'boss' ? '#ff8a5a' : isNem ? '#ff6a5a' : CHRONIK_COLOR;
    roundRect(x, y, cw, chh, 4);
    ctx.fillStyle = gLin(0, y, 0, y + chh, [[0, hexA(color, 0.12)], [1, 'rgba(0,0,0,0.3)']]);
    ctx.fill();
    ctx.strokeStyle = hexA(color, isNem ? 0.9 : 0.35);
    ctx.lineWidth = isNem ? 1 : 0.6;
    ctx.stroke();
    if (isNem) {
      ctx.letterSpacing = '1px';
      text('ERZFEIND', x + cw / 2, y + 3.5, { size: 4.8, bold: true, align: 'center', color: '#ff7a6a' });
      ctx.letterSpacing = '0px';
    }
    shadowEllipse(x + cw / 2, y + 38, 9, 2.5, 0.4);
    drawEnemyIcon(id, x + cw / 2, y + 38, 2);
    text(enemyName(id), x + cw / 2, y + 42, { size: 7, title: true, align: 'center', color: id === 'boss' ? '#ffc8a0' : '#e8fffb' });
    chRow(x + 8, y + 56, cw - 16, 'Besiegt', fmtNum(S.killsBy[id] || 0), '#8affb8');
    chRow(x + 8, y + 66, cw - 16, 'Hat dich besiegt', fmtNum(S.killedBy[id] || 0), '#ff8a7a');
  });
  const spikes = S.killedBy.spike || 0;
  text(`Durch Stachelfallen gefallen: ${spikes}×`, VIEW_W / 2, y0 + 2 * (chh + 6) - 3, { size: 5.5, align: 'center', color: '#7aa8a4' });
}

function drawChronikHistory(S) {
  const y0 = CH.y + 50, x0 = CH.x + 12, w = CH.w - 24;
  chHeading(x0 + 22, y0, 'Waffe');
  chHeading(x0 + 120, y0, 'Ergebnis');
  chHeading(x0 + 248, y0, 'Element');
  chHeading(x0 + 296, y0, 'Gegner');
  chHeading(x0 + 336, y0, 'Zeit');
  chHeading(x0 + 376, y0, 'Wann');
  S.history.slice(0, 10).forEach((h, i) => {
    const y = y0 + 9 + i * 18;
    const won = h.res === 'win';
    roundRect(x0, y, w, 16, 3);
    ctx.fillStyle = won ? 'rgba(255,216,106,0.1)' : i % 2 ? 'rgba(95,208,200,0.05)' : 'rgba(0,0,0,0.25)';
    ctx.fill();
    if (won) { ctx.strokeStyle = 'rgba(255,216,106,0.5)'; ctx.lineWidth = 0.6; ctx.stroke(); }
    drawWeaponIcon(h.w, x0 + 10, y + 8, 0.75);
    text(WEAPONS[h.w].name, x0 + 22, y + 5, { size: 6, bold: true, color: WEAPONS[h.w].color });
    const res = won ? 'Sieg über Grimmhorn' : h.res === 'death' ? `Gefallen in Kammer ${h.depth}` : `Aufgegeben in Kammer ${h.depth}`;
    text(res, x0 + 120, y + 2, { size: 6, bold: true, color: won ? '#ffd86a' : h.res === 'death' ? '#ff8a7a' : '#9a9aa8' });
    chBar(x0 + 120, y + 11, 110, h.depth / RUN.rooms, won ? '#ffd86a' : '#ff8a7a');
    if (h.el) drawEmblem(h.el, x0 + 258, y + 8, 4.5); else text('–', x0 + 258, y + 5, { size: 6, align: 'center', color: '#5a7a78' });
    text(fmtNum(h.kills), x0 + 296, y + 5, { size: 6, color: '#e8fffb' });
    text(fmtTime(h.time), x0 + 336, y + 5, { size: 6, color: '#e8fffb' });
    text(fmtAgo(h.date), x0 + 376, y + 5, { size: 5.5, color: '#7aa8a4' });
  });
  if (!S.history.length) text('Noch keine Läufe.', VIEW_W / 2, 120, { size: 7, align: 'center', color: '#7aa8a4' });
}
