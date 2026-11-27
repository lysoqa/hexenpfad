'use strict';
// ===== Kampf: Schaden, Element-Effekte, Segen, Bodenzonen, Geschosse =====

// ---------- Segen ----------
// Segen-Objekt: { id, kind: 'slot'|'passive'|'duo', el, slot?, rar, level }
function boonDef(b) {
  if (b.kind === 'slot') return SLOT_BOONS[b.el][b.slot];
  return b.kind === 'passive' ? PASSIVES[b.id] : DUOS[b.id];
}
function boonVal(b) {
  const lm = 1 + LEVEL_STEP * (b.level - 1);
  const rm = RARITY[b.rar].mult;
  if (b.kind === 'slot') return Math.round((b.slot === 'dash' ? DASH_BASE[b.el] : SLOT_BASE[b.slot]) * rm * lm);
  const def = boonDef(b);
  if (def.int) return def.base * b.level;
  return Math.round(def.base * rm * lm);
}
const boonName = (b) => boonDef(b).name;
const boonDesc = (b) => boonDef(b).desc.replace('{v}', boonVal(b));
function boonEls(b) { return b.kind === 'duo' ? DUOS[b.id].els : [b.el]; }
function allBoons(p = game.player) {
  return [...SLOTS.map((s) => p.boons[s]).filter(Boolean), ...Object.values(p.passives)];
}
// Element-Stufe: Summe der Stufen aller Segen dieses Elements
function resonance(el) {
  if (!game.player) return 0;
  let n = 0;
  for (const b of allBoons()) if (boonEls(b).includes(el)) n += b.level;
  return n;
}
const elMult = (el) => 1 + STATUS.resoStep * Math.max(0, resonance(el) - 1);
const has = (id) => !!(game.player && game.player.passives[id]);
const pv = (id) => (has(id) ? boonVal(game.player.passives[id]) : 0);
function slotPower(slot) {
  const b = game.player.boons[slot];
  return b ? RARITY[b.rar].mult * (1 + LEVEL_STEP * (b.level - 1)) : 0;
}

// ---------- Zustände auf Gegnern ----------
function addBurn(e, n) {
  const max = STATUS.burnMax + resonance('fire');
  if (e.burn <= 0) e.burnTick = 0.5;
  e.burn = Math.min(max, e.burn + n);
  e.burnT = STATUS.burnDur;
}
function addFrost(e, n) {
  e.chillT = STATUS.chillDur;
  if (e.freezeT > 0) return;
  if (has('duo_grave') && e.markT > 0) n *= 2;
  e.frost += n;
  if (e.frost >= STATUS.freezeAt) {
    e.frost = 0;
    e.freezeT = (STATUS.freezeDur + 0.15 * Math.max(0, resonance('frost') - 1)) * (e.boss ? 0.35 : 1);
    Sound.play('freeze');
    FX.burst(e.x, e.y - 6, '#bff0ff', 10, 60, 0.4, 2);
    if (has('duo_grave')) markEnemy(e);
  }
}
function markEnemy(e) {
  if (e.markT <= 0) Sound.play('mark');
  e.markT = STATUS.markDur;
}
const chillSlow = () => Math.min(0.6, STATUS.chillSlow + 0.05 * Math.max(0, resonance('frost') - 1));
const markBonus = () => STATUS.markBonus + 0.04 * Math.max(0, resonance('shadow') - 1) + pv('shadow_deep') / 100;

function chainLightning(src, dmg, jumps) {
  if (has('duo_super') && src.chillT > 0) { jumps += pv('duo_super'); dmg *= 1.5; }
  const hit = new Set([src]);
  FX.bolt(src.x + rand(-6, 6), src.y - 40, src.x, src.y - 6);
  damageEnemy(src, dmg * 0.6, 'elem');
  if (has('duo_plasma')) addBurn(src, pv('duo_plasma'));
  let cur = src;
  for (let i = 0; i < jumps; i++) {
    let best = null, bd = STATUS.chainRange;
    for (const e of game.enemies) {
      if (e.dead || hit.has(e) || e.spawnT > 0 || e.dummy !== src.dummy) continue;
      const d = dist(cur.x, cur.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) break;
    FX.bolt(cur.x, cur.y - 6, best.x, best.y - 6);
    hit.add(best);
    damageEnemy(best, dmg, 'elem');
    if (has('duo_plasma')) addBurn(best, pv('duo_plasma'));
    cur = best;
  }
  Sound.play('zap');
}
function applyElement(e, el, src) {
  if (e.dead && !e.dummy) return;
  const big = src === 'special';
  if (el === 'fire') addBurn(e, big ? 2 : 1);
  else if (el === 'frost') addFrost(e, big ? 2 : 1);
  else if (el === 'storm') {
    const jumps = STATUS.chainJumps + Math.floor(Math.max(0, resonance('storm') - 1) / 2) + pv('storm_chain');
    chainLightning(e, STATUS.chainDmg * elMult('storm') * (big ? 1.6 : 1), jumps);
  } else if (el === 'shadow') markEnemy(e);
}

// ---------- Schaden an Gegnern ----------
// src: 'attack' | 'special' | 'cast' | 'dash' | 'elem' | 'burn' | 'trap'
function damageEnemy(e, base, src, o = {}) {
  if ((e.dead && !e.dummy) || e.spawnT > 0 || e.invuln > 0) return 0;
  const p = game.player;
  let dmg = base;
  const slotB = p.boons[src];
  if (slotB && src !== 'dash') dmg *= 1 + boonVal(slotB) / 100;
  if ((src === 'attack' || src === 'special') && p.shadowStep > 0 && p.boons.dash && p.boons.dash.el === 'shadow') {
    dmg *= 1 + boonVal(p.boons.dash) / 100;
    p.shadowStep = 0;
    markEnemy(e);
    FX.burst(e.x, e.y - 6, ELEMENTS.shadow.color, 10, 70, 0.4, 2);
  }
  if (e.markT > 0 && src !== 'burn') dmg *= 1 + markBonus();
  if (e.freezeT > 0 && has('frost_shatter')) dmg *= 1 + pv('frost_shatter') / 100;
  if (e.burn > 0 && has('fire_heat') && src !== 'burn') dmg *= 1 + pv('fire_heat') / 100;
  let crit = false;
  if (e.markT > 0 && has('shadow_crit') && src !== 'burn' && chance(pv('shadow_crit') / 100)) { dmg *= 3; crit = true; }
  dmg = Math.max(1, Math.round(dmg));

  // Panzer fängt Schaden zuerst ab
  let armorHit = false;
  if (e.armor > 0) {
    const a = Math.min(e.armor, dmg);
    e.armor -= a;
    dmg -= a;
    armorHit = true;
    if (e.armor <= 0) { FX.burst(e.x, e.y - 8, '#c8c8d8', 14, 90, 0.5, 2); Sound.play('heavy'); FX.text(e.x, e.y - e.h - 6, 'GEBROCHEN', '#e0e0ff', 6); }
  }
  e.hp -= dmg;
  e.flash = 0.09;
  game.run.dmg += dmg;
  if (!e.dummy) game.run.maxHit = Math.max(game.run.maxHit, dmg);

  const small = src === 'burn' || src === 'elem';
  const col = crit ? '#ffef5a' : src === 'burn' ? '#ff9a4a' : armorHit ? '#c8c8d8' : small ? '#fff3b0' : '#ffffff';
  FX.text(e.x, e.y - e.h - 2, crit ? `${dmg}!` : dmg || '·', col, crit ? 9 : small ? 5.5 : 7);
  if (!small) {
    FX.burst(e.x, e.y - e.h / 2, armorHit ? '#d8d8e8' : e.blood || '#ffffff', 5, 70, 0.25, 2, { ang: o.ang, spread: 0.9 });
    Sound.play(crit ? 'crit' : armorHit ? 'armor' : 'hit');
  }
  if (o.kb && !e.boss && e.armor <= 0 && !e.dummy) {
    const k = o.kb * (e.heavyKb || 1);
    e.kbx += Math.cos(o.ang) * k;
    e.kby += Math.sin(o.ang) * k;
  }
  if (o.heavy) { game.hitstop = Math.max(game.hitstop, 0.055); shake(2.5); }
  else if (!small) game.hitstop = Math.max(game.hitstop, 0.025);

  // Element aus dem passenden Segen
  if (slotB && src !== 'dash') applyElement(e, slotB.el, src);
  // Dampfstoß (Feuer + Frost)
  if (has('duo_steam') && e.freezeT > 0 && !small) {
    e.freezeT = 0;
    explodeAt(e.x, e.y - 4, 30, pv('duo_steam'), '#e8f4ff', 'elem');
  }
  if (e.dummy) { if (e.hp < 1) e.hp = e.maxHp; return dmg; }
  if (e.hp <= 0 && !e.dead) killEnemy(e);
  return dmg;
}

function explodeAt(x, y, r, dmg, color, src = 'elem', o = {}) {
  FX.ring(x, y, 4, r, color, 0.3, o.small ? 2 : 3);
  FX.burst(x, y, color, o.small ? 8 : 16, r * 3, 0.45, 2.5, { glow: 8 });
  Sound.play(o.small ? 'magic' : 'boom');
  for (const e of game.enemies) {
    if (e.dead && !e.dummy) continue;
    if (dist(x, y, e.x, e.y - 4) < r + e.r) damageEnemy(e, dmg, src, { ang: Math.atan2(e.y - y, e.x - x), kb: o.kb || 0, heavy: o.heavy });
  }
}

function killEnemy(e) {
  e.dead = true;
  if (e.boss) return bossDefeated(e);
  game.run.kills++;
  game.run.killsBy[e.type] = (game.run.killsBy[e.type] || 0) + 1;
  FX.burst(e.x, e.y - e.h / 2, e.blood || '#ddd', 14, 90, 0.5, 2.5);
  FX.burst(e.x, e.y - 2, 'rgba(20,10,30,0.7)', 6, 30, 0.6, 4);
  Sound.play('edie');
  if (e.burn > 0 && has('fire_burst')) explodeAt(e.x, e.y - 4, 34, pv('fire_burst') * elMult('fire'), ELEMENTS.fire.color);
  if (e.markT > 0) {
    if (has('shadow_blood')) healPlayer(pv('shadow_blood'));
    if (has('duo_soul')) {
      const targets = game.enemies.filter((o) => !o.dead && o.spawnT <= 0 && dist(o.x, o.y, e.x, e.y) < 110).slice(0, pv('duo_soul'));
      for (const t of targets) { FX.bolt(e.x, e.y - 6, t.x, t.y - 6, ELEMENTS.shadow.light); damageEnemy(t, STATUS.chainDmg * 1.5 * elMult('storm'), 'elem'); }
      if (targets.length) Sound.play('zap');
    }
  }
  const gc = e.elite ? randi(...REWARD_VALUES.eliteGold) : chance(REWARD_VALUES.goldDrop) ? randi(1, 3) : 0;
  for (let i = 0; i < gc; i++) game.pickups.push({ type: 'coin', x: e.x + rand(-6, 6), y: e.y + rand(-4, 4), vx: rand(-40, 40), vy: rand(-40, 40), t: 0 });
}

// Statuseffekte pro Bild
function updateStatuses(e, dt) {
  if (e.burn > 0) {
    e.burnT -= dt;
    e.burnTick -= dt;
    if (e.burnTick <= 0) {
      e.burnTick = 0.5;
      let d = STATUS.burnDps * 0.5 * e.burn * elMult('fire') * (1 + pv('fire_core') / 100);
      if (e.markT > 0 && has('duo_hell')) d *= 1 + pv('duo_hell') / 100;
      damageEnemy(e, d, 'burn');
    }
    if (chance(dt * 10)) FX.burst(e.x + rand(-4, 4), e.y - rand(2, e.h), chance(0.5) ? '#ff8a3a' : '#ffd08a', 1, 15, 0.5, 2, { up: 25, drag: 1, glow: 5 });
    if (e.burnT <= 0) e.burn = 0;
  }
  if (e.chillT > 0) { e.chillT -= dt; if (e.chillT <= 0) e.frost = 0; }
  if (e.freezeT > 0) e.freezeT -= dt;
  if (e.markT > 0) e.markT -= dt;
  if (e.invuln > 0) e.invuln -= dt;
  if (e.flash > 0) e.flash -= dt;
}

// ---------- Treffer-Formen ----------
function targets() { return game.enemies.filter((e) => (!e.dead || e.dummy) && e.spawnT <= 0); }
function hitArc(x, y, ang, range, arc, fn) {
  for (const e of targets()) {
    const d = dist(x, y, e.x, e.y - 3);
    if (d > range + e.r) continue;
    if (d > e.r + 4 && Math.abs(angDiff(ang, Math.atan2(e.y - 3 - y, e.x - x))) > arc / 2) continue;
    fn(e);
  }
}
function hitLine(x, y, ang, len, width, fn) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (const e of targets()) {
    const dx = e.x - x, dy = e.y - 3 - y;
    const along = dx * c + dy * s;
    const side = Math.abs(-dx * s + dy * c);
    if (along > -e.r && along < len + e.r && side < width / 2 + e.r) fn(e);
  }
}
function hitCircle(x, y, r, fn) {
  for (const e of targets()) if (dist(x, y, e.x, e.y - 3) < r + e.r) fn(e);
}

// ---------- Bodenzonen (Siegel, Flammen) ----------
function updateZones(dt) {
  for (const z of game.zones) {
    z.t += dt;
    z.tickT -= dt;
    if (z.kind === 'sigil') {
      for (const e of targets()) if (dist(z.x, z.y, e.x, e.y) < z.r + e.r) e.slowZone = 1;
      if (z.tickT <= 0) {
        z.tickT = 0.5;
        hitCircle(z.x, z.y, z.r, (e) => damageEnemy(e, z.dmg, 'cast'));
        FX.ring(z.x, z.y, z.r * 0.6, z.r, z.color, 0.35, 1);
      }
    } else if (z.kind === 'fire') {
      if (z.tickT <= 0) {
        z.tickT = 0.33;
        hitCircle(z.x, z.y, z.r, (e) => { damageEnemy(e, z.dps * 0.33, 'elem'); addBurn(e, 1); });
      }
      if (chance(dt * 12)) FX.burst(z.x + rand(-z.r, z.r) * 0.6, z.y, chance(0.5) ? '#ff8a3a' : '#ffd08a', 1, 12, 0.5, 2, { up: 30, drag: 1, glow: 5 });
    }
  }
  game.zones = game.zones.filter((z) => z.t < z.dur);
}
function drawZones() {
  for (const z of game.zones) {
    const k = z.t / z.dur;
    const fade = Math.min(1, (z.dur - z.t) * 3);
    if (z.kind === 'sigil') {
      ctx.globalAlpha = 0.25 * fade;
      fillCircle(z.x, z.y, z.r, z.color);
      ctx.globalAlpha = 0.9 * fade;
      strokeCircle(z.x, z.y, z.r, z.color, 1.5);
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.rotate(game.time * 1.5);
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * TAU) / 5;
        const px = Math.cos(a) * z.r * 0.75, py = Math.sin(a) * z.r * 0.75;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (z.kind === 'fire') {
      ctx.globalAlpha = 0.45 * fade * (1 - k * 0.3);
      fillCircle(z.x, z.y, z.r, '#ff6a2a');
      ctx.globalAlpha = 1;
    }
  }
}
function drawZoneLights() {
  for (const z of game.zones) {
    const fade = Math.min(1, (z.dur - z.t) * 3);
    glow(z.x, z.y, z.r * 1.6, z.kind === 'fire' ? '#ff6a2a' : z.color, 0.25 * fade);
  }
}

// ---------- Geschosse ----------
function updateProjectiles(dt) {
  const room = game.room;
  for (const b of game.pprojs) {
    b.life -= dt;
    if (b.home) {
      let best = null, bd = 140;
      for (const e of targets()) { const d = dist(b.x, b.y, e.x, e.y - 5); if (d < bd && !b.hit.has(e)) { bd = d; best = e; } }
      if (best) {
        const want = Math.atan2(best.y - 5 - b.y, best.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        const na = cur + clamp(angDiff(cur, want), -6 * dt, 6 * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
    }
    if (b.kind === 'sigil') {
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      b.x = lerp(b.sx, b.tx, k);
      b.y = lerp(b.sy, b.ty, k);
      b.z = Math.sin(k * Math.PI) * 26;
      if (k >= 1) { b.life = 0; landSigil(b); }
      continue;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.trail && chance(dt * 40)) FX.burst(b.x, b.y, b.trail, 1, 8, 0.3, 1.5, { glow: b.kind === 'bolt' ? 6 : 0 });
    if (solidAt(room, b.x, b.y + 4, b.ghost)) {
      b.life = 0;
      if (b.explode) explodeAt(b.x, b.y, b.explode, b.explodeDmg, b.color, b.src, { small: b.small });
      else FX.burst(b.x, b.y, '#d8d0c0', 4, 40, 0.2, 1.5);
      continue;
    }
    for (const e of targets()) {
      if (b.hit.has(e) || dist(b.x, b.y, e.x, e.y - e.h / 2) > b.r + e.r + 2) continue;
      b.hit.add(e);
      const ang = Math.atan2(b.vy, b.vx);
      if (b.explode) {
        b.life = 0;
        damageEnemy(e, b.dmg, b.src, { ang, kb: 40 });
        explodeAt(b.x, b.y, b.explode, b.explodeDmg, b.color, b.src, { small: b.small });
        break;
      }
      damageEnemy(e, b.dmg, b.src, { ang, kb: b.kb || 60, heavy: b.heavy });
      if (b.pierce-- <= 0) { b.life = 0; break; }
    }
  }
  game.pprojs = game.pprojs.filter((b) => b.life > 0);

  const p = game.player;
  for (const b of game.eprojs) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (solidAt(room, b.x, b.y, true) || (!b.over && solidAt(room, b.x, b.y, false))) { b.life = 0; FX.burst(b.x, b.y, b.color, 4, 40, 0.2, 1.5); continue; }
    if (dist(b.x, b.y, p.x, p.y - 6) < b.r + p.r + 1) {
      if (hurtPlayer(b.dmg, b.x, b.y, b.who)) b.life = 0;
    }
  }
  game.eprojs = game.eprojs.filter((b) => b.life > 0);
}
function drawProjectiles() {
  for (const b of game.pprojs) {
    if (b.kind === 'arrow') {
      drawRotated(SPR.arrow, b.x, b.y, Math.atan2(b.vy, b.vx), 9, 1);
      if (b.star) fillCircle(b.x, b.y, 2, '#fff6a0');
    } else if (b.kind === 'sigil') {
      shadowEllipse(b.x, b.y, 4, 2, 0.3);
      ctx.save();
      ctx.translate(b.x, b.y - b.z);
      ctx.rotate(game.time * 12);
      ctx.fillStyle = b.color;
      ctx.fillRect(-3, -3, 6, 6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    } else if (b.kind === 'wave') {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = hexA('#cfe3ff', 0.8);
      ctx.beginPath();
      ctx.arc(-6, 0, 12, -1.1, 1.1);
      ctx.arc(-10, 0, 10, 1.1, -1.1, true);
      ctx.fill();
      ctx.restore();
    } else {
      fillCircle(b.x, b.y, b.r + 1, b.color);
      fillCircle(b.x, b.y, b.r * 0.5, '#ffffff');
    }
  }
  for (const b of game.eprojs) {
    fillCircle(b.x, b.y, b.r + 1, '#1a0a10');
    fillCircle(b.x, b.y, b.r, b.color);
    fillCircle(b.x - 0.7, b.y - 0.7, b.r * 0.4, '#ffffff');
  }
}
function drawProjectileLights() {
  for (const b of game.pprojs) if (b.kind !== 'arrow' || b.star) glow(b.x, b.y - (b.z || 0), b.kind === 'bolt' ? 18 : 12, b.color, 0.5);
  for (const b of game.eprojs) glow(b.x, b.y, 12, b.color, 0.45);
}
function enemyShot(x, y, ang, speed, dmg, color = '#ff5a6a', r = 3, who = null) {
  game.eprojs.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r, dmg, color, life: 5, over: true, who });
}

// ---------- Auswahl: Segen, Schmiede, Sternsplitter ----------
function rollRarity(boost = 0) {
  let r = 0;
  for (let i = 0; i <= boost; i++) r = Math.max(r, weightedPick([0, 1, 2, 3], (k) => RARITY[k].w));
  return r;
}
function newOption(b, boost) {
  const p = game.player;
  b.rar = rollRarity(boost);
  b.level = 1;
  let tag = 'NEU';
  if (b.kind === 'slot' && p.boons[b.slot]) tag = `ERSETZT ${boonName(p.boons[b.slot]).toUpperCase()}`;
  if (b.kind === 'duo') tag = 'DUO-SEGEN';
  return {
    boon: b, tag,
    apply: () => {
      if (b.kind === 'slot') p.boons[b.slot] = b;
      else p.passives[b.id] = b;
      onBoonGained(b);
    },
  };
}
function upgradeOption(cur, tag) {
  const preview = { ...cur, level: cur.level + 1 };
  return { boon: preview, tag: tag || `STUFE ${cur.level + 1}`, up: true, prevVal: boonVal(cur), apply: () => { cur.level++; onBoonGained(cur); } };
}
function onBoonGained(b) {
  const p = game.player;
  // für die Chronik
  const r = game.run;
  if (r) {
    r.picks.push(b.id);
    if (b.rar === 3 && b.level === 1) r.legendary++;
    if (b.kind === 'duo' && b.level === 1) r.duos++;
  }
  if (b.id === 'storm_swift') p.dashCharges = Math.min(p.dashCharges + 1, maxDashes());
}
function boonOptions(el, boost = 0) {
  const p = game.player;
  const cands = [];
  for (const slot of SLOTS) {
    const cur = p.boons[slot];
    if (cur && cur.el === el) cands.push({ w: 1.3, make: () => upgradeOption(cur) });
    else cands.push({ w: cur ? 1.6 : 3, make: () => newOption({ id: `${el}_${slot}`, kind: 'slot', el, slot }, boost) });
  }
  for (const [id, def] of Object.entries(PASSIVES)) {
    if (def.el !== el) continue;
    const cur = p.passives[id];
    cands.push(cur ? { w: 1, make: () => upgradeOption(cur) } : { w: 2, make: () => newOption({ id, kind: 'passive', el }, boost) });
  }
  for (const [id, def] of Object.entries(DUOS)) {
    if (!def.els.includes(el) || p.passives[id]) continue;
    const other = def.els.find((x) => x !== el);
    if (resonance(other) > 0 && resonance(el) > 0) cands.push({ w: 4, make: () => newOption({ id, kind: 'duo', el: def.els[0] }, boost) });
  }
  const out = [];
  while (out.length < 3 && cands.length) {
    const c = weightedPick(cands, (x) => x.w);
    cands.splice(cands.indexOf(c), 1);
    out.push(c.make());
  }
  return out;
}
function starOptions() {
  return shuffle(allBoons()).slice(0, 3).map((b) => upgradeOption(b, `STUFE ${b.level} → ${b.level + 1}`));
}
function forgeOptions() {
  const p = game.player;
  return shuffle(WEAPON_MODS[p.weapon].filter((m) => !p.mods.has(m.id))).slice(0, 3).map((m) => ({
    mod: m, tag: 'VERBESSERUNG', apply: () => p.mods.add(m.id),
  }));
}
