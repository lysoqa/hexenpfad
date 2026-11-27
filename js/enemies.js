'use strict';
// ===== Gegner, Wellen, Boss =====
const BLOOD = { imp: '#e6dcc4', spitter: '#79b84e', shroom: '#c06090', ram: '#a07850', eye: '#9a5ab8', knight: '#9a98a6', boss: '#ff7a2a', dummy: '#d9b070' };

function baseEnemy(type, x, y) {
  return {
    type, x, y, vx: 0, vy: 0, kbx: 0, kby: 0, state: 'move', t: 0, spawnT: 0.8, flash: 0, face: 1,
    cd: rand(0.6, 1.6), aim: 0, burn: 0, burnT: 0, burnTick: 0.5, frost: 0, chillT: 0, freezeT: 0,
    markT: 0, slowZone: 0, invuln: 0, dead: false, bob: rand(0, 6), avoid: chance(0.5) ? 1 : -1,
    strafe: chance(0.5) ? 1 : -1, blood: BLOOD[type], armor: 0, maxArmor: 0, dmgMult: 1,
  };
}
function makeEnemy(type, x, y, o = {}) {
  const d = ENEMIES[type];
  const sc = 1 + ENEMY_SCALE.hpPerRoom * Math.max(0, game.depth - 1);
  const elite = !!o.elite;
  const hp = Math.round(d.hp * sc * (elite ? ENEMY_SCALE.eliteHp : 1));
  const armor = Math.round((d.armor || 0) * sc + (elite ? ENEMY_SCALE.eliteArmor * sc : 0));
  return Object.assign(baseEnemy(type, x, y), {
    d, name: d.name, r: d.r, hp, maxHp: hp, armor, maxArmor: armor,
    speed: d.speed * (elite ? 1.1 : 1), dmgMult: elite ? ENEMY_SCALE.eliteDmg : 1, elite, fly: !!d.fly,
    h: SPR[type].h,
  });
}
function makeDummy(x, y) {
  return Object.assign(baseEnemy('dummy', x, y), { dummy: true, name: 'Übungspuppe', r: 6, hp: 500, maxHp: 500, h: SPR.dummy.h, spawnT: 0, speed: 0 });
}
function makeBoss(x, y) {
  return Object.assign(baseEnemy('boss', x, y), {
    boss: true, name: BOSS.name, r: BOSS.r, hp: BOSS.hp, maxHp: BOSS.hp, speed: BOSS.speed,
    h: SPR.boss.h * 2, state: 'intro', spawnT: 0, phase: 1, last: '', invuln: 2.4, count: 0, spin: 0,
  });
}

function setState(e, s) { e.state = s; e.t = 0; e.done = false; e.hitDone = false; }

// Laufen mit einfachem Ausweichen um Säulen
function steer(e, ang, speed, dt) {
  let a = ang;
  if (!e.fly && speed > 0) {
    const look = 12 + e.r;
    const blocked = (aa) => boxSolid(game.room, e.x + Math.cos(aa) * look, e.y + Math.sin(aa) * look, e.r, false);
    if (blocked(a)) {
      outer: for (const off of [0.7, 1.4, 2.1]) {
        for (const sgn of [e.avoid, -e.avoid]) {
          if (!blocked(ang + off * sgn)) { a = ang + off * sgn; e.avoid = sgn; break outer; }
        }
      }
    }
  }
  e.vx = damp(e.vx, Math.cos(a) * speed, 8, dt);
  e.vy = damp(e.vy, Math.sin(a) * speed, 8, dt);
  return moveEnt(e, e.vx * dt, e.vy * dt);
}
function brake(e, dt) {
  e.vx = damp(e.vx, 0, 10, dt);
  e.vy = damp(e.vy, 0, 10, dt);
  moveEnt(e, e.vx * dt, e.vy * dt);
}

function updateEnemies(dt) {
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      if (e.spawnT <= 0) FX.burst(e.x, e.y - 4, '#b583ff', 12, 60, 0.4, 2, { glow: 5 });
      continue;
    }
    updateStatuses(e, dt);
    if (e.dead) continue;
    if (e.kbx || e.kby) {
      moveEnt(e, e.kbx * dt, e.kby * dt);
      e.kbx = damp(e.kbx, 0, 9, dt);
      e.kby = damp(e.kby, 0, 9, dt);
      if (Math.abs(e.kbx) + Math.abs(e.kby) < 4) e.kbx = e.kby = 0;
    }
    if (e.dummy) { e.hp = Math.min(e.maxHp, e.hp + dt * 40); e.slowZone = 0; continue; }
    if (e.freezeT > 0) { e.slowZone = 0; continue; }
    const slow = (e.chillT > 0 ? 1 - chillSlow() : 1) * (e.slowZone ? 0.55 : 1);
    e.slowZone = 0;
    AI[e.type](e, dt * slow);
  }
  // Gegner schieben sich auseinander
  const list = game.enemies.filter((e) => !e.dead && e.spawnT <= 0);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const d = dist(a.x, a.y, b.x, b.y);
      const min = a.r + b.r;
      if (d >= min || d < 0.01) continue;
      const push = (min - d) / 2, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
      if (!a.boss && !a.dummy) moveEnt(a, -nx * push, -ny * push);
      if (!b.boss && !b.dummy) moveEnt(b, nx * push, ny * push);
    }
  }
  game.enemies = game.enemies.filter((e) => !e.dead || e.dummy);
}

const AI = {
  imp(e, dt) {
    const p = game.player, d = dist(e.x, e.y, p.x, p.y), a = Math.atan2(p.y - e.y, p.x - e.x);
    e.t += dt;
    e.cd -= dt;
    if (e.state === 'move') {
      e.face = Math.cos(a) >= 0 ? 1 : -1;
      if (d > 20) steer(e, a, e.speed, dt); else brake(e, dt);
      if (d < 30 && e.cd <= 0) { setState(e, 'wind'); e.aim = a; }
    } else if (e.state === 'wind') {
      brake(e, dt);
      if (e.t < 0.2) e.aim = a;
      if (e.t >= 0.45) {
        setState(e, 'strike');
        e.kbx += Math.cos(e.aim) * 150;
        e.kby += Math.sin(e.aim) * 150;
        FX.slash(e.x, e.y - 5, e.aim, 28, 1.8, 'rgba(255,150,130,0.55)', 0.14);
        Sound.play('swing');
      }
    } else if (e.state === 'strike') {
      if (!e.hitDone && e.t > 0.05) {
        e.hitDone = true;
        if (d < 32 && Math.abs(angDiff(e.aim, a)) < 1.1) hurtPlayer(e.d.dmg * e.dmgMult, e.x, e.y, e.type);
      }
      if (e.t > 0.15) setState(e, 'recover');
    } else if (e.state === 'recover') {
      brake(e, dt);
      if (e.t > 0.55) { setState(e, 'move'); e.cd = rand(0.4, 0.9); }
    }
  },

  spitter(e, dt) {
    const p = game.player, d = dist(e.x, e.y, p.x, p.y), a = Math.atan2(p.y - e.y, p.x - e.x);
    e.t += dt;
    e.cd -= dt;
    if (e.state === 'move') {
      e.face = Math.cos(a) >= 0 ? 1 : -1;
      e.strafeT = (e.strafeT || 0) - dt;
      if (e.strafeT <= 0) { e.strafeT = rand(1.2, 2.5); e.strafe *= -1; }
      const los = lineOfSight(e.x, e.y - 4, p.x, p.y - 6);
      let mv = a + (e.strafe * Math.PI) / 2;
      if (d < 85) mv = a + Math.PI + e.strafe * 0.4;
      else if (d > 150 || !los) mv = a;
      steer(e, mv, e.speed, dt);
      if (e.cd <= 0 && d < 230 && los) setState(e, 'wind');
    } else if (e.state === 'wind') {
      brake(e, dt);
      if (e.t >= 0.55) {
        const n = game.depth >= 5 ? 3 : 1;
        for (let i = 0; i < n; i++) enemyShot(e.x + e.face * 4, e.y - 6, a + (i - (n - 1) / 2) * 0.28, 90, e.d.dmg * e.dmgMult, '#9fe05a', 3.5, 'spitter');
        Sound.play('eshoot');
        setState(e, 'recover');
      }
    } else if (e.state === 'recover') {
      brake(e, dt);
      if (e.t > 0.4) { setState(e, 'move'); e.cd = rand(1.8, 2.6); }
    }
  },

  shroom(e, dt) {
    const p = game.player, d = dist(e.x, e.y, p.x, p.y), a = Math.atan2(p.y - e.y, p.x - e.x);
    e.t += dt;
    if (e.state === 'move') {
      e.face = Math.cos(a) >= 0 ? 1 : -1;
      steer(e, a, e.speed, dt);
      if (d < 24) setState(e, 'fuse');
    } else if (e.state === 'fuse') {
      brake(e, dt);
      if (e.t >= 0.85) {
        e.dead = true;
        FX.ring(e.x, e.y - 3, 6, 36, '#e070b0', 0.35, 3);
        FX.burst(e.x, e.y - 4, '#c06090', 22, 110, 0.6, 3, { glow: 6 });
        Sound.play('boom');
        shake(3);
        if (d < 36) hurtPlayer(e.d.dmg * e.dmgMult, e.x, e.y, e.type);
        for (const o of game.enemies) {
          if (o !== e && !o.dead && !o.boss && !o.dummy && o.spawnT <= 0 && dist(o.x, o.y, e.x, e.y) < 36) damageEnemy(o, 20, 'trap');
        }
      }
    }
  },

  ram(e, dt) {
    const p = game.player, d = dist(e.x, e.y, p.x, p.y), a = Math.atan2(p.y - e.y, p.x - e.x);
    e.t += dt;
    e.cd -= dt;
    if (e.state === 'move') {
      e.face = Math.cos(a) >= 0 ? 1 : -1;
      if (d > 90) steer(e, a, e.speed, dt); else steer(e, a + (Math.PI / 2) * e.strafe, e.speed * 0.6, dt);
      if (e.cd <= 0 && d < 180 && lineOfSight(e.x, e.y - 4, p.x, p.y - 4)) { setState(e, 'wind'); e.aim = a; }
    } else if (e.state === 'wind') {
      brake(e, dt);
      if (e.t < 0.45) e.aim = a;
      e.face = Math.cos(e.aim) >= 0 ? 1 : -1;
      if (e.t >= 0.75) { setState(e, 'charge'); Sound.play('dash'); }
    } else if (e.state === 'charge') {
      const hitWall = moveEnt(e, Math.cos(e.aim) * 270 * dt, Math.sin(e.aim) * 270 * dt);
      if (chance(dt * 30)) FX.burst(e.x, e.y, '#8a7a6a', 1, 20, 0.3, 2);
      if (!e.hitDone && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 4) { e.hitDone = true; hurtPlayer(e.d.dmg * e.dmgMult, e.x, e.y, e.type); }
      if (hitWall) {
        setState(e, 'stun');
        shake(3);
        Sound.play('slam');
        FX.burst(e.x, e.y - 6, '#d8d0c0', 10, 70, 0.4, 2);
      } else if (e.t > 0.65) setState(e, 'recover');
    } else if (e.state === 'stun') {
      if (e.t > 1.3) { setState(e, 'move'); e.cd = rand(1.2, 2); }
    } else if (e.state === 'recover') {
      brake(e, dt);
      if (e.t > 0.7) { setState(e, 'move'); e.cd = rand(1.5, 2.5); }
    }
  },

  eye(e, dt) {
    const p = game.player, a = Math.atan2(p.y - e.y, p.x - e.x);
    e.t += dt;
    e.cd -= dt;
    if (e.state === 'move') {
      e.orbit = (e.orbit ?? rand(0, TAU)) + dt * 0.5 * e.strafe;
      const tx = p.x + Math.cos(e.orbit) * 100, ty = p.y + Math.sin(e.orbit) * 70;
      const md = dist(e.x, e.y, tx, ty);
      steer(e, Math.atan2(ty - e.y, tx - e.x), md > 10 ? e.speed : 0, dt);
      e.face = Math.cos(a) >= 0 ? 1 : -1;
      if (e.cd <= 0) setState(e, 'wind');
    } else if (e.state === 'wind') {
      brake(e, dt);
      if (e.t >= 0.6) {
        const off = rand(0, TAU);
        for (let i = 0; i < 10; i++) enemyShot(e.x, e.y - 14, off + (i / 10) * TAU, 70, e.d.dmg * e.dmgMult, '#e070ff', 3, 'eye');
        e.second = game.depth >= 8 ? 0.25 : 0;
        e.secondOff = off + TAU / 20;
        Sound.play('eshoot');
        setState(e, 'recover');
      }
    } else if (e.state === 'recover') {
      brake(e, dt);
      if (e.second > 0) {
        e.second -= dt;
        if (e.second <= 0) for (let i = 0; i < 10; i++) enemyShot(e.x, e.y - 14, e.secondOff + (i / 10) * TAU, 70, e.d.dmg * e.dmgMult, '#e070ff', 3, 'eye');
      }
      if (e.t > 0.6) { setState(e, 'move'); e.cd = rand(2.4, 3.4); }
    }
  },

  knight(e, dt) {
    const p = game.player, d = dist(e.x, e.y, p.x, p.y), a = Math.atan2(p.y - e.y, p.x - e.x);
    e.t += dt;
    e.cd -= dt;
    if (e.state === 'move') {
      e.face = Math.cos(a) >= 0 ? 1 : -1;
      if (d > 26) steer(e, a, e.speed, dt); else brake(e, dt);
      if (d < 42 && e.cd <= 0) { setState(e, 'wind'); e.aim = a; }
    } else if (e.state === 'wind') {
      brake(e, dt);
      if (e.t < 0.3) e.aim = a;
      if (e.t >= 0.7) {
        const cx = e.x + Math.cos(e.aim) * 20, cy = e.y + Math.sin(e.aim) * 20;
        FX.ring(cx, cy, 6, 28, '#d8d0c0', 0.3, 3);
        FX.burst(cx, cy, '#a8a0b0', 14, 80, 0.4, 2);
        Sound.play('slam');
        shake(2.5);
        if (dist(cx, cy, p.x, p.y) < 26 + p.r) hurtPlayer(e.d.dmg * e.dmgMult, cx, cy, e.type);
        setState(e, 'recover');
      }
    } else if (e.state === 'recover') {
      brake(e, dt);
      if (e.t > 0.9) { setState(e, 'move'); e.cd = rand(0.6, 1.2); }
    }
  },

  boss(e, dt) {
    const p = game.player, d = dist(e.x, e.y, p.x, p.y), a = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.phase === 1 && e.hp < e.maxHp * BOSS.phase2) {
      e.phase = 2;
      setState(e, 'rage');
      e.invuln = 1.6;
      Sound.play('roar');
      shake(7);
      showBanner(`${BOSS.name} rast!`, 'Seine Angriffe werden schneller', '#ff8a3a');
    }
    const sp = e.phase === 2 ? 1.25 : 1;
    e.t += dt * sp;
    switch (e.state) {
      case 'intro':
        if (e.t > 0.6 && !e.done) {
          e.done = true;
          Sound.play('roar');
          shake(7);
          FX.ring(e.x, e.y - 20, 10, 120, '#ff8a3a', 0.8, 4);
        }
        if (e.t > 2.2) setState(e, 'idle');
        break;
      case 'rage':
        brake(e, dt);
        if (chance(dt * 25)) FX.burst(e.x + rand(-20, 20), e.y - rand(10, 50), '#ff8a3a', 2, 40, 0.6, 3, { up: 40, glow: 6 });
        if (e.t > 1.6) setState(e, 'idle');
        break;
      case 'idle':
        steer(e, a, d > 50 ? e.speed : 0, dt);
        if (e.t > (e.phase === 2 ? 0.5 : 0.8)) chooseBossAttack(e, d);
        break;
      case 'claw':
        brake(e, dt);
        if (e.t < 0.3) e.aim = a;
        if (!e.done && e.t >= 0.6) {
          e.done = true;
          FX.slash(e.x, e.y - 14, e.aim, 62, 2.4, 'rgba(255,140,80,0.6)', 0.2);
          Sound.play('heavy');
          shake(3);
          if (d < 64 && Math.abs(angDiff(e.aim, a)) < 1.25) hurtPlayer(BOSS.claw, e.x, e.y, 'boss');
        }
        if (e.t > 1.0) setState(e, 'idle');
        break;
      case 'slam':
        brake(e, dt);
        if (!e.done && e.t >= 0.95) {
          e.done = true;
          Sound.play('slam');
          shake(7);
          FX.ring(e.x, e.y, 10, 70, '#ff8a3a', 0.45, 4);
          FX.burst(e.x, e.y, '#ff8a3a', 26, 130, 0.6, 3, { glow: 6 });
          if (d < 68) hurtPlayer(BOSS.slam, e.x, e.y, 'boss');
          const n = e.phase === 2 ? 24 : 16, off = rand(0, TAU);
          for (let i = 0; i < n; i++) enemyShot(e.x, e.y - 6, off + (i / n) * TAU, 95, BOSS.bullet, '#ff8a3a', 3.5, 'boss');
        }
        if (e.t > 1.7) setState(e, 'idle');
        break;
      case 'charge':
        if (e.sub === 'wind') {
          brake(e, dt);
          if (e.t < 0.35) e.aim = a;
          if (e.t >= 0.65) { e.sub = 'go'; e.t = 0; e.hitDone = false; Sound.play('dash'); }
        } else {
          const hit = moveEnt(e, Math.cos(e.aim) * 320 * dt, Math.sin(e.aim) * 320 * dt);
          if (chance(dt * 40)) FX.burst(e.x, e.y, '#a07050', 2, 30, 0.4, 3);
          if (!e.hitDone && d < e.r + p.r + 6) { e.hitDone = true; hurtPlayer(BOSS.charge, e.x, e.y, 'boss'); }
          if (hit || e.t > 0.85) {
            if (hit) {
              shake(5);
              Sound.play('slam');
              FX.burst(e.x, e.y - 10, '#d8d0c0', 16, 90, 0.5, 3);
              if (e.phase === 2) for (let i = 0; i < 10; i++) enemyShot(e.x, e.y - 6, (i / 10) * TAU, 85, BOSS.bullet, '#ff8a3a', 3.5, 'boss');
            }
            e.count--;
            if (e.count > 0) { e.sub = 'wind'; e.t = 0.2; } else setState(e, 'idle');
          }
        }
        break;
      case 'spiral':
        brake(e, dt);
        e.spinT -= dt * sp;
        if (e.spinT <= 0) {
          e.spinT = 0.09;
          const arms = e.phase === 2 ? 4 : 3;
          for (let i = 0; i < arms; i++) enemyShot(e.x, e.y - 18, e.spin + (i / arms) * TAU, 80, BOSS.bullet, '#ffb05a', 3, 'boss');
          e.spin += 0.22;
          Sound.play('eshoot');
        }
        if (e.t > 2.6) setState(e, 'idle');
        break;
      case 'meteor':
        brake(e, dt);
        e.meteorT -= dt * sp;
        if (e.meteorsLeft > 0 && e.meteorT <= 0) {
          e.meteorT = 0.14;
          e.meteorsLeft--;
          const first = e.meteorsLeft === (e.phase === 2 ? 10 : 6);
          const tx = p.x + (first ? 0 : rand(-60, 60)), ty = p.y + (first ? 0 : rand(-45, 45));
          if (!solidAt(game.room, tx, ty, true)) game.warnings.push({ x: tx, y: ty, r: 22, t: 0, dur: 1.0, dmg: BOSS.meteor, color: '#ff8a3a' });
        }
        if (e.t > 2.4) setState(e, 'idle');
        break;
      case 'summon':
        brake(e, dt);
        if (!e.done && e.t > 0.5) {
          e.done = true;
          Sound.play('roar');
          for (const t of ['imp', 'imp', 'shroom']) {
            const pos = randomSpawnPos(game.room, 60);
            game.enemies.push(makeEnemy(t, pos.x, pos.y));
          }
        }
        if (e.t > 1.4) setState(e, 'idle');
        break;
    }
  },
};
function chooseBossAttack(e, d) {
  const opts = [
    { s: 'claw', w: d < 75 ? 4 : 0.2 }, { s: 'slam', w: 2 }, { s: 'charge', w: 2 },
    { s: 'spiral', w: 1.6 }, { s: 'meteor', w: 1.6 },
  ];
  if (e.phase === 2 && game.enemies.filter((x) => !x.dead && !x.boss).length < 3) opts.push({ s: 'summon', w: 1.2 });
  const c = weightedPick(opts.filter((o) => o.s !== e.last), (o) => o.w);
  e.last = c.s;
  setState(e, c.s);
  if (c.s === 'charge') { e.sub = 'wind'; e.count = e.phase === 2 ? 3 : 2; }
  if (c.s === 'spiral') { e.spinT = 0; e.spin = rand(0, TAU); }
  if (c.s === 'meteor') { e.meteorsLeft = e.phase === 2 ? 11 : 7; e.meteorT = 0.3; }
}

// Bodenwarnungen (Felsbrocken des Bosses)
function updateWarnings(dt) {
  const p = game.player;
  for (const w of game.warnings) {
    w.t += dt;
    if (w.t >= w.dur && !w.done) {
      w.done = true;
      FX.ring(w.x, w.y, 4, w.r, w.color, 0.3, 3);
      FX.burst(w.x, w.y, w.color, 14, 90, 0.5, 2.5, { glow: 6 });
      FX.burst(w.x, w.y, '#5a4a40', 8, 60, 0.5, 3);
      Sound.play('boom');
      shake(2);
      if (dist(w.x, w.y, p.x, p.y) < w.r + p.r) hurtPlayer(w.dmg, w.x, w.y, 'boss');
    }
  }
  game.warnings = game.warnings.filter((w) => !w.done);
}
function drawWarnings() {
  for (const w of game.warnings) {
    const k = w.t / w.dur;
    ctx.globalAlpha = 0.15 + 0.25 * k;
    fillCircle(w.x, w.y, w.r, '#ff3a2a');
    ctx.globalAlpha = 0.8;
    strokeCircle(w.x, w.y, w.r, '#ff6a4a', 1);
    strokeCircle(w.x, w.y, w.r * k, '#ffb08a', 1);
    ctx.globalAlpha = 1;
    const h = (1 - k) * 140;
    fillCircle(w.x, w.y - h, 4, '#3a2a24');
    fillCircle(w.x - 1, w.y - h - 1, 2, '#ff8a3a');
  }
}

// ---------- Wellen ----------
function planWaves(depth, kind) {
  if (kind === 'guardian') {
    return [
      [{ type: 'knight', elite: true }, { type: 'ram', elite: true }, { type: 'imp' }, { type: 'imp' }, { type: 'spitter' }],
      [{ type: 'eye', elite: true }, { type: 'knight', elite: true }, { type: 'shroom' }, { type: 'shroom' }, { type: 'ram' }],
      [{ type: 'ram', elite: true }, { type: 'ram', elite: true }, { type: 'eye' }, { type: 'spitter', elite: true }, { type: 'imp', elite: true }],
    ];
  }
  const elite = kind === 'elite';
  const types = Object.keys(ENEMIES).filter((t) => ENEMIES[t].from <= depth);
  const n = WAVES.waves + (depth >= WAVES.extraWaveFrom ? 1 : 0) + (elite ? 1 : 0);
  const waves = [];
  for (let i = 0; i < n; i++) {
    let budget = WAVES.base + depth * WAVES.perRoom + i * 1.5;
    if (elite) budget *= 1.2;
    const list = [];
    while (budget > 0.5 && list.length < 14) {
      const t = weightedPick(types, (x) => (x === 'imp' ? 3 : x === 'spitter' ? 2 : 1.4));
      list.push({ type: t, elite: elite && chance(0.3) });
      budget -= ENEMIES[t].cost;
    }
    waves.push(list);
  }
  return waves;
}
function spawnWave(list) {
  for (const s of list) {
    const pos = randomSpawnPos(game.room, 80);
    game.enemies.push(makeEnemy(s.type, pos.x, pos.y, s));
  }
  Sound.play('spawn');
}

// ---------- Zeichnen ----------
function drawTelegraph(e) {
  if (e.dead || e.spawnT > 0) return;
  const red = (a) => `rgba(255,60,50,${a})`;
  const k = clamp(e.t / 0.6, 0, 1);
  ctx.fillStyle = red(0.12 + 0.25 * k);
  ctx.strokeStyle = red(0.7);
  ctx.lineWidth = 1;
  const wedge = (x, y, ang, r, arc) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, ang - arc / 2, ang + arc / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  const line = (x, y, ang, len, w) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillRect(0, -w / 2, len, w);
    ctx.strokeRect(0, -w / 2, len, w);
    ctx.restore();
  };
  if (e.type === 'imp' && e.state === 'wind') wedge(e.x, e.y, e.aim, 32, 2.2);
  else if (e.type === 'ram' && e.state === 'wind') line(e.x, e.y, e.aim, 175, e.r * 2 + 4);
  else if (e.type === 'knight' && e.state === 'wind') {
    const cx = e.x + Math.cos(e.aim) * 20, cy = e.y + Math.sin(e.aim) * 20;
    fillCircle(cx, cy, 26, red(0.1 + 0.25 * k));
    strokeCircle(cx, cy, 26 * k, red(0.8));
  } else if (e.type === 'shroom' && e.state === 'fuse') {
    fillCircle(e.x, e.y, 36, red(0.1 + 0.25 * clamp(e.t / 0.85, 0, 1)));
    strokeCircle(e.x, e.y, 36 * clamp(e.t / 0.85, 0, 1), red(0.8));
  } else if (e.boss) {
    if (e.state === 'claw' && !e.done) wedge(e.x, e.y, e.aim, 64, 2.5);
    else if (e.state === 'slam' && !e.done) {
      const kk = clamp(e.t / 0.95, 0, 1);
      fillCircle(e.x, e.y, 68, red(0.1 + 0.2 * kk));
      strokeCircle(e.x, e.y, 68 * kk, red(0.8));
    } else if (e.state === 'charge' && e.sub === 'wind') line(e.x, e.y, e.aim, 220, e.r * 2 + 8);
  }
}

function drawEnemy(e) {
  if (e.spawnT > 0) {
    const k = 1 - e.spawnT / 0.8;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(game.time * 4);
    ctx.globalAlpha = 0.4 + 0.5 * k;
    strokeCircle(0, 0, 12 - 4 * k, '#b583ff', 1.2);
    ctx.fillStyle = '#e0c8ff';
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; ctx.fillRect(Math.cos(a) * 9 - 1, Math.sin(a) * 9 - 1, 2, 2); }
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }
  const spr = SPR[e.type];
  const sc = e.boss ? 2 : 1;
  const fly = e.fly ? 8 + Math.sin(game.time * 3 + e.bob) * 2 : 0;
  shadowEllipse(e.x, e.y, e.r + 2, e.boss ? 6 : 2.5, 0.35);
  let sy = 1, sx = 1;
  if (e.state === 'wind' || e.state === 'fuse' || (e.boss && ['claw', 'slam'].includes(e.state) && !e.done)) {
    const k = Math.min(1, e.t / 0.5);
    sy = 1 - 0.1 * k;
    sx = 1 + 0.08 * k;
    if (e.state === 'fuse' && Math.floor(e.t * 14) % 2 === 0) sx = 1.15;
  } else if (Math.hypot(e.vx, e.vy) > 10) sy = 1 + Math.sin(game.time * 12 + e.bob) * 0.05;
  if (e.state === 'stun') sy = 0.92;
  const flip = !e.boss && e.face < 0;
  const y = e.y - fly;
  if (e.elite) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawSprite(spr, e.x + dx, y + dy, { flip, scale: sc, sy, sx, tint: '#d070ff', alpha: 0.85 });
  }
  if (e.boss && e.phase === 2) drawSprite(spr, e.x, y + 1, { scale: sc * 1.04, sy, sx, tint: '#ff5a2a', alpha: 0.5 });
  drawSprite(spr, e.x, y, { flip, white: e.flash > 0, scale: sc, sy, sx });
  if (e.chillT > 0 && e.freezeT <= 0) drawSprite(spr, e.x, y, { flip, scale: sc, sy, sx, tint: '#7fd6ff', alpha: 0.35 });
  const top = y - spr.h * sc * sy;
  if (e.freezeT > 0) {
    ctx.fillStyle = 'rgba(170,225,255,0.45)';
    ctx.fillRect(e.x - spr.w * sc / 2 - 2, top - 2, spr.w * sc + 4, spr.h * sc + 3);
    ctx.strokeStyle = '#e8f8ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(e.x - spr.w * sc / 2 - 2, top - 2, spr.w * sc + 4, spr.h * sc + 3);
  }
  if (e.markT > 0) {
    ctx.save();
    ctx.translate(e.x, top - 6);
    ctx.rotate(game.time * 3);
    ctx.fillStyle = ELEMENTS.shadow.color;
    ctx.fillRect(-2.5, -2.5, 5, 5);
    ctx.fillStyle = '#1a0a2a';
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  // Lebensbalken
  if (!e.boss && !e.dummy && (e.hp < e.maxHp || e.armor < e.maxArmor)) {
    const w = e.elite ? 22 : 16, bx = e.x - w / 2, by = top - (e.markT > 0 ? 13 : 5);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx - 0.5, by - 0.5, w + 1, 3);
    ctx.fillStyle = '#e04848';
    ctx.fillRect(bx, by, (w * Math.max(0, e.hp)) / e.maxHp, 2);
    if (e.maxArmor > 0 && e.armor > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx - 0.5, by - 3, w + 1, 2.5);
      ctx.fillStyle = '#c8c8e0';
      ctx.fillRect(bx, by - 2.5, (w * e.armor) / e.maxArmor, 1.5);
    }
    if (e.frost > 0) for (let i = 0; i < e.frost; i++) { ctx.fillStyle = '#7fd6ff'; ctx.fillRect(bx + i * 3, by + 3, 2, 1.5); }
  }
}
function drawEnemyLights(e) {
  if (e.spawnT > 0) { glow(e.x, e.y, 16, '#b583ff', 0.5); return; }
  if (e.type === 'eye' && e.state === 'wind') glow(e.x, e.y - 14, 24, '#e070ff', 0.6);
  if (e.type === 'shroom' && e.state === 'fuse') glow(e.x, e.y - 5, 26, '#ff60a0', 0.5);
  if (e.burn > 0) glow(e.x, e.y - 6, 16, '#ff8a3a', 0.3);
  if (e.boss) glow(e.x, e.y - 40, 70, '#ff6a2a', e.phase === 2 ? 0.35 : 0.2);
  if (e.elite) glow(e.x, e.y - 6, 18, '#c060ff', 0.25);
}
