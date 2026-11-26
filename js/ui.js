'use strict';
// ===== Anzeige: HUD, Karten-Auswahl, Menüs, Symbole =====

// ---------- Symbole ----------
function drawElIcon(el, x, y, s, alpha = 1) {
  const E = ELEMENTS[el];
  ctx.globalAlpha = alpha;
  if (el === 'fire') {
    ctx.fillStyle = E.color;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x + s, y, x, y + s * 0.9);
    ctx.quadraticCurveTo(x - s, y, x, y - s);
    ctx.fill();
    ctx.fillStyle = E.light;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.2);
    ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.4, x, y + s * 0.8);
    ctx.quadraticCurveTo(x - s * 0.5, y + s * 0.4, x, y - s * 0.2);
    ctx.fill();
  } else if (el === 'frost') {
    ctx.strokeStyle = E.color;
    ctx.lineWidth = Math.max(1, s / 4);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
      ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      ctx.stroke();
    }
    fillCircle(x, y, s * 0.3, E.light);
  } else if (el === 'storm') {
    ctx.fillStyle = E.color;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y - s);
    ctx.lineTo(x - s * 0.6, y + s * 0.15);
    ctx.lineTo(x - s * 0.05, y + s * 0.15);
    ctx.lineTo(x - s * 0.35, y + s);
    ctx.lineTo(x + s * 0.65, y - s * 0.2);
    ctx.lineTo(x + s * 0.1, y - s * 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (el === 'shadow') {
    fillCircle(x, y, s * 0.85, E.color);
    fillCircle(x + s * 0.4, y - s * 0.25, s * 0.7, '#140c1e');
    fillCircle(x - s * 0.3, y + s * 0.1, s * 0.15, E.light);
  }
  ctx.globalAlpha = 1;
}
function specRewardType(spec) {
  if (['shop', 'spring', 'boss', 'start'].includes(spec.kind)) return spec.kind;
  return spec.reward.type;
}
const REWARD_COLORS = { gold: '#ffd24a', heart: '#ff6a7a', forge: '#ffb070', star: '#fff6a0', spring: '#7affc8', shop: '#ffd24a', boss: '#ff4a3a', start: '#b583ff' };
function doorColor(spec) {
  const t = specRewardType(spec);
  return t === 'boon' ? ELEMENTS[spec.reward.el].color : REWARD_COLORS[t] || '#ffffff';
}
function rewardLabel(spec) {
  const t = specRewardType(spec);
  let s;
  if (t === 'boon') s = `${ELEMENTS[spec.reward.el].name}-Segen`;
  else if (t === 'boss') s = `${BOSS.name}, ${BOSS.title}`;
  else if (t === 'start') s = 'Aufbruch';
  else s = REWARDS[t].name;
  if (spec.kind === 'elite') s += ' · Gefahr: stärkere Gegner, bessere Belohnung';
  if (spec.kind === 'guardian') s += ' · Wächterkammer';
  return s;
}
function drawRewardIcon(spec, x, y, alpha = 1) {
  const t = specRewardType(spec);
  drawTypeIcon(t, spec.reward && spec.reward.el, x, y, alpha);
  if (spec.kind === 'elite' || spec.kind === 'guardian') drawSkull(x + 7, y - 5, 2.5, '#ff5a4a', alpha);
}
function drawTypeIcon(t, el, x, y, alpha = 1, s = 1) {
  ctx.globalAlpha = alpha;
  switch (t) {
    case 'boon': drawElIcon(el, x, y, 6 * s, alpha); break;
    case 'gold':
      fillCircle(x, y, 4.5 * s, '#8a6a1a');
      fillCircle(x, y, 3.8 * s, '#ffd24a');
      fillCircle(x - 1 * s, y - 1 * s, 1.5 * s, '#fff6c0');
      break;
    case 'heart':
      ctx.fillStyle = '#ff6a7a';
      ctx.beginPath();
      ctx.moveTo(x, y + 5 * s);
      ctx.bezierCurveTo(x - 7 * s, y - 1 * s, x - 3 * s, y - 6 * s, x, y - 2 * s);
      ctx.bezierCurveTo(x + 3 * s, y - 6 * s, x + 7 * s, y - 1 * s, x, y + 5 * s);
      ctx.fill();
      fillCircle(x - 2.2 * s, y - 2 * s, 1 * s, '#ffd0d8');
      break;
    case 'forge':
      ctx.fillStyle = '#8a5a32';
      ctx.fillRect(x - 0.8 * s, y - 2 * s, 1.6 * s, 7 * s);
      ctx.fillStyle = '#c8ccd8';
      ctx.fillRect(x - 4.5 * s, y - 5 * s, 9 * s, 3.5 * s);
      ctx.fillStyle = '#ffb070';
      ctx.fillRect(x - 4.5 * s, y - 5 * s, 9 * s, 1 * s);
      break;
    case 'star':
      ctx.fillStyle = '#fff6a0';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2, r = (i % 2 ? 2 : 6) * s;
        i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.fill();
      break;
    case 'spring':
      ctx.fillStyle = '#7affc8';
      ctx.beginPath();
      ctx.moveTo(x, y - 6 * s);
      ctx.quadraticCurveTo(x + 5 * s, y + 1 * s, x, y + 5 * s);
      ctx.quadraticCurveTo(x - 5 * s, y + 1 * s, x, y - 6 * s);
      ctx.fill();
      fillCircle(x - 1.5 * s, y + 1 * s, 1 * s, '#e0fff4');
      break;
    case 'shop':
      fillCircle(x, y + 1 * s, 4.5 * s, '#8a5a32');
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(x - 2 * s, y - 5 * s, 4 * s, 2 * s);
      fillCircle(x, y + 1.5 * s, 1.8 * s, '#ffd24a');
      break;
    case 'boss': drawSkull(x, y, 5 * s, '#ff4a3a', alpha); break;
    case 'start':
      ctx.fillStyle = '#b583ff';
      ctx.beginPath();
      ctx.moveTo(x, y - 6 * s); ctx.lineTo(x + 4 * s, y); ctx.lineTo(x, y + 6 * s); ctx.lineTo(x - 4 * s, y);
      ctx.fill();
      break;
    case 'heal':
      ctx.fillStyle = '#ff6a7a';
      ctx.fillRect(x - 3 * s, y - 1 * s, 6 * s, 2 * s);
      ctx.fillRect(x - 1 * s, y - 3 * s, 2 * s, 6 * s);
      break;
  }
  ctx.globalAlpha = 1;
}
function drawSkull(x, y, s, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  fillCircle(x, y - s * 0.2, s, color);
  ctx.fillStyle = color;
  ctx.fillRect(x - s * 0.6, y + s * 0.4, s * 1.2, s * 0.7);
  fillCircle(x - s * 0.4, y - s * 0.2, s * 0.28, '#140c1e');
  fillCircle(x + s * 0.4, y - s * 0.2, s * 0.28, '#140c1e');
  ctx.globalAlpha = 1;
}

// ---------- Aufsammelbares ----------
function drawPickup(pk) {
  if (pk.type === 'coin') {
    const w = Math.abs(Math.cos(game.time * 6 + pk.x));
    ctx.fillStyle = '#8a6a1a';
    ctx.fillRect(pk.x - 2 * w - 0.5, pk.y - 5, 4 * w + 1, 5);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(pk.x - 2 * w, pk.y - 4.5, 4 * w, 4);
    return;
  }
  const bob = Math.sin(game.time * 3) * 2;
  shadowEllipse(pk.x, pk.y, 7, 2.5, 0.4);
  const spec = { kind: 'combat', reward: pk.reward };
  if (pk.reward.type === 'boon') {
    // drehender Kristall
    const c = ELEMENTS[pk.reward.el];
    const w = 5 * Math.abs(Math.cos(game.time * 2));
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.moveTo(pk.x, pk.y - 22 + bob); ctx.lineTo(pk.x + w + 1, pk.y - 14 + bob); ctx.lineTo(pk.x, pk.y - 5 + bob); ctx.lineTo(pk.x - w - 1, pk.y - 14 + bob);
    ctx.fill();
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.moveTo(pk.x, pk.y - 21 + bob); ctx.lineTo(pk.x + w, pk.y - 14 + bob); ctx.lineTo(pk.x, pk.y - 6 + bob); ctx.lineTo(pk.x - w, pk.y - 14 + bob);
    ctx.fill();
    ctx.fillStyle = c.light;
    ctx.fillRect(pk.x - 1, pk.y - 18 + bob, 2, 4);
  } else drawRewardIcon(spec, pk.x, pk.y - 12 + bob);
}
function drawPickupLight(pk) {
  if (pk.type === 'coin') { glow(pk.x, pk.y - 3, 8, '#ffd24a', 0.3); return; }
  const col = pk.reward.type === 'boon' ? ELEMENTS[pk.reward.el].color : REWARD_COLORS[pk.reward.type];
  glow(pk.x, pk.y - 13, 34, col, 0.5 + Math.sin(game.time * 3) * 0.1);
}

// ---------- HUD ----------
function panel(x, y, w, h, a = 0.78) {
  ctx.fillStyle = `rgba(12,7,18,${a})`;
  roundRect(x, y, w, h, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(181,131,255,0.25)';
  ctx.lineWidth = 0.75;
  ctx.stroke();
}
function drawHUD() {
  const p = game.player;
  // Leben
  panel(6, 6, 112, 24);
  const hpK = clamp(p.hp / p.maxHp, 0, 1);
  ctx.fillStyle = '#2a1420';
  ctx.fillRect(10, 10, 104, 8);
  const gr = ctx.createLinearGradient(0, 10, 0, 18);
  gr.addColorStop(0, '#ff6a6a');
  gr.addColorStop(1, '#b02a3a');
  ctx.fillStyle = gr;
  ctx.fillRect(10, 10, 104 * hpK, 8);
  if (p.hurtFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${p.hurtFlash * 2})`; ctx.fillRect(10, 10, 104 * hpK, 8); }
  text(`${Math.ceil(p.hp)} / ${p.maxHp}`, 62, 10.3, { size: 6, align: 'center', bold: true });
  // Sprint-Ladungen
  const md = maxDashes();
  for (let i = 0; i < md; i++) {
    const x = 14 + i * 9, y = 24;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    diamond(x, y, 3.5);
    if (i < p.dashCharges) { ctx.fillStyle = '#b583ff'; diamond(x, y, 3); }
    else if (i === p.dashCharges) {
      const k = p.dashRegen / (PLAYER_BASE.dashRecharge * (has('storm_swift') ? 0.8 : 1));
      ctx.fillStyle = '#5a3a8a';
      diamond(x, y, 3 * k);
    }
  }
  text('SPRINT', 14 + md * 9, 21.5, { size: 5, color: '#9a8ab0' });

  // Gold und Kammer
  panel(VIEW_W - 86, 6, 80, game.mode === 'run' ? 24 : 15);
  drawTypeIcon('gold', null, VIEW_W - 78, 13, 1, 0.8);
  text(`${p.gold}`, VIEW_W - 70, 9.5, { size: 7, bold: true, color: '#ffe48a' });
  if (game.mode === 'run') {
    text(`KAMMER ${game.depth}/${RUN.rooms}`, VIEW_W - 10, 9.5, { size: 5.5, align: 'right', color: '#c8bcd8' });
    const alive = game.enemies.filter((e) => !e.dead && !e.dummy).length;
    const left = game.room.waves ? game.room.waves.length - game.room.wave : 0;
    if (game.room.fight && !game.room.cleared) text(`Gegner ${alive}${left > 0 ? ` · ${left} Welle${left > 1 ? 'n' : ''}` : ''}`, VIEW_W - 10, 19.5, { size: 5.5, align: 'right', color: '#9a8ab0' });
  } else text('ZUFLUCHT', VIEW_W - 10, 9.5, { size: 5.5, align: 'right', color: '#c8bcd8' });

  // Fähigkeiten unten links
  const W = WEAPONS[p.weapon];
  const slots = [
    { s: 'attack', cd: p.weapon === 'bow' || p.weapon === 'staff' ? p.shotCd / p.shotCdMax : 0 },
    { s: 'special', cd: p.specialCd / W.special.cd },
    { s: 'cast', cd: p.castCd / PLAYER_BASE.castCd },
    { s: 'dash', cd: p.dashCharges > 0 ? 0 : 1 - p.dashRegen / PLAYER_BASE.dashRecharge },
  ];
  slots.forEach((sl, i) => {
    const x = 8 + i * 25, y = VIEW_H - 32;
    const b = p.boons[sl.s];
    panel(x, y, 21, 21, 0.85);
    if (b) { ctx.strokeStyle = ELEMENTS[b.el].color; ctx.lineWidth = 1.2; roundRect(x, y, 21, 21, 3); ctx.stroke(); }
    drawSlotIcon(sl.s, x + 10.5, y + 10.5, p);
    if (sl.cd > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.moveTo(x + 10.5, y + 10.5);
      ctx.arc(x + 10.5, y + 10.5, 13, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(sl.cd, 0, 1));
      ctx.closePath();
      ctx.save();
      roundRect(x, y, 21, 21, 3);
      ctx.clip();
      ctx.fill();
      ctx.restore();
    }
    if (b) drawElIcon(b.el, x + 18, y + 3, 2.6);
    text(SLOT_KEYS[sl.s], x + 10.5, y + 22.5, { size: 4.5, align: 'center', color: '#a898c0' });
  });
  // Passive Segen als kleine Steine
  const pas = Object.values(p.passives);
  pas.forEach((b, i) => {
    const x = 112 + (i % 10) * 11, y = VIEW_H - 25 + Math.floor(i / 10) * 11;
    panel(x - 5, y - 5, 10, 10, 0.85);
    const els = boonEls(b);
    if (els.length === 2) { drawElIcon(els[0], x - 1.5, y, 2.5); drawElIcon(els[1], x + 1.5, y, 2.5); } else drawElIcon(els[0], x, y, 3.2);
  });
  if (game.mode === 'run' && (allBoons().length || p.mods.size)) text('TAB: Segen ansehen', 8, VIEW_H - 41, { size: 4.5, color: '#7a6a90' });
}
function diamond(x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
  ctx.fill();
}
function drawSlotIcon(slot, x, y, p) {
  if (slot === 'attack') {
    const spr = SPR[p.weapon];
    const [gx, gy] = WEAPON_GRIP[p.weapon];
    const sc = Math.min(1, 15 / spr.w);
    ctx.save();
    ctx.translate(x - 5, y + 5);
    ctx.rotate(-Math.PI / 4);
    ctx.scale(sc, sc);
    ctx.drawImage(spr.img, -gx + 2, -gy);
    ctx.restore();
  } else if (slot === 'special') {
    ctx.strokeStyle = WEAPONS[p.weapon].color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0.3, TAU - 0.6);
    ctx.stroke();
    fillCircle(x, y, 2, '#ffffff');
  } else if (slot === 'cast') {
    ctx.strokeStyle = p.boons.cast ? ELEMENTS[p.boons.cast.el].color : '#d8c8ff';
    ctx.lineWidth = 1;
    strokeCircle(x, y, 6, ctx.strokeStyle, 1);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * TAU) / 5 - Math.PI / 2;
      i ? ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5) : ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (slot === 'dash') {
    ctx.strokeStyle = '#b583ff';
    ctx.lineWidth = 1.5;
    for (const o of [-3, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + o - 2, y - 4); ctx.lineTo(x + o + 2, y); ctx.lineTo(x + o - 2, y + 4);
      ctx.stroke();
    }
  }
}

function drawBossBar() {
  const b = game.enemies.find((e) => e.boss && !e.dead);
  if (!b || b.state === 'intro') return;
  const w = 220, x = VIEW_W / 2 - w / 2, y = VIEW_H - 22;
  text(`${BOSS.name.toUpperCase()}  ·  ${BOSS.title}`, VIEW_W / 2, y - 10, { size: 6.5, align: 'center', title: true, color: '#ffc8a0' });
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(x - 1, y - 1, w + 2, 7);
  ctx.fillStyle = b.phase === 2 ? '#ff5a2a' : '#c83a2a';
  ctx.fillRect(x, y, (w * Math.max(0, b.hp)) / b.maxHp, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(x + w * BOSS.phase2, y, 1, 5);
}

function drawPrompt(str, sub) {
  const w = Math.max(textWidth(str, 7, { bold: true }), sub ? textWidth(sub, 5.5) : 0) + 16;
  const y = VIEW_H - 64;
  panel(VIEW_W / 2 - w / 2, y, w, sub ? 22 : 14, 0.88);
  text(str, VIEW_W / 2, y + 3.5, { size: 7, align: 'center', bold: true });
  if (sub) text(sub, VIEW_W / 2, y + 13, { size: 5.5, align: 'center', color: '#b8aec8' });
}

function drawBanner() {
  const b = game.banner;
  if (!b) return;
  const a = Math.min(1, b.t * 4, (b.dur - b.t) * 2);
  if (a <= 0) return;
  ctx.globalAlpha = a * 0.6;
  const gr = ctx.createLinearGradient(0, 0, VIEW_W, 0);
  gr.addColorStop(0, 'rgba(10,5,16,0)');
  gr.addColorStop(0.5, 'rgba(10,5,16,1)');
  gr.addColorStop(1, 'rgba(10,5,16,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 46, VIEW_W, b.sub ? 34 : 24);
  ctx.globalAlpha = 1;
  text(b.text, VIEW_W / 2, 50, { size: 14, align: 'center', title: true, color: b.color || '#f0e0ff', alpha: a });
  if (b.sub) text(b.sub, VIEW_W / 2, 68, { size: 6.5, align: 'center', color: '#c8bcd8', alpha: a });
}

// Liste aller Segen (Tab)
function drawBoonPanel() {
  const p = game.player;
  const list = allBoons();
  const mods = WEAPON_MODS[p.weapon].filter((m) => p.mods.has(m.id));
  ctx.fillStyle = 'rgba(6,3,10,0.7)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text('Deine Segen', VIEW_W / 2, 16, { size: 13, align: 'center', title: true });
  // Element-Stufen
  ELEMENT_ORDER.forEach((el, i) => {
    const x = VIEW_W / 2 - 150 + i * 100;
    drawElIcon(el, x, 40, 4.5);
    text(`${ELEMENTS[el].name}-Stufe ${resonance(el)}`, x + 7, 36.5, { size: 6.5, color: ELEMENTS[el].color, bold: true });
  });
  let y = 54;
  const col = (b, x, yy) => {
    const els = boonEls(b);
    els.forEach((el, k) => drawElIcon(el, x + 4 + k * 7, yy + 5, 3.5));
    text(`${boonName(b)}`, x + 14 + (els.length - 1) * 7, yy, { size: 7, bold: true, color: RARITY[b.rar].color });
    const kind = b.kind === 'slot' ? SLOT_NAMES[b.slot] : b.kind === 'duo' ? 'Duo' : 'Passiv';
    text(`${kind} · Stufe ${b.level} · ${RARITY[b.rar].name}`, x + 14 + (els.length - 1) * 7, yy + 8.5, { size: 5, color: '#9a8ab0' });
    const lines = wrapText(boonDesc(b), 190, 5.5);
    lines.forEach((l, i) => text(l, x + 14, yy + 15 + i * 7, { size: 5.5, color: '#ddd4e6' }));
    return 18 + lines.length * 7;
  };
  let yl = y, yr = y;
  list.forEach((b, i) => {
    if (i % 2 === 0) yl += col(b, 20, yl); else yr += col(b, 250, yr);
  });
  if (!list.length) text('Noch keine Segen. Sie liegen hinter den Türen.', VIEW_W / 2, 80, { size: 7, align: 'center', color: '#9a8ab0' });
  if (mods.length) {
    const yy = Math.max(yl, yr) + 4;
    text(`${WEAPONS[p.weapon].name}: ${mods.map((m) => m.name).join(', ')}`, VIEW_W / 2, Math.min(VIEW_H - 14, yy), { size: 6, align: 'center', color: WEAPONS[p.weapon].color });
  }
}

// ---------- Karten-Auswahl ----------
function choiceLayout(n) {
  const cw = 138, gap = 10, total = n * cw + (n - 1) * gap;
  return { cw, gap, x0: VIEW_W / 2 - total / 2, y: 62, h: 168 };
}
function drawChoice() {
  const o = game.overlay;
  ctx.fillStyle = 'rgba(6,3,10,0.74)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(o.title, VIEW_W / 2, 18, { size: 16, title: true, align: 'center', color: o.color || '#f0e0ff' });
  if (o.sub) text(o.sub, VIEW_W / 2, 40, { size: 6.5, align: 'center', color: '#b8aec8' });
  const L = choiceLayout(o.options.length);
  o.options.forEach((opt, i) => {
    const appear = clamp((o.t - i * 0.07) / 0.22, 0, 1);
    const ease = 1 - (1 - appear) * (1 - appear);
    const x = L.x0 + i * (L.cw + L.gap);
    const sel = o.sel === i;
    const y = L.y + (1 - ease) * 14 - (sel ? 3 : 0);
    ctx.globalAlpha = ease;
    drawCard(opt, x, y, L.cw, L.h, sel, i);
    ctx.globalAlpha = 1;
  });
  text('Karte anklicken oder Taste 1–3', VIEW_W / 2, VIEW_H - 18, { size: 6, align: 'center', color: '#8a7aa0' });
}
function drawCard(opt, x, y, w, h, sel, i) {
  const b = opt.boon;
  const color = b ? ELEMENTS[boonEls(b)[0]].color : opt.mod ? WEAPONS[game.player.weapon].color : '#fff';
  const color2 = b && b.kind === 'duo' ? ELEMENTS[boonEls(b)[1]].color : color;
  const a = ctx.globalAlpha;
  if (sel) glow(x + w / 2, y + h / 2, w * 0.9, color, 0.25 * a);
  ctx.globalAlpha = a;
  ctx.fillStyle = '#140d1e';
  roundRect(x, y, w, h, 4);
  ctx.fill();
  const gr = ctx.createLinearGradient(x, y, x + w, y);
  gr.addColorStop(0, color);
  gr.addColorStop(1, color2);
  ctx.strokeStyle = gr;
  ctx.lineWidth = sel ? 2 : 1;
  ctx.stroke();
  // Kopfzeile
  ctx.fillStyle = hexA(color, 0.18);
  ctx.fillRect(x + 1, y + 1, w - 2, 22);
  text(`${i + 1}`, x + 6, y + 6, { size: 6, color: '#8a7aa0', bold: true });
  if (b) {
    const els = boonEls(b);
    els.forEach((el, k) => drawElIcon(el, x + w / 2 - (els.length - 1) * 6 + k * 12, y + 12, 6));
    const kind = b.kind === 'slot' ? SLOT_NAMES[b.slot].toUpperCase() : b.kind === 'duo' ? 'DUO' : 'PASSIV';
    text(kind, x + w - 6, y + 6, { size: 5, align: 'right', color: '#c8bcd8', bold: true });
    const nameLines = wrapText(boonName(b), w - 12, 10, { title: true });
    let yy = y + 28;
    nameLines.forEach((l) => { text(l, x + w / 2, yy, { size: 10, title: true, align: 'center' }); yy += 12; });
    text(RARITY[b.rar].name.toUpperCase(), x + w / 2, yy, { size: 5.5, align: 'center', color: RARITY[b.rar].color, bold: true });
    yy += 8;
    text(opt.tag, x + w / 2, yy, { size: 5.5, align: 'center', color: '#ffd86a', bold: true });
    yy += 11;
    for (const l of wrapText(boonDesc(b), w - 14, 6.5)) { text(l, x + w / 2, yy, { size: 6.5, align: 'center', color: '#ece4f2' }); yy += 8.5; }
    if (b.kind === 'slot' && b.slot !== 'dash') {
      yy += 3;
      for (const l of wrapText(STATUS_TEXT[b.el], w - 16, 5.5)) { text(l, x + w / 2, yy, { size: 5.5, align: 'center', color: '#9a8ab0', italic: true }); yy += 7; }
    }
    // Element-Stufe davor/danach
    const isNew = !opt.tag.startsWith('STUFE') || opt.tag.includes('→');
    els.forEach((el, k) => {
      const now = resonance(el);
      const yb = y + h - 20 + k * 8 - (els.length - 1) * 4;
      text(`${ELEMENTS[el].name}-Stufe ${now} → ${now + 1}`, x + w / 2, yb, { size: 5.5, align: 'center', color: ELEMENTS[el].color, bold: true });
    });
    if (els.length === 1) text(`alle ${ELEMENTS[els[0]].name}-Effekte +${Math.round(STATUS.resoStep * 100)}%`, x + w / 2, y + h - 11, { size: 5, align: 'center', color: '#8a7aa0' });
    void isNew;
  } else if (opt.mod) {
    drawTypeIcon('forge', null, x + w / 2, y + 13, 1, 1);
    text('WAFFE', x + w - 6, y + 6, { size: 5, align: 'right', color: '#c8bcd8', bold: true });
    let yy = y + 30;
    for (const l of wrapText(opt.mod.name, w - 12, 10, { title: true })) { text(l, x + w / 2, yy, { size: 10, title: true, align: 'center' }); yy += 12; }
    text(WEAPONS[game.player.weapon].name.toUpperCase(), x + w / 2, yy, { size: 5.5, align: 'center', color, bold: true });
    yy += 14;
    for (const l of wrapText(opt.mod.desc, w - 14, 6.5)) { text(l, x + w / 2, yy, { size: 6.5, align: 'center', color: '#ece4f2' }); yy += 8.5; }
  }
}

// ---------- Menüs und Bildschirme ----------
function drawMenu(title, items, sel, sub) {
  ctx.fillStyle = 'rgba(6,3,10,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(title, VIEW_W / 2, 60, { size: 20, title: true, align: 'center' });
  if (sub) text(sub, VIEW_W / 2, 86, { size: 6.5, align: 'center', color: '#b8aec8' });
  items.forEach((it, i) => {
    const y = 108 + i * 20;
    const on = sel === i;
    if (on) { ctx.fillStyle = 'rgba(181,131,255,0.18)'; ctx.fillRect(VIEW_W / 2 - 70, y - 3, 140, 15); }
    text(it, VIEW_W / 2, y, { size: 8.5, align: 'center', color: on ? '#ffffff' : '#a898c0', bold: on });
  });
}
function menuHover(n) {
  for (let i = 0; i < n; i++) {
    const y = 108 + i * 20;
    if (Input.mx > VIEW_W / 2 - 70 && Input.mx < VIEW_W / 2 + 70 && Input.my > y - 3 && Input.my < y + 12) return i;
  }
  return -1;
}

function drawTitle() {
  ctx.fillStyle = 'rgba(6,3,10,0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const t = game.time;
  glow(VIEW_W / 2, 92, 140, '#6a3aa8', 0.35 + Math.sin(t * 1.5) * 0.05);
  text('HEXENPFAD', VIEW_W / 2, 66, { size: 38, title: true, align: 'center', color: '#efe0ff', bold: true });
  text('Ein Rogue-lite aus Klinge, Magie und Elementen', VIEW_W / 2, 112, { size: 7.5, align: 'center', color: '#c8b8e0', italic: true });
  const a = 0.55 + Math.sin(t * 3) * 0.35;
  text('Klicke oder drücke eine Taste', VIEW_W / 2, 176, { size: 8, align: 'center', alpha: a });
  text('WASD laufen · Maus zielen · LMT Angriff · RMT Spezial · Q Siegel · LEERTASTE Sprint · E benutzen', VIEW_W / 2, VIEW_H - 20, { size: 5.5, align: 'center', color: '#8a7aa0' });
}
function drawEndScreen(won) {
  const k = clamp(game.stateT / 0.8, 0, 1);
  ctx.fillStyle = `rgba(6,3,10,${0.8 * k})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.globalAlpha = k;
  const r = game.run;
  text(won ? 'SIEG' : 'GEFALLEN', VIEW_W / 2, 44, { size: 32, title: true, align: 'center', color: won ? '#ffd86a' : '#ff6a6a', bold: true });
  text(won ? `${BOSS.name} ist besiegt. Der Pfad ist frei.` : 'Die Hexe kehrt in die Zuflucht zurück.', VIEW_W / 2, 84, { size: 7.5, align: 'center', color: '#c8bcd8', italic: true });
  const m = Math.floor(r.time / 60), s = Math.floor(r.time % 60);
  const rows = [
    ['Waffe', WEAPONS[game.player.weapon].name],
    ['Kammer erreicht', `${game.depth} / ${RUN.rooms}`],
    ['Gegner besiegt', r.kills],
    ['Schaden ausgeteilt', Math.round(r.dmg)],
    ['Zeit', `${m}:${String(s).padStart(2, '0')}`],
  ];
  rows.forEach(([a, b], i) => {
    text(a, VIEW_W / 2 - 6, 106 + i * 12, { size: 7, align: 'right', color: '#9a8ab0' });
    text(String(b), VIEW_W / 2 + 6, 106 + i * 12, { size: 7, bold: true });
  });
  const list = allBoons();
  list.forEach((b, i) => {
    const x = VIEW_W / 2 - (list.length - 1) * 7 + i * 14;
    const els = boonEls(b);
    drawElIcon(els[0], x, 178, 4.5);
  });
  if (game.stateT > 1) text('Klicke, um weiterzumachen', VIEW_W / 2, 214, { size: 7, align: 'center', alpha: 0.6 + Math.sin(game.time * 3) * 0.3 });
  ctx.globalAlpha = 1;
}

function drawHubInfo() {
  const st = game.stats;
  panel(VIEW_W / 2 - 118, 4, 236, 15, 0.7);
  text('WASD laufen · LMT Angriff · RMT Spezial · Q Siegel · LEERTASTE Sprint · E benutzen', VIEW_W / 2, 8, { size: 5, align: 'center', color: '#c8bcd8' });
  text(`Läufe ${st.runs} · Siege ${st.wins} · Beste Kammer ${st.best}`, VIEW_W - 10, 33, { size: 5, align: 'right', color: '#8a7aa0' });
}
function drawWeaponCard(id) {
  const W = WEAPONS[id];
  const w = 190, h = 52, x = VIEW_W / 2 - w / 2, y = VIEW_H - 122;
  panel(x, y, w, h, 0.9);
  ctx.strokeStyle = hexA(W.color, 0.7);
  ctx.lineWidth = 1;
  roundRect(x, y, w, h, 3);
  ctx.stroke();
  text(W.name, x + 8, y + 5, { size: 10, title: true, color: W.color });
  text(W.kind.toUpperCase(), x + w - 8, y + 7, { size: 5.5, align: 'right', color: '#9a8ab0', bold: true });
  wrapText(W.desc, w - 16, 5.5).forEach((l, i) => text(l, x + 8, y + 18 + i * 7, { size: 5.5, color: '#ddd4e6' }));
  text(`LMT: ${W.attackText}`, x + 8, y + 33, { size: 5.5, color: '#c8bcd8' });
  text(`RMT: ${W.specialText}`, x + 8, y + 41, { size: 5.5, color: '#c8bcd8' });
}

function drawCursor() {
  const x = Input.mx, y = Input.my;
  const inMenu = game.state !== 'play';
  if (inMenu) {
    ctx.fillStyle = '#efe0ff';
    ctx.strokeStyle = '#140c1e';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + 7, y + 5); ctx.lineTo(x + 3, y + 5.5); ctx.lineTo(x + 1, y + 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }
  ctx.strokeStyle = 'rgba(20,12,30,0.8)';
  ctx.lineWidth = 2.2;
  strokeCircle(x, y, 4.5, ctx.strokeStyle, 2.2);
  strokeCircle(x, y, 4.5, '#efe0ff', 1);
  ctx.fillStyle = '#efe0ff';
  ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
}
