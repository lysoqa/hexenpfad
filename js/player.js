'use strict';
// ===== Heldin: Bewegung, Sprint, Waffen, Siegel =====
function makePlayer(weapon) {
  return {
    x: 0, y: 0, vx: 0, vy: 0, r: 5, h: 20,
    hp: PLAYER_BASE.hp, maxHp: PLAYER_BASE.hp,
    weapon, aim: 0, flip: false, walkT: 0, frame: 0,
    dashCharges: PLAYER_BASE.dashCharges, dashRegen: 0, dashT: 0, dashDx: 1, dashDy: 0,
    dashBuffer: 0, afterDash: 0, dashInv: 0, ghostT: 0, trailT: 0,
    invuln: 0, hurtFlash: 0,
    act: null, combo: 0, comboReset: 0,
    atkBuffer: 0, specialBuffer: 0, castBuffer: 0,
    specialCd: 0, castCd: 0, shotCd: 0, shotCdMax: 1, charge: 0,
    boons: { attack: null, special: null, cast: null, dash: null }, passives: {}, mods: new Set(),
    gold: 0, shots: 0, shadowStep: 0, blockAtk: false, cloudT: 2,
  };
}
const maxDashes = () => PLAYER_BASE.dashCharges + pv('storm_swift');
function mouseWorld() { return { x: Input.mx + game.cam.x, y: Input.my + game.cam.y }; }

const TIMERS = ['invuln', 'hurtFlash', 'specialCd', 'castCd', 'shotCd', 'afterDash', 'shadowStep',
  'atkBuffer', 'specialBuffer', 'castBuffer', 'dashBuffer', 'comboReset', 'dashInv'];

function updatePlayer(p, dt) {
  const B = PLAYER_BASE;
  let ix = 0, iy = 0;
  if (Input.isDown('KeyA') || Input.isDown('ArrowLeft')) ix -= 1;
  if (Input.isDown('KeyD') || Input.isDown('ArrowRight')) ix += 1;
  if (Input.isDown('KeyW') || Input.isDown('ArrowUp')) iy -= 1;
  if (Input.isDown('KeyS') || Input.isDown('ArrowDown')) iy += 1;
  const il = Math.hypot(ix, iy);
  if (il) { ix /= il; iy /= il; }
  const m = mouseWorld();
  p.aim = Math.atan2(m.y - (p.y - 8), m.x - p.x);
  for (const k of TIMERS) if (p[k] > 0) p[k] -= dt;

  // Sprint-Ladungen füllen sich nacheinander wieder auf
  if (p.dashCharges < maxDashes()) {
    p.dashRegen += dt;
    if (p.dashRegen >= B.dashRecharge * (has('storm_swift') ? 0.8 : 1)) { p.dashRegen = 0; p.dashCharges++; }
  } else p.dashRegen = 0;

  // Eingaben werden kurz gemerkt, damit nichts verloren geht
  if (Input.hit('Space')) p.dashBuffer = 0.15;
  if (p.blockAtk && !Input.down[0]) p.blockAtk = false;
  if (Input.clicked[0] && !p.blockAtk) p.atkBuffer = 0.22;
  if (Input.clicked[2]) p.specialBuffer = 0.22;
  if (Input.hit('KeyQ')) p.castBuffer = 0.2;

  if (p.dashBuffer > 0 && p.dashT <= 0 && p.dashCharges >= 1 && !(p.act && p.act.lock)) startDash(p, ix, iy);

  if (p.dashT > 0) {
    p.dashT -= dt;
    moveEnt(p, p.dashDx * B.dashSpeed * dt, p.dashDy * B.dashSpeed * dt, true);
    p.ghostT -= dt;
    if (p.ghostT <= 0) { p.ghostT = 0.022; addGhost(p, '#9a6bff'); }
    const db = p.boons.dash;
    if (db && db.el === 'fire') {
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = 0.03;
        game.zones.push({ kind: 'fire', x: p.x, y: p.y, r: 9, t: 0, dur: 1.6, tickT: 0, dps: boonVal(db) * elMult('fire') });
      }
    }
    if (p.dashT <= 0) endDash(p);
  } else {
    const sp = B.speed * (p.act ? p.act.move : 1);
    p.vx = damp(p.vx, ix * sp, B.accel, dt);
    p.vy = damp(p.vy, iy * sp, B.accel, dt);
    if (!(p.act && p.act.lock)) moveEnt(p, p.vx * dt, p.vy * dt, true);
  }

  // Lauf-Animation, Blick zur Maus
  const spd = Math.hypot(p.vx, p.vy);
  if (spd > 20 && p.dashT <= 0) { p.walkT += dt * (5 + spd / 22); p.frame = [0, 1, 0, 2][Math.floor(p.walkT) % 4]; } else p.frame = 0;
  p.flip = Math.cos(p.aim) < 0;

  if (p.dashT <= 0) {
    WEAPON_LOGIC[p.weapon](p, dt);
    const a = p.act;
    if (a) {
      a.t += dt;
      if (a.update) a.update(dt);
      if (p.act === a && !a.fired && a.t >= a.hitAt) { a.fired = true; a.fire(); }
      if (p.act === a && a.t >= a.dur) p.act = null;
    }
    if (p.castBuffer > 0 && p.castCd <= 0) castSigil(p);
  }

  // Gewitterwolke (Blitz-Passiv)
  if (has('storm_cloud')) {
    p.cloudT -= dt;
    if (p.cloudT <= 0) {
      p.cloudT = 2;
      const list = targets();
      if (list.length) {
        const e = pick(list);
        FX.bolt(e.x + rand(-12, 12), e.y - 80, e.x, e.y - 4);
        damageEnemy(e, pv('storm_cloud') * elMult('storm'), 'elem');
        Sound.play('zap');
      }
    }
  }
}

function addGhost(p, color) {
  const spr = SPR.hero[p.frame];
  const t = tinted(spr, color);
  FX.ghost(p.flip ? t.flip : t.img, p.x, p.y, spr.w, spr.h);
}

function startDash(p, ix, iy) {
  const B = PLAYER_BASE;
  p.dashBuffer = 0;
  if (ix || iy) { p.dashDx = ix; p.dashDy = iy; } else { p.dashDx = Math.cos(p.aim); p.dashDy = Math.sin(p.aim); }
  p.dashT = B.dashTime;
  p.dashInv = B.dashInvuln;
  p.dashCharges--;
  p.charge = 0;
  p.act = null; // Sprint bricht jede Aktion ab
  Sound.play('dash');
  FX.burst(p.x, p.y - 2, '#b9a0ff', 6, 40, 0.3, 2);
  const b = p.boons.dash;
  if (b && b.el === 'frost') {
    const v = boonVal(b) * elMult('frost');
    FX.ring(p.x, p.y - 4, 6, 38, ELEMENTS.frost.color, 0.3, 2);
    FX.burst(p.x, p.y - 4, ELEMENTS.frost.light, 10, 80, 0.35, 2);
    hitCircle(p.x, p.y - 4, 38, (e) => { damageEnemy(e, v, 'dash'); addFrost(e, 2); });
  }
}
function endDash(p) {
  p.vx = p.dashDx * PLAYER_BASE.speed;
  p.vy = p.dashDy * PLAYER_BASE.speed;
  p.afterDash = PLAYER_BASE.dashStrikeWindow;
  const b = p.boons.dash;
  if (b && b.el === 'storm') {
    const list = targets().filter((e) => dist(e.x, e.y, p.x, p.y) < 85).slice(0, 3);
    for (const e of list) { FX.bolt(p.x, p.y - 8, e.x, e.y - 6); damageEnemy(e, boonVal(b) * elMult('storm'), 'dash'); }
    if (list.length) Sound.play('zap');
  }
  if (b && b.el === 'shadow') {
    p.shadowStep = 1.0;
    FX.burst(p.x, p.y - 8, ELEMENTS.shadow.color, 8, 40, 0.4, 2);
  }
}

function hurtPlayer(dmg, fx, fy) {
  const p = game.player;
  if (game.mode !== 'run' || p.invuln > 0 || p.dashInv > 0 || game.state !== 'play') return false;
  dmg = Math.max(1, Math.round(dmg * (1 - Math.min(0.5, pv('frost_skin') / 100))));
  p.hp -= dmg;
  p.invuln = PLAYER_BASE.hurtInvuln;
  p.hurtFlash = 0.25;
  game.run.taken += dmg;
  FX.text(p.x, p.y - 26, dmg, '#ff6a6a', 8);
  FX.burst(p.x, p.y - 8, '#ff5a5a', 10, 80, 0.4, 2);
  Sound.play('hurt');
  shake(4);
  game.hitstop = Math.max(game.hitstop, 0.08);
  if (fx !== undefined) {
    const a = Math.atan2(p.y - fy, p.x - fx);
    p.vx += Math.cos(a) * 150;
    p.vy += Math.sin(a) * 150;
  }
  if (has('frost_armor')) {
    hitCircle(p.x, p.y, 55, (e) => addFrost(e, pv('frost_armor')));
    FX.ring(p.x, p.y - 4, 8, 55, ELEMENTS.frost.color, 0.35, 2);
  }
  if (p.hp <= 0) { p.hp = 0; playerDied(); }
  return true;
}
function healPlayer(n) {
  const p = game.player;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + n);
  const got = Math.round(p.hp - before);
  if (got > 0) FX.text(p.x, p.y - 26, `+${got}`, '#7aff9a', 7);
}

// ---------- Waffen ----------
function startAct(p, a) {
  p.act = Object.assign({ t: 0, fired: false, move: 1, hitAt: 0, dur: 0.2, fire() {} }, a);
}
const wantAttack = (p) => !p.blockAtk && (p.atkBuffer > 0 || Input.down[0]);
// neue Aktion erlaubt? (Ende eines Hiebs darf schon in den nächsten übergehen)
const canChain = (p) => !p.act || (p.act.kind === 'atk' && p.act.t >= p.act.dur * 0.72) || p.act.kind === 'shot' || p.act.kind === 'cast';

const WEAPON_LOGIC = {
  sword(p) {
    const W = WEAPONS.sword;
    if (p.specialBuffer > 0 && p.specialCd <= 0 && canChain(p)) {
      p.specialBuffer = 0;
      p.specialCd = W.special.cd;
      const SP = W.special;
      const spinHit = () => {
        hitCircle(p.x, p.y - 4, SP.range, (e) => damageEnemy(e, SP.dmg, 'special', { ang: Math.atan2(e.y - p.y, e.x - p.x), kb: 110, heavy: true }));
        FX.slash(p.x, p.y - 4, p.aim, SP.range, TAU, hexA(W.color, 0.5), 0.22, 0.45);
        Sound.play('heavy');
      };
      let second = p.mods.has('sw_double');
      startAct(p, {
        kind: 'spin', dur: SP.dur + (second ? 0.12 : 0), hitAt: 0.08, move: 0.55, fire: spinHit,
        update() { if (second && this.t > 0.26) { second = false; spinHit(); } },
      });
      return;
    }
    if (wantAttack(p) && canChain(p)) {
      const ds = p.afterDash > 0;
      const c = ds ? W.dashStrike : W.combo[p.combo];
      const idx = p.combo;
      p.atkBuffer = 0;
      p.afterDash = 0;
      const ang = p.aim;
      p.vx += Math.cos(ang) * c.step;
      p.vy += Math.sin(ang) * c.step;
      const range = c.range * (p.mods.has('sw_wide') ? 1.35 : 1);
      const dmg = c.dmg * (p.mods.has('sw_heavy') ? 1.3 : 1);
      startAct(p, {
        kind: 'atk', dur: c.dur, hitAt: c.dur * 0.28, move: 0.3, ang, swing: c.arc, flipSwing: idx === 1,
        fire() {
          const cx = p.x, cy = p.y - 5;
          hitArc(cx, cy, ang, range, c.arc, (e) => damageEnemy(e, dmg, 'attack', { ang, kb: c.heavy ? 140 : 70, heavy: c.heavy }));
          FX.slash(cx, cy, ang, range, c.arc, hexA(ds ? '#b583ff' : W.color, 0.6), 0.17);
          Sound.play(c.heavy ? 'heavy' : 'swing');
          if (idx === 2 && !ds && p.mods.has('sw_wave')) {
            game.pprojs.push({ kind: 'wave', x: cx, y: cy, vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230, r: 9, dmg: 24, src: 'attack', life: 0.6, pierce: 99, hit: new Set(), color: W.color, kb: 60 });
          }
        },
      });
      p.combo = ds ? 0 : (p.combo + 1) % 3;
      p.comboReset = c.dur + 0.35;
    }
    if (p.comboReset <= 0 && !p.act) p.combo = 0;
  },

  lance(p, dt) {
    const W = WEAPONS.lance, SP = W.special;
    if (p.act && p.act.kind === 'charge') {
      p.charge = Math.min(SP.chargeMax, p.charge + dt * (p.mods.has('la_rush') ? 2 : 1));
      if (!Input.down[2]) lanceRush(p);
      return;
    }
    if (p.specialBuffer > 0 && p.specialCd <= 0 && canChain(p)) {
      p.specialBuffer = 0;
      p.charge = 0;
      startAct(p, { kind: 'charge', dur: 99, hitAt: 99, move: 0.35 });
      Sound.play('charge');
      return;
    }
    if (wantAttack(p) && canChain(p)) {
      const ds = p.afterDash > 0;
      const c = ds ? W.dashStrike : W.combo[p.combo];
      const idx = p.combo;
      p.atkBuffer = 0;
      p.afterDash = 0;
      const ang = p.aim;
      p.vx += Math.cos(ang) * c.step;
      p.vy += Math.sin(ang) * c.step;
      if (c.spin) {
        startAct(p, {
          kind: 'atk', spin: true, dur: c.dur, hitAt: c.dur * 0.3, move: 0.4, ang,
          fire() {
            hitCircle(p.x, p.y - 5, c.range, (e) => damageEnemy(e, c.dmg, 'attack', { ang: Math.atan2(e.y - p.y, e.x - p.x), kb: 130, heavy: true }));
            FX.slash(p.x, p.y - 5, ang, c.range, TAU, hexA(W.color, 0.5), 0.22, 0.6);
            Sound.play('heavy');
            if (p.mods.has('la_spin')) {
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * TAU;
                game.pprojs.push({ kind: 'bolt', x: p.x, y: p.y - 6, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, r: 2, dmg: 10, src: 'attack', life: 0.45, pierce: 0, hit: new Set(), color: '#ffd9a0', trail: '#ffd9a0' });
              }
            }
          },
        });
      } else {
        const len = c.len * (p.mods.has('la_reach') ? 1.4 : 1);
        const dmg = c.dmg * (p.mods.has('la_pierce') ? 1.35 : 1);
        startAct(p, {
          kind: 'atk', dur: c.dur, hitAt: c.dur * 0.25, move: 0.3, ang,
          fire() {
            hitLine(p.x, p.y - 5, ang, len, c.width, (e) => damageEnemy(e, dmg, 'attack', { ang, kb: c.heavy ? 150 : 80, heavy: c.heavy }));
            FX.thrust(p.x + Math.cos(ang) * 6, p.y - 5 + Math.sin(ang) * 6, ang, len, c.width, hexA(ds ? '#b583ff' : W.color, 0.6));
            Sound.play('thrust');
          },
        });
      }
      p.combo = ds ? 0 : (idx + 1) % 3;
      p.comboReset = c.dur + 0.4;
    }
    if (p.comboReset <= 0 && !p.act) p.combo = 0;
  },

  bow(p) {
    const W = WEAPONS.bow;
    if (p.specialBuffer > 0 && p.specialCd <= 0) {
      p.specialBuffer = 0;
      p.specialCd = W.special.cd;
      const n = W.special.arrows + (p.mods.has('bo_volley') ? 4 : 0);
      const spread = W.special.spread * (n > 5 ? 1.4 : 1);
      for (let i = 0; i < n; i++) shootArrow(p, p.aim - spread / 2 + (spread * i) / (n - 1), W.special.dmg, 'special');
      Sound.play('bow');
      startAct(p, { kind: 'shot', dur: 0.15, move: 0.6 });
      return;
    }
    if (wantAttack(p) && p.shotCd <= 0) {
      p.atkBuffer = 0;
      const cd = W.shot.cd * (p.mods.has('bo_quick') ? 0.65 : 1);
      p.shotCd = cd;
      p.shotCdMax = cd;
      p.shots++;
      const star = p.mods.has('bo_power') && p.shots % 4 === 0;
      const dmg = W.shot.dmg * (star ? 3 : 1);
      shootArrow(p, p.aim, dmg, 'attack', star);
      if (p.afterDash > 0) {
        p.afterDash = 0;
        for (let i = 1; i <= W.dashStrike.extra; i++) shootArrow(p, p.aim + (i % 2 ? 1 : -1) * W.dashStrike.spread * Math.ceil(i / 2), dmg, 'attack');
      }
      Sound.play('bow');
      startAct(p, { kind: 'shot', dur: 0.12, move: 0.75 });
    }
  },

  staff(p, dt) {
    const W = WEAPONS.staff, SP = W.special;
    if (p.act && p.act.kind === 'charge') {
      p.charge = Math.min(SP.chargeMax, p.charge + dt);
      if (!Input.down[2]) {
        const k = p.charge / SP.chargeMax;
        p.charge = 0;
        const t = staffTarget(p);
        const nova = p.mods.has('st_nova');
        const r = SP.radius * (0.6 + 0.4 * k) * (nova ? 1.4 : 1);
        const dmg = SP.dmg * (0.45 + 0.55 * k) * (nova ? 1.25 : 1);
        explodeAt(t.x, t.y, r, dmg, '#c08aff', 'special', { kb: 90, heavy: k > 0.9 });
        FX.ring(t.x, t.y, r * 0.3, r * 1.1, '#ffffff', 0.4, 1);
        shake(2 + 3 * k);
        p.specialCd = SP.cd;
        startAct(p, { kind: 'cast', dur: 0.2, move: 0.6 });
      }
      return;
    }
    if (p.specialBuffer > 0 && p.specialCd <= 0 && canChain(p)) {
      p.specialBuffer = 0;
      p.charge = 0;
      startAct(p, { kind: 'charge', dur: 99, hitAt: 99, move: 0.45 });
      Sound.play('charge');
      return;
    }
    if (wantAttack(p) && p.shotCd <= 0) {
      p.atkBuffer = 0;
      p.shotCd = W.bolt.cd;
      p.shotCdMax = W.bolt.cd;
      const angs = p.mods.has('st_twin') ? [p.aim - 0.12, p.aim + 0.12] : [p.aim];
      for (const a of angs) {
        game.pprojs.push({
          kind: 'bolt', x: p.x + Math.cos(a) * 10, y: p.y - 9 + Math.sin(a) * 10,
          vx: Math.cos(a) * W.bolt.speed, vy: Math.sin(a) * W.bolt.speed, r: 3,
          dmg: W.bolt.dmg, src: 'attack', life: W.bolt.life, pierce: 0, hit: new Set(),
          explode: W.bolt.radius * (p.mods.has('st_blast') ? 1.5 : 1), explodeDmg: W.bolt.dmg * 0.6, small: true,
          color: '#c08aff', trail: '#c08aff', home: p.mods.has('st_seek'),
        });
      }
      if (p.afterDash > 0) {
        p.afterDash = 0;
        explodeAt(p.x, p.y - 4, W.dashStrike.radius, W.dashStrike.dmg, '#c08aff', 'attack', { kb: 100 });
      }
      Sound.play('magic');
      startAct(p, { kind: 'shot', dur: 0.14, move: 0.7 });
    }
  },
};

function lanceRush(p) {
  const SP = WEAPONS.lance.special;
  const k = p.charge / SP.chargeMax;
  const travel = lerp(SP.distMin, SP.distMax, k);
  const dmg = lerp(SP.dmgMin, SP.dmgMax, k) * (p.mods.has('la_rush') ? 1.3 : 1);
  const ang = p.aim;
  const c = Math.cos(ang), s = Math.sin(ang);
  const hit = new Set();
  const moveTime = travel / SP.speed;
  p.specialCd = SP.cd;
  p.charge = 0;
  p.vx = p.vy = 0;
  Sound.play('thrust');
  Sound.play('dash');
  let gT = 0;
  startAct(p, {
    kind: 'rush', dur: moveTime + 0.1, hitAt: 99, move: 0, lock: true, ang,
    update(dt) {
      if (this.t < moveTime) {
        moveEnt(p, c * SP.speed * dt, s * SP.speed * dt, true);
        p.invuln = Math.max(p.invuln, 0.06);
        gT -= dt;
        if (gT <= 0) { gT = 0.02; addGhost(p, '#ffd9a0'); }
      }
      hitLine(p.x - c * 16, p.y - 5 - s * 16, ang, 42, 20, (e) => {
        if (hit.has(e)) return;
        hit.add(e);
        damageEnemy(e, dmg, 'special', { ang, kb: 170, heavy: true });
      });
    },
  });
  FX.thrust(p.x, p.y - 5, ang, travel + 30, 16, hexA('#ffd9a0', 0.35), 0.25);
}
function staffTarget(p) {
  const m = mouseWorld();
  const d = Math.min(WEAPONS.staff.special.range, dist(p.x, p.y - 8, m.x, m.y));
  return { x: p.x + Math.cos(p.aim) * d, y: p.y - 8 + Math.sin(p.aim) * d };
}
function shootArrow(p, ang, dmg, src, star) {
  const W = WEAPONS.bow.shot;
  game.pprojs.push({
    kind: 'arrow', x: p.x + Math.cos(ang) * 8, y: p.y - 8 + Math.sin(ang) * 8,
    vx: Math.cos(ang) * W.speed, vy: Math.sin(ang) * W.speed, r: 3, dmg, src, life: W.life,
    pierce: p.mods.has('bo_pierce') ? 99 : 0, hit: new Set(), color: '#fff6a0', star, kb: 50,
    trail: star ? '#fff6a0' : null, heavy: star,
  });
}

// ---------- Siegel (Q) ----------
function castSigil(p) {
  p.castBuffer = 0;
  p.castCd = PLAYER_BASE.castCd;
  const m = mouseWorld();
  const a = Math.atan2(m.y - p.y, m.x - p.x);
  let d = Math.min(PLAYER_BASE.castRange, dist(p.x, p.y, m.x, m.y));
  while (d > 0 && solidAt(game.room, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, true)) d -= 6;
  d = Math.max(0, d);
  const b = p.boons.cast;
  const color = b ? ELEMENTS[b.el].color : '#d8c8ff';
  game.pprojs.push({
    kind: 'sigil', sx: p.x, sy: p.y, tx: p.x + Math.cos(a) * d, ty: p.y + Math.sin(a) * d,
    x: p.x, y: p.y, t: 0, dur: 0.28, z: 0, life: 9, color, hit: new Set(), r: 0,
  });
  Sound.play('magic');
}
function landSigil(s) {
  const b = game.player.boons.cast;
  const el = b ? b.el : null;
  const z = { kind: 'sigil', x: s.tx, y: s.ty, r: 34, t: 0, dur: 2.4, tickT: 0.05, dmg: 6, color: s.color, el };
  game.zones.push(z);
  FX.ring(z.x, z.y, 4, z.r, s.color, 0.3, 2);
  FX.burst(z.x, z.y, s.color, 12, 70, 0.4, 2, { glow: 6 });
  Sound.play('slam');
  shake(1.5);
  if (el === 'frost') hitCircle(z.x, z.y, z.r, (e) => addFrost(e, 3));
  if (el === 'shadow') {
    for (const e of targets()) {
      const d = dist(z.x, z.y, e.x, e.y);
      if (d < z.r * 1.8 && !e.boss && !e.dummy) {
        const a = Math.atan2(z.y - e.y, z.x - e.x);
        e.kbx += Math.cos(a) * d * 4;
        e.kby += Math.sin(a) * d * 4;
      }
    }
  }
}

// ---------- Zeichnen ----------
function weaponPose(p) {
  const a = p.act;
  let ang = p.aim, off = 0;
  const side = p.flip ? -1 : 1;
  if (p.weapon === 'sword') {
    if (a && a.kind === 'atk') {
      const k = clamp(a.t / (a.dur * 0.4), 0, 1);
      const e = 1 - (1 - k) * (1 - k);
      ang = a.flipSwing ? a.ang + a.swing / 2 - a.swing * e : a.ang - a.swing / 2 + a.swing * e;
      off = 2;
    } else if (a && a.kind === 'spin') ang = p.aim + (a.t / a.dur) * TAU * 1.3;
    else ang = p.aim + side * 1.0;
  } else if (p.weapon === 'lance') {
    if (a && a.kind === 'atk' && a.spin) ang = a.ang + (a.t / a.dur) * TAU;
    else if (a && a.kind === 'atk') { ang = a.ang; off = Math.sin(clamp(a.t / a.dur, 0, 1) * Math.PI) * 12 - 4; }
    else if (a && a.kind === 'rush') { ang = a.ang; off = 8; }
    else if (a && a.kind === 'charge') off = -4 - 5 * (p.charge / WEAPONS.lance.special.chargeMax);
    else { ang = p.aim + side * 0.25; off = -5; }
  } else if (p.weapon === 'bow') {
    if (a && a.kind === 'shot') off = -2 * (1 - a.t / a.dur);
  } else if (p.weapon === 'staff') {
    if (!(a && (a.kind === 'shot' || a.kind === 'charge' || a.kind === 'cast'))) ang = p.aim - side * 0.6;
    off = a && a.kind === 'shot' ? 2 : -2;
  }
  return { ang, off };
}
function drawWeapon(p, pose) {
  const spr = SPR[p.weapon];
  const [gx, gy] = WEAPON_GRIP[p.weapon];
  const hx = p.x + (p.flip ? -2 : 2) + Math.cos(pose.ang) * pose.off;
  const hy = p.y - 9 + Math.sin(pose.ang) * pose.off;
  drawRotated(spr, hx, hy, pose.ang, gx, gy, { flipY: Math.cos(pose.ang) < 0 });
}
function drawPlayer(p) {
  const spr = SPR.hero[p.frame];
  const still = Math.hypot(p.vx, p.vy) < 20;
  const breathe = still ? Math.sin(game.time * 3) * 0.015 : 0;
  shadowEllipse(p.x, p.y, 6, 2.5);
  if (p.shadowStep > 0) glow(p.x, p.y - 8, 18, ELEMENTS.shadow.color, 0.4);
  const pose = weaponPose(p);
  const behind = Math.sin(pose.ang) < -0.35;
  const blink = p.invuln > 0 && p.dashInv <= 0 && Math.floor(game.time * 20) % 2 === 0;
  if (behind) drawWeapon(p, pose);
  drawSprite(spr, p.x, p.y, { flip: p.flip, alpha: blink ? 0.35 : 1, white: p.hurtFlash > 0.17, sy: 1 + breathe });
  if (!behind) drawWeapon(p, pose);

  // Lade-Anzeigen
  if (p.act && p.act.kind === 'charge') {
    const max = p.weapon === 'lance' ? WEAPONS.lance.special.chargeMax : WEAPONS.staff.special.chargeMax;
    const k = p.charge / max;
    ctx.strokeStyle = k >= 1 ? '#ffffff' : '#ffd9a0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 10, 14, -Math.PI / 2, -Math.PI / 2 + TAU * k);
    ctx.stroke();
    if (p.weapon === 'lance') {
      const SP = WEAPONS.lance.special;
      const len = lerp(SP.distMin, SP.distMax, k);
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ffd9a0';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 4);
      ctx.lineTo(p.x + Math.cos(p.aim) * len, p.y - 4 + Math.sin(p.aim) * len);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    } else {
      const t = staffTarget(p);
      const SP = WEAPONS.staff.special;
      const r = SP.radius * (0.6 + 0.4 * k) * (p.mods.has('st_nova') ? 1.4 : 1);
      ctx.globalAlpha = 0.2 + 0.2 * k;
      fillCircle(t.x, t.y, r, '#c08aff');
      ctx.globalAlpha = 0.8;
      strokeCircle(t.x, t.y, r, '#e0c0ff', 1);
      ctx.globalAlpha = 1;
    }
  }
  // Abklingzeit des Bogens: kleiner Balken unter ihr
  if (p.weapon === 'bow' && p.shotCd > 0) {
    const k = 1 - p.shotCd / p.shotCdMax;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(p.x - 7, p.y + 3, 14, 2);
    ctx.fillStyle = '#bff0c0';
    ctx.fillRect(p.x - 7, p.y + 3, 14 * k, 2);
  }
}
function drawPlayerLights(p) {
  glow(p.x, p.y - 8, 60, '#a07ae8', 0.2);
  if (p.weapon === 'staff') {
    const pose = weaponPose(p);
    const hx = p.x + (p.flip ? -2 : 2) + Math.cos(pose.ang) * (pose.off + 11);
    const hy = p.y - 9 + Math.sin(pose.ang) * (pose.off + 11);
    glow(hx, hy, 12, '#8fe8ff', 0.5);
  }
}
