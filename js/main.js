'use strict';
// ===== Spielablauf: Zustände, Zuflucht, Kammern, Spielschleife =====
const GAME_VERSION = '0.1.0';

function loadStats() {
  const def = { runs: 0, wins: 0, best: 0, kills: 0, weapon: 'sword' };
  try { return Object.assign(def, JSON.parse(localStorage.getItem('hexenpfad-stats') || '{}')); } catch (err) { return def; }
}
const game = {
  state: 'title', stateT: 0, mode: 'hub', time: 0,
  room: null, player: null,
  enemies: [], pprojs: [], eprojs: [], zones: [], pickups: [], warnings: [], interact: [],
  depth: 0, run: null, cam: { x: 0, y: 0, shake: 0 }, hitstop: 0, timeScale: 1,
  fade: null, banner: null, overlay: null, menuSel: 0, corpse: null, ambientT: 0,
  stats: loadStats(),
};
function saveStats() { localStorage.setItem('hexenpfad-stats', JSON.stringify(game.stats)); }
function shake(n) { game.cam.shake = Math.max(game.cam.shake, n); }
function showBanner(txt, sub, color, dur = 2.4) { game.banner = { text: txt, sub, color, t: 0, dur }; }
function setGameState(s) { game.state = s; game.stateT = 0; }
const newRunStats = () => ({ kills: 0, dmg: 0, taken: 0, time: 0 });

function clearWorld() {
  game.enemies = []; game.pprojs = []; game.eprojs = []; game.zones = [];
  game.pickups = []; game.warnings = []; game.interact = []; game.corpse = null;
  game.timeScale = 1;
  FX.reset();
}
function placePlayer(x, y) {
  const p = game.player;
  p.x = x; p.y = y; p.vx = p.vy = 0; p.act = null; p.dashT = 0;
  updateCamera(10);
}
function fadeTo(cb) {
  if (game.fade) return;
  game.fade = { t: 0, phase: 'out', cb };
}

// ---------- Zuflucht ----------
function startHub() {
  clearWorld();
  game.mode = 'hub';
  game.depth = 0;
  game.run = newRunStats();
  game.player = makePlayer(game.stats.weapon);
  game.room = buildHub();
  const xs = [88, 152, 328, 392];
  WEAPON_ORDER.forEach((id, i) => {
    game.interact.push({
      kind: 'pedestal', weapon: id, x: xs[i], y: 176, r: 14,
      label: () => (game.player.weapon === id ? `${WEAPONS[id].name} (ausgerüstet)` : `[E] ${WEAPONS[id].name} nehmen`),
      use() {
        const p = game.player;
        if (p.weapon === id) return;
        p.weapon = id;
        p.act = null; p.combo = 0; p.charge = 0;
        game.stats.weapon = id;
        saveStats();
        Sound.play('pickup');
        FX.burst(p.x, p.y - 10, WEAPONS[id].color, 16, 70, 0.5, 2, { glow: 5 });
      },
    });
  });
  game.enemies.push(makeDummy(128, 104), makeDummy(352, 104));
  placePlayer(game.room.entry.x, game.room.entry.y);
  Sound.music('hub');
}

// ---------- Lauf ----------
function startRun() {
  const w = game.player.weapon;
  game.stats.runs++;
  saveStats();
  game.player = makePlayer(w);
  game.mode = 'run';
  game.depth = 0;
  game.run = newRunStats();
  enterRoom({ kind: 'combat', reward: { type: 'boon', el: pick(ELEMENT_ORDER) } });
}
function enterRoom(spec) {
  clearWorld();
  game.depth++;
  spec.next = spec.kind === 'boss' ? [] : rollDoorSpecs(game.depth + 1);
  game.room = generateRoom(spec, game.depth);
  const room = game.room;
  room.fight = ['combat', 'elite', 'guardian'].includes(spec.kind);
  room.cleared = !room.fight;
  room.waves = room.fight ? planWaves(game.depth, spec.kind) : null;
  room.wave = 0;
  room.waveT = 0;
  placePlayer(room.entry.x, room.entry.y);
  game.player.invuln = 0.6;
  if (spec.kind === 'boss') {
    game.enemies.push(makeBoss(room.pw / 2, room.ph / 2 - 10));
    Sound.music('boss');
    showBanner(BOSS.name, BOSS.title, '#ff8a5a', 2.6);
  } else Sound.music('run');
  if (spec.kind === 'shop') setupShop(room);
  if (spec.kind === 'spring') setupSpring(room);
  if (spec.kind === 'elite') showBanner('Gefahr', 'Stärkere Gegner, bessere Belohnung', '#ff6a5a', 1.8);
  if (spec.kind === 'guardian') showBanner('Wächterkammer', 'Überstehe drei harte Wellen', '#ff6a5a', 2.2);
  if (spec.kind === 'shop' || spec.kind === 'spring') openDoors(true);
  game.stats.best = Math.max(game.stats.best, game.depth);
  saveStats();
}
function rollDoorSpecs(d) {
  if (d > RUN.rooms) return [];
  if (d === RUN.rooms) return [{ kind: 'boss' }];
  if (d === RUN.guardianAt) return [{ kind: 'guardian', reward: { type: 'boon', el: pick(ELEMENT_ORDER), boost: 2 } }];
  const n = d <= 2 ? 2 : randi(2, 3);
  const specs = [];
  if (d === RUN.shopAt) specs.push({ kind: 'shop' });
  let guard = 0;
  while (specs.length < n && guard++ < 200) {
    const type = weightedPick(Object.keys(REWARDS), (k) => REWARDS[k].w);
    const p = game.player;
    if (type === 'forge' && WEAPON_MODS[p.weapon].every((m) => p.mods.has(m.id))) continue;
    if (type === 'star' && d <= 2) continue;
    if (REWARDS[type].room) {
      if (d < 3 || specs.some((s) => s.kind === 'shop' || s.kind === 'spring')) continue;
      if (type === 'shop' && Math.abs(d - RUN.shopAt) < 3) continue; // Händler nicht kurz vor/nach dem festen Händler
      specs.push({ kind: type });
      continue;
    }
    if (type !== 'boon' && specs.some((s) => s.reward && s.reward.type === type)) continue;
    const reward = { type };
    if (type === 'boon') {
      const used = specs.filter((s) => s.reward && s.reward.type === 'boon').map((s) => s.reward.el);
      reward.el = pick(ELEMENT_ORDER.filter((e) => !used.includes(e)));
    }
    const elite = d >= RUN.eliteFrom && chance(RUN.eliteChance);
    if (elite) reward.boost = 1;
    specs.push({ kind: elite ? 'elite' : 'combat', reward });
  }
  return shuffle(specs);
}

function updateRoom(dt) {
  const room = game.room;
  if (room.fight && !room.cleared) {
    room.waveT += dt;
    const alive = game.enemies.filter((e) => !e.dead && !e.dummy).length;
    if (room.wave < room.waves.length) {
      const ready = room.wave === 0 ? room.waveT > 0.6 : alive === 0 || (alive <= 2 && room.waveT > 7);
      if (ready) { spawnWave(room.waves[room.wave]); room.wave++; room.waveT = 0; }
    } else if (alive === 0) roomCleared();
  }
  if (game.state !== 'play' || game.fade) return;
  const p = game.player;
  for (const d of room.doors) {
    if (d.open && Math.abs(p.x - d.x) < 13 && p.y < d.y + 10) { enterDoor(d); break; }
  }
}
function roomCleared() {
  const room = game.room;
  room.cleared = true;
  game.eprojs = [];
  Sound.play('clear');
  showBanner('Kammer gesäubert', null, '#c8f0d0', 1.6);
  const pos = findFloorNear(room, room.pw / 2, room.ph / 2 + 10);
  game.pickups.push({ type: 'reward', reward: room.spec.reward, x: pos.x, y: pos.y, t: 0 });
  FX.burst(pos.x, pos.y - 10, '#ffffff', 20, 100, 0.6, 2, { glow: 6 });
}
function openDoors(quiet) {
  for (const d of game.room.doors) d.open = true;
  if (!quiet && game.room.doors.length) Sound.play('door');
}
function enterDoor(d) {
  Sound.play('door');
  fadeTo(() => { if (d.spec.kind === 'start') startRun(); else enterRoom(d.spec); });
}

// ---------- Belohnungen ----------
function collectReward(r, from) {
  const p = game.player;
  Sound.play('pickup');
  FX.burst(from.x, from.y - 12, doorColor({ kind: 'combat', reward: r }), 20, 90, 0.6, 2.5, { glow: 6 });
  const done = () => openDoors();
  const fallbackGold = () => { p.gold += 60; FX.text(p.x, p.y - 28, '+60 Gold', '#ffd24a', 8); done(); };
  if (r.type === 'boon') openChoice(`${ELEMENTS[r.el].name}-Segen`, 'Wähle einen Segen', ELEMENTS[r.el].color, boonOptions(r.el, r.boost || 0), done);
  else if (r.type === 'gold') {
    const n = randi(...REWARD_VALUES.gold) + game.depth * 3;
    p.gold += n;
    FX.text(p.x, p.y - 28, `+${n} Gold`, '#ffd24a', 8);
    Sound.play('coin');
    done();
  } else if (r.type === 'heart') {
    p.maxHp += REWARD_VALUES.heart;
    healPlayer(REWARD_VALUES.heart);
    Sound.play('heal');
    showBanner('Lebensfrucht', `+${REWARD_VALUES.heart} maximales Leben`, '#ff8a9a', 1.6);
    done();
  } else if (r.type === 'forge') {
    const o = forgeOptions();
    if (o.length) openChoice('Waffenschmiede', `Verbessere ${WEAPONS[p.weapon].name}`, WEAPONS[p.weapon].color, o, done); else fallbackGold();
  } else if (r.type === 'star') {
    const o = starOptions();
    if (o.length) openChoice('Sternsplitter', 'Verstärke einen deiner Segen', '#fff6a0', o, done); else fallbackGold();
  }
}
function openChoice(title, sub, color, options, onDone) {
  game.overlay = { title, sub, color, options, onDone, t: 0, sel: -1 };
  setGameState('choice');
}
function updateChoice(dt) {
  const o = game.overlay;
  o.t += dt;
  const L = choiceLayout(o.options.length);
  let hover = -1;
  o.options.forEach((_, i) => {
    const x = L.x0 + i * (L.cw + L.gap);
    if (Input.mx >= x && Input.mx <= x + L.cw && Input.my >= L.y && Input.my <= L.y + L.h) hover = i;
  });
  if (hover >= 0 && hover !== o.sel) { o.sel = hover; Sound.play('select'); }
  if (Input.hit('ArrowLeft') || Input.hit('KeyA')) { o.sel = Math.max(0, o.sel - 1); Sound.play('select'); }
  if (Input.hit('ArrowRight') || Input.hit('KeyD')) { o.sel = Math.min(o.options.length - 1, o.sel + 1); Sound.play('select'); }
  if (o.t < 0.35) return; // kurz warten, damit man nicht aus Versehen wählt
  let choose = -1;
  ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (Input.hit(k) && i < o.options.length) choose = i; });
  if (Input.clicked[0] && hover >= 0) choose = hover;
  if ((Input.hit('Enter') || Input.hit('KeyE')) && o.sel >= 0) choose = o.sel;
  if (choose < 0) return;
  o.options[choose].apply();
  Sound.play('choose');
  game.overlay = null;
  setGameState('play');
  const p = game.player;
  p.blockAtk = true;
  FX.burst(p.x, p.y - 10, o.color || '#ffffff', 18, 80, 0.6, 2, { glow: 5 });
  if (o.onDone) o.onDone();
}

// ---------- Händler und Quelle ----------
function setupShop(room) {
  const items = [SHOP_ITEMS[0], ...shuffle(SHOP_ITEMS.slice(1)).slice(0, 2)];
  items.forEach((it, i) => {
    const el = it.id === 'boon' ? pick(ELEMENT_ORDER) : null;
    const name = el ? `${ELEMENTS[el].name}-Segen` : it.name;
    game.interact.push({
      kind: 'shop', item: it, el, x: room.pw / 2 + (i - 1) * 56, y: room.ph / 2 + 4, r: 14, sold: false,
      label() { return this.sold ? 'Verkauft' : `[E] ${name} kaufen (${it.cost} Gold)`; },
      sub() { return this.sold ? null : it.desc; },
      use() {
        const p = game.player;
        if (this.sold) return;
        if (p.gold < it.cost) { Sound.play('armor'); FX.text(p.x, p.y - 26, 'Zu wenig Gold', '#ff8a8a', 6); return; }
        p.gold -= it.cost;
        this.sold = true;
        Sound.play('coin');
        buyItem(it, el);
      },
    });
  });
  showBanner('Händlerschrein', 'Tausche Gold gegen Macht', '#ffd24a', 2);
}
function buyItem(it, el) {
  const p = game.player;
  const refund = () => { p.gold += it.cost; FX.text(p.x, p.y - 26, 'Nichts zu verbessern', '#ff8a8a', 6); };
  if (it.id === 'boon') openChoice(`${ELEMENTS[el].name}-Segen`, 'Wähle einen Segen', ELEMENTS[el].color, boonOptions(el), null);
  else if (it.id === 'heal') { healPlayer(p.maxHp * 0.5); Sound.play('heal'); }
  else if (it.id === 'heart') { p.maxHp += REWARD_VALUES.heart; healPlayer(REWARD_VALUES.heart); Sound.play('heal'); }
  else if (it.id === 'star') { const o = starOptions(); if (o.length) openChoice('Sternsplitter', 'Verstärke einen deiner Segen', '#fff6a0', o, null); else refund(); }
  else if (it.id === 'forge') { const o = forgeOptions(); if (o.length) openChoice('Waffenschmiede', `Verbessere ${WEAPONS[p.weapon].name}`, WEAPONS[p.weapon].color, o, null); else refund(); }
}
function setupSpring(room) {
  game.interact.push({
    kind: 'spring', x: room.pw / 2, y: room.ph / 2 + 6, r: 18, used: false,
    label() { return this.used ? 'Die Quelle ist versiegt' : `[E] Aus der Heilquelle trinken (+${Math.round(REWARD_VALUES.spring * 100)}% Leben)`; },
    sub() { return null; },
    use() {
      if (this.used) return;
      this.used = true;
      healPlayer(game.player.maxHp * REWARD_VALUES.spring);
      Sound.play('heal');
      FX.burst(this.x, this.y - 6, '#7affc8', 24, 80, 0.8, 2, { up: 30, glow: 6 });
    },
  });
  showBanner('Heilquelle', 'Ein Ort der Ruhe', '#7affc8', 2);
}
function nearestInteract() {
  const p = game.player;
  let best = null, bd = Infinity;
  for (const it of game.interact) {
    const d = dist(p.x, p.y, it.x, it.y);
    if (d < it.r + 10 && d < bd) { bd = d; best = it; }
  }
  return best;
}
function drawInteract(it) {
  const t = game.time;
  if (it.kind === 'pedestal' || it.kind === 'shop') {
    shadowEllipse(it.x, it.y, 11, 3, 0.4);
    ctx.fillStyle = '#4c3b5e';
    ctx.fillRect(it.x - 9, it.y - 9, 18, 9);
    ctx.fillStyle = '#6a557e';
    ctx.fillRect(it.x - 10, it.y - 11, 20, 3);
    ctx.fillStyle = '#2b2038';
    ctx.fillRect(it.x - 9, it.y - 2, 18, 2);
  }
  if (it.kind === 'pedestal') {
    const W = WEAPONS[it.weapon];
    const spr = SPR[it.weapon];
    const [gx, gy] = WEAPON_GRIP[it.weapon];
    const bob = Math.sin(t * 2 + it.x) * 1.5;
    const ang = -Math.PI / 4 + Math.sin(t * 1.3 + it.x) * 0.1;
    const len = spr.w - gx;
    drawRotated(spr, it.x - Math.cos(ang) * len * 0.45, it.y - 22 + bob - Math.sin(ang) * len * 0.45, ang, gx, gy, { alpha: game.player.weapon === it.weapon ? 0.35 : 1 });
    text(W.name, it.x, it.y + 2, { size: 5, align: 'center', color: W.color });
  } else if (it.kind === 'shop') {
    if (!it.sold) {
      const bob = Math.sin(t * 2 + it.x) * 1.5;
      if (it.el) drawElIcon(it.el, it.x, it.y - 20 + bob, 6);
      else drawTypeIcon(it.item.id, null, it.x, it.y - 20 + bob);
      text(`${it.item.cost}`, it.x, it.y + 2, { size: 6, align: 'center', color: game.player.gold >= it.item.cost ? '#ffe48a' : '#a07a6a', bold: true });
    }
  } else if (it.kind === 'spring') {
    shadowEllipse(it.x, it.y + 2, 20, 6, 0.4);
    ctx.fillStyle = '#52614f';
    ctx.beginPath();
    ctx.ellipse(it.x, it.y - 2, 19, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = it.used ? '#2a3530' : '#2a8a78';
    ctx.beginPath();
    ctx.ellipse(it.x, it.y - 3, 15, 6.5, 0, 0, TAU);
    ctx.fill();
    if (!it.used) {
      ctx.strokeStyle = 'rgba(200,255,240,0.6)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 2; i++) {
        const k = ((t * 0.6 + i * 0.5) % 1);
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.ellipse(it.x, it.y - 3, 14 * k, 6 * k, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}
function drawInteractLight(it) {
  if (it.kind === 'pedestal') glow(it.x, it.y - 20, 26, WEAPONS[it.weapon].color, game.player.weapon === it.weapon ? 0.15 : 0.35);
  else if (it.kind === 'shop' && !it.sold) glow(it.x, it.y - 20, 22, it.el ? ELEMENTS[it.el].color : '#ffd24a', 0.35);
  else if (it.kind === 'spring' && !it.used) glow(it.x, it.y - 4, 40, '#7affc8', 0.35);
}

// ---------- Aufsammeln ----------
function updatePickups(dt) {
  const p = game.player;
  for (const pk of game.pickups) {
    pk.t += dt;
    if (pk.type === 'coin') {
      pk.vx = damp(pk.vx, 0, 5, dt);
      pk.vy = damp(pk.vy, 0, 5, dt);
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      const d = dist(pk.x, pk.y, p.x, p.y);
      if (pk.t > 0.4 && (game.room.cleared || d < 50)) {
        const a = Math.atan2(p.y - pk.y, p.x - pk.x), sp = 150 + pk.t * 60;
        pk.x += Math.cos(a) * sp * dt;
        pk.y += Math.sin(a) * sp * dt;
      }
      if (d < 8) { pk.done = true; p.gold++; Sound.play('coin'); }
    } else if (pk.type === 'reward' && game.state === 'play') {
      if (pk.t > 0.5 && dist(pk.x, pk.y, p.x, p.y) < 13) { pk.done = true; collectReward(pk.reward, pk); }
    }
  }
  game.pickups = game.pickups.filter((pk) => !pk.done);
}

// ---------- Tod und Sieg ----------
function playerDied() {
  const p = game.player;
  p.dead = true;
  setGameState('dying');
  game.timeScale = 0.3;
  Sound.play('die');
  FX.burst(p.x, p.y - 8, '#b583ff', 30, 100, 1, 2.5, { glow: 6 });
  game.stats.kills += game.run.kills;
  saveStats();
}
function bossDefeated(e) {
  game.run.kills++;
  game.corpse = { x: e.x, y: e.y, t: 0, fxT: 0 };
  setGameState('winning');
  game.timeScale = 0.4;
  Sound.play('roar');
  shake(8);
  game.eprojs = [];
  game.warnings = [];
  for (const o of game.enemies) if (!o.dead) { o.dead = true; FX.burst(o.x, o.y - 6, '#ffffff', 10, 60, 0.4, 2); }
  game.stats.wins++;
  game.stats.kills += game.run.kills;
  saveStats();
}

// ---------- Pause ----------
function pauseItems() {
  return ['Weiter', `Ton: ${Sound.muted ? 'aus' : 'an'}`, `Musik: ${Sound.musicOn ? 'an' : 'aus'}`, game.mode === 'run' ? 'Lauf aufgeben' : 'Zum Titelbild'];
}
function updatePause() {
  const items = pauseItems();
  const h = menuHover(items.length);
  if (h >= 0) game.menuSel = h;
  if (Input.hit('ArrowDown') || Input.hit('KeyS')) game.menuSel = (game.menuSel + 1) % items.length;
  if (Input.hit('ArrowUp') || Input.hit('KeyW')) game.menuSel = (game.menuSel + items.length - 1) % items.length;
  let act = -1;
  if (Input.hit('Enter') || Input.hit('KeyE')) act = game.menuSel;
  if (Input.clicked[0] && h >= 0) act = h;
  if (Input.hit('Escape') || Input.hit('KeyP')) act = 0;
  if (act < 0) return;
  Sound.play('select');
  if (act === 0) { setGameState('play'); game.player.blockAtk = true; }
  else if (act === 1) Sound.toggleMute();
  else if (act === 2) Sound.toggleMusic();
  else if (act === 3) {
    if (game.mode === 'run') {
      game.stats.kills += game.run.kills;
      saveStats();
      setGameState('play');
      fadeTo(startHub);
    } else setGameState('title');
  }
}

// ---------- Kamera ----------
function updateCamera(dt) {
  const p = game.player, room = game.room, c = game.cam;
  const lead = game.state === 'play' ? 0.12 : 0;
  let tx = p.x - VIEW_W / 2 + (Input.mx - VIEW_W / 2) * lead;
  let ty = p.y - 10 - VIEW_H / 2 + (Input.my - VIEW_H / 2) * lead;
  tx = room.pw <= VIEW_W ? (room.pw - VIEW_W) / 2 : clamp(tx, 0, room.pw - VIEW_W);
  ty = room.ph <= VIEW_H ? (room.ph - VIEW_H) / 2 : clamp(ty, 0, room.ph - VIEW_H);
  c.x = damp(c.x, tx, 9, dt);
  c.y = damp(c.y, ty, 9, dt);
  c.shake = damp(c.shake, 0, 9, dt);
  if (c.shake < 0.1) c.shake = 0;
}

// ---------- Aktualisieren ----------
function stepWorld(dt) {
  if (game.fade && game.fade.phase === 'out') return;
  if (game.hitstop > 0) { game.hitstop -= dt; return; }
  dt *= game.timeScale;
  const p = game.player;
  if (game.state === 'play') updatePlayer(p, dt);
  updateZones(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateWarnings(dt);
  updatePickups(dt);
  if (game.room.spikes.length) updateSpikes(game.room, dt);
  updateRoom(dt);
  if (game.mode === 'run' && game.state === 'play') game.run.time += dt;
  if (game.state === 'play') {
    const it = nearestInteract();
    if (it && Input.hit('KeyE')) it.use();
  }
  if (game.corpse) {
    const c = game.corpse;
    c.t += dt;
    c.fxT -= dt;
    if (c.fxT <= 0 && c.t < 1.6) {
      c.fxT = 0.12;
      FX.burst(c.x + rand(-24, 24), c.y - rand(10, 50), pick(['#ff8a3a', '#ffe08a', '#ffffff']), 12, 90, 0.5, 3, { glow: 8 });
      Sound.play('boom');
      shake(4);
    }
  }
  // schwebende Funken für Stimmung
  game.ambientT -= dt;
  if (game.ambientT <= 0) {
    game.ambientT = 0.12;
    const th = THEMES[game.room.theme];
    FX.burst(game.cam.x + rand(0, VIEW_W), game.cam.y + rand(20, VIEW_H + 20), th.torch, 1, 6, 4, 1, { up: 8, drag: 0.2, glow: 4 });
  }
  FX.update(dt);
}

function update(dt) {
  game.time += dt;
  game.stateT += dt;
  if (game.banner) { game.banner.t += dt; if (game.banner.t > game.banner.dur) game.banner = null; }
  if (game.fade) {
    const f = game.fade;
    f.t += dt;
    if (f.phase === 'out' && f.t >= 0.25) { f.cb(); f.phase = 'in'; f.t = 0; }
    else if (f.phase === 'in' && f.t >= 0.3) game.fade = null;
  }
  switch (game.state) {
    case 'title':
      FX.update(dt);
      if (Input.any && game.stateT > 0.3) {
        Sound.init();
        Sound.music(game.mode === 'run' ? 'run' : 'hub');
        setGameState('play');
        game.player.blockAtk = true;
      }
      break;
    case 'play':
      if (Input.hit('Escape') || Input.hit('KeyP')) { setGameState('pause'); game.menuSel = 0; break; }
      stepWorld(dt);
      break;
    case 'choice': updateChoice(dt); break;
    case 'pause': updatePause(); break;
    case 'dying':
    case 'winning':
      stepWorld(dt);
      if (game.stateT > 1.8) setGameState(game.state === 'dying' ? 'dead' : 'victory');
      break;
    case 'dead':
    case 'victory':
      FX.update(dt * 0.3);
      if (game.stateT > 1 && !game.fade && (Input.clicked[0] || Input.hit('Enter') || Input.hit('KeyE') || Input.hit('Space'))) fadeTo(() => { startHub(); setGameState('play'); game.player.blockAtk = true; });
      break;
  }
  updateCamera(dt);
}

// ---------- Zeichnen ----------
let vignette = null;
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const room = game.room, p = game.player, c = game.cam;
  ctx.fillStyle = THEMES[room.theme].bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sx = c.shake ? rand(-c.shake, c.shake) : 0, sy = c.shake ? rand(-c.shake, c.shake) : 0;
  const cx = Math.round((c.x + sx) * S) / S, cy = Math.round((c.y + sy) * S) / S;
  ctx.setTransform(S, 0, 0, S, -cx * S, -cy * S);
  ctx.drawImage(room.cache, 0, 0);
  drawFloorDynamic(room);
  drawZones();
  for (const e of game.enemies) drawTelegraph(e);
  drawWarnings();

  // nach unten sortiert zeichnen (wer weiter unten steht, ist vorne)
  const list = [];
  for (const pl of room.pillars) list.push({ y: pl.y + pl.h, d: () => drawPillar(room, pl) });
  for (const e of game.enemies) list.push({ y: e.y, d: () => drawEnemy(e) });
  for (const it of game.interact) list.push({ y: it.y, d: () => drawInteract(it) });
  for (const pk of game.pickups) list.push({ y: pk.y, d: () => drawPickup(pk) });
  if (!p.dead) list.push({ y: p.y, d: () => { FX.drawGhosts(); drawPlayer(p); } });
  if (game.corpse && game.state === 'winning') {
    const k = game.corpse;
    list.push({ y: k.y, d: () => drawSprite(SPR.boss, k.x, k.y, { scale: 2, white: Math.floor(k.t * 12) % 2 === 0, alpha: clamp(1.8 - k.t, 0, 1) }) });
  }
  list.sort((a, b) => a.y - b.y).forEach((o) => o.d());
  drawProjectiles();
  FX.draw();

  // Licht
  drawRoomLights(room);
  drawZoneLights();
  drawProjectileLights();
  for (const e of game.enemies) if (!e.dead) drawEnemyLights(e);
  for (const pk of game.pickups) drawPickupLight(pk);
  for (const it of game.interact) drawInteractLight(it);
  if (!p.dead) drawPlayerLights(p);
  FX.drawLights();
  FX.drawTexts();

  // Bildschirm-Ebene
  ctx.setTransform(S, 0, 0, S, 0, 0);
  if (!vignette) {
    vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 90, VIEW_W / 2, VIEW_H / 2, 290);
    vignette.addColorStop(0, 'rgba(4,2,8,0)');
    vignette.addColorStop(1, 'rgba(4,2,8,0.75)');
  }
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const low = game.mode === 'run' && p.hp / p.maxHp < 0.3 && !p.dead;
  if (p.hurtFlash > 0 || low) {
    const a = Math.max(p.hurtFlash * 1.2, low ? 0.18 + Math.sin(game.time * 5) * 0.08 : 0);
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 100, VIEW_W / 2, VIEW_H / 2, 280);
    g.addColorStop(0, 'rgba(200,0,20,0)');
    g.addColorStop(1, `rgba(200,0,20,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  const st = game.state;
  if (st !== 'title') {
    drawHUD();
    drawBossBar();
    if (game.mode === 'hub') drawHubInfo();
  }
  if (st === 'play' && !game.fade) {
    const it = nearestInteract();
    if (it) {
      if (it.kind === 'pedestal') drawWeaponCard(it.weapon);
      drawPrompt(it.label(), it.sub ? it.sub() : null);
    } else {
      const d = room.doors.find((dd) => Math.abs(p.x - dd.x) < 30 && p.y < dd.y + 46);
      if (d && d.spec) drawPrompt(rewardLabel(d.spec), d.open ? null : 'Öffnet sich, wenn die Kammer gesäubert ist');
    }
  }
  drawBanner();
  if (st === 'play' && Input.isDown('Tab')) drawBoonPanel();
  if (st === 'title') drawTitle();
  else if (st === 'choice') drawChoice();
  else if (st === 'pause') drawMenu('Pause', pauseItems(), game.menuSel, `Hexenpfad ${GAME_VERSION}`);
  else if (st === 'dead') drawEndScreen(false);
  else if (st === 'victory') drawEndScreen(true);
  if (game.fade) {
    const f = game.fade;
    ctx.fillStyle = `rgba(4,2,8,${f.phase === 'out' ? f.t / 0.25 : 1 - f.t / 0.3})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  drawCursor();
}

// ---------- Start ----------
addEventListener('blur', () => { if (game.state === 'play') { setGameState('pause'); game.menuSel = 0; } });
startHub();
setGameState('title');
let lastFrame = performance.now();
function frame(now) {
  const dt = clamp((now - lastFrame) / 1000, 0, 0.05);
  lastFrame = now;
  update(dt);
  render();
  Input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
