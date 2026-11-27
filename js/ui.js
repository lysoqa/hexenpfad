'use strict';
// ===== Anzeige: HUD, Karten-Auswahl, Menüs, Symbole =====

// ---------- Symbole (die Zeichnungen stehen in emblems.js) ----------
function drawElIcon(el, x, y, s, alpha = 1) { drawEmblem(el, x, y, s, { alpha }); }
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
  drawTypeEmblem(t, x, y, 6, { el: spec.reward && spec.reward.el, alpha });
  if (spec.kind === 'elite' || spec.kind === 'guardian') drawTypeEmblem('boss', x + 8, y - 6, 2.8, { alpha });
}
function drawTypeIcon(t, el, x, y, alpha = 1, s = 1) { drawTypeEmblem(t, x, y, 5.5 * s, { el, alpha }); }

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
  drawRewardAltar(pk);
}
function drawPickupLight(pk) {
  if (pk.type === 'coin') { glow(pk.x, pk.y - 3, 8, '#ffd24a', 0.3); return; }
  drawRewardAltarLight(pk);
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
  const cw = 138, gap = 12, total = n * cw + (n - 1) * gap;
  return { cw, gap, x0: VIEW_W / 2 - total / 2, y: 52, h: 186 };
}
// Teilchen im Hintergrund der Auswahl, passend zum Element
function updateChoiceParts(o, dt) {
  o.partT -= dt;
  while (o.partT <= 0) {
    o.partT += 0.035;
    const th = o.theme;
    let q;
    if (th === 'fire') q = { x: rand(0, VIEW_W), y: VIEW_H + 4, vx: rand(-6, 6), vy: rand(-42, -18), color: pick(['#ff8a3a', '#ffd08a', '#ff5a1a']) };
    else if (th === 'frost') q = { x: rand(-30, VIEW_W), y: -4, vx: rand(4, 16), vy: rand(10, 24), color: pick(['#ffffff', '#bff0ff', '#7fd6ff']) };
    else if (th === 'storm') q = { x: rand(0, VIEW_W), y: rand(0, VIEW_H), vx: rand(-70, 70), vy: rand(-70, 70), color: pick(['#fff6a0', '#ffffff', '#ffe95a']), life: 0.25 };
    else if (th === 'shadow') {
      const a = rand(0, TAU), d = rand(200, 260);
      q = { x: VIEW_W / 2 + Math.cos(a) * d, y: VIEW_H / 2 + Math.sin(a) * d * 0.6, vx: -Math.cos(a) * d * 0.22, vy: -Math.sin(a) * d * 0.13, color: pick(['#b583ff', '#ead9ff', '#7a4ad8']) };
    } else if (th === 'forge') q = { x: rand(0, VIEW_W), y: VIEW_H + 4, vx: rand(-20, 20), vy: rand(-80, -45), color: pick(['#ffd08a', '#ff8a3a']), grav: 30 };
    else q = { x: rand(0, VIEW_W), y: rand(0, VIEW_H), vx: 0, vy: rand(-6, -2), color: pick(['#fff6a0', '#ffffff']), life: 1.2 };
    q.life = q.life || rand(2.5, 4);
    q.max = q.life;
    q.size = rand(0.8, 1.8);
    q.ph = rand(0, TAU);
    o.parts.push(q);
  }
  for (const q of o.parts) {
    q.life -= dt;
    q.vy += (q.grav || 0) * dt;
    q.x += q.vx * dt + Math.sin(game.time * 2 + q.ph) * 5 * dt;
    q.y += q.vy * dt;
  }
  o.parts = o.parts.filter((q) => q.life > 0);
}
function ornamentLine(cx, y, half, color) {
  ctx.fillStyle = gLin(cx - half, 0, cx + half, 0, [[0, hexA(color, 0)], [0.5, hexA(color, 0.9)], [1, hexA(color, 0)]]);
  ctx.fillRect(cx - half, y, half * 2, 0.6);
  ctx.fillStyle = color;
  diamond(cx, y + 0.3, 2.3);
  for (const sg of [-1, 1]) diamond(cx + sg * 11, y + 0.3, 1.2);
  ctx.fillStyle = '#140a1e';
  diamond(cx, y + 0.3, 1);
}
function perimeterPoint(x, y, w, h, k) {
  let d = k * 2 * (w + h);
  if (d < w) return [x + d, y];
  d -= w;
  if (d < h) return [x + w, y + d];
  d -= h;
  if (d < w) return [x + w - d, y + h];
  return [x, y + h - (d - w)];
}
// Text mit hervorgehobener Zahl
function richText(str, val, cx, y, maxW, size, color, hi) {
  const re = val ? new RegExp(`(^|[^0-9])(${val}%?)(?![0-9])`) : null;
  for (const l of wrapText(str, maxW, size)) {
    const m = re ? re.exec(l) : null;
    if (!m) text(l, cx, y, { size, align: 'center', color });
    else {
      const idx = m.index + m[1].length;
      const a = l.slice(0, idx), mid = m[2], c = l.slice(idx + mid.length);
      const wa = textWidth(a, size), wm = textWidth(mid, size, { bold: true }), wc = textWidth(c, size);
      let sx = cx - (wa + wm + wc) / 2;
      text(a, sx, y, { size, color });
      sx += wa;
      text(mid, sx, y, { size, bold: true, color: hi });
      sx += wm;
      text(c, sx, y, { size, color });
    }
    y += size * 1.3;
  }
  return y;
}
function pill(cx, y, label, color, textColor, size = 5) {
  ctx.letterSpacing = '0.6px';
  const w = textWidth(label, size, { bold: true }) + 10;
  roundRect(cx - w / 2, y, w, size + 3.5, (size + 3.5) / 2);
  ctx.fillStyle = hexA(color, 0.16);
  ctx.fill();
  ctx.strokeStyle = hexA(color, 0.6);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  text(label, cx + 0.3, y + 1.6, { size, align: 'center', bold: true, color: textColor });
  ctx.letterSpacing = '0px';
}

function drawChoice() {
  const o = game.overlay;
  const close = o.closing ? clamp(o.closing.t / 0.32, 0, 1) : 0;
  const intro = clamp(o.t / 0.3, 0, 1);
  ctx.fillStyle = `rgba(5,2,9,${0.84 * intro})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  glow(VIEW_W / 2, VIEW_H * 0.55, 260, o.color, 0.2 * intro);
  for (const q of o.parts) {
    const a = Math.min(1, (q.life / q.max) * 2, (q.max - q.life) * 3) * intro;
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    ctx.globalAlpha = 1;
    glow(q.x, q.y, q.size * 3.5, q.color, 0.3 * a);
  }
  ctx.globalAlpha = intro * (1 - close);
  text(o.title, VIEW_W / 2, 9, { size: 16, title: true, align: 'center', color: o.color });
  ornamentLine(VIEW_W / 2, 31, textWidth(o.title, 16, { title: true }) / 2 + 50, o.color);
  if (o.sub) text(o.sub, VIEW_W / 2, 36, { size: 6, align: 'center', color: '#b8aec8' });
  ctx.globalAlpha = 1;
  const L = choiceLayout(o.options.length);
  o.options.forEach((opt, i) => {
    const kk = clamp((o.t - 0.08 - i * 0.09) / 0.32, 0, 1);
    if (kk <= 0) return;
    const x = L.x0 + i * (L.cw + L.gap);
    const hv = o.hv[i] || 0;
    let y = L.y + (1 - easeOut(kk)) * 16 - hv * 4;
    let sc = 1 + hv * 0.025, alpha = Math.min(1, kk * 2), flash = 0;
    if (o.closing) {
      if (o.closing.i === i) { sc += easeOut(close) * 0.06; flash = 1 - close; }
      else { alpha *= 1 - close; y += close * 14; }
    }
    const cx = x + L.cw / 2, cy = y + L.h / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.02, easeOutBack(kk)) * sc, sc); // Karte dreht sich herein
    ctx.translate(-cx, -cy);
    drawCard(opt, x, y, L.cw, L.h, { i, hv });
    if (flash > 0) {
      roundRect(x, y, L.cw, L.h, 5);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * flash})`;
      ctx.fill();
    }
    ctx.restore();
  });
  ctx.globalAlpha = intro * (1 - close);
  text('Karte anklicken oder Taste 1–3', VIEW_W / 2, VIEW_H - 13, { size: 5.5, align: 'center', color: '#8a7aa0' });
  ctx.globalAlpha = 1;
}

function drawCard(opt, x, y, w, h, st) {
  const t = game.time, b = opt.boon, hv = st.hv;
  const els = b ? boonEls(b) : [];
  const color = b ? ELEMENTS[els[0]].color : WEAPONS[game.player.weapon].color;
  const color2 = els.length > 1 ? ELEMENTS[els[1]].color : color;
  const light = b ? ELEMENTS[els[0]].light : '#ffffff';
  const rar = b ? b.rar : 1;
  const R = RARITY[rar];
  const cx = x + w / 2;

  // Leuchten und Schatten
  glow(cx, y + h / 2, w * (0.7 + 0.3 * hv), color, 0.1 + 0.22 * hv + (rar >= 2 ? 0.06 : 0));
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(x + 2, y + 4, w, h, 5);
  ctx.fill();
  // Körper
  roundRect(x, y, w, h, 5);
  ctx.fillStyle = '#110a1b';
  ctx.fill();
  ctx.save();
  roundRect(x, y, w, h, 5);
  ctx.clip();
  ctx.fillStyle = gLin(0, y, 0, y + h * 0.62, [[0, hexA(color, 0.34)], [1, hexA(color, 0)]]);
  ctx.fillRect(x, y, w, h);
  if (els.length > 1) {
    ctx.fillStyle = gLin(x, 0, x + w, 0, [[0, hexA(color2, 0)], [1, hexA(color2, 0.3)]]);
    ctx.fillRect(x, y, w, h * 0.62);
  }
  ctx.strokeStyle = hexA(color, 0.06);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let d = -h; d < w; d += 7) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); }
  ctx.stroke();
  // aufsteigende Funken in der Karte
  for (let j = 0; j < 14; j++) {
    const hx = hash2(st.i * 31 + j, 7), hy = hash2(j, st.i * 17 + 3);
    const py = y + h - ((t * (6 + hx * 10) + hy * h) % h);
    const px = x + 6 + hx * (w - 12) + Math.sin(t * 2 + j) * 2;
    ctx.fillStyle = hexA(light, 0.4 * ((py - y) / h) * (0.6 + hv * 0.4));
    ctx.fillRect(px, py, 1, 1);
  }
  // Glanzstreifen bei seltenen Karten
  if (rar >= 1) {
    const per = rar >= 3 ? 1.6 : rar === 2 ? 2.4 : 3.8;
    const k = ((t + st.i * 0.37) % per) / per;
    ctx.save();
    ctx.translate(x - 30 + k * (w + 60), y + h / 2);
    ctx.rotate(0.45);
    ctx.fillStyle = gLin(-10, 0, 10, 0, [[0, 'rgba(255,255,255,0)'], [0.5, `rgba(255,255,255,${rar >= 2 ? 0.16 : 0.08})`], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(-10, -h, 20, h * 2);
    ctx.restore();
  }
  if (b) drawEmblem(els[els.length - 1], cx, y + h - 46, 34, { alpha: 0.07 });
  else drawTypeEmblem('forge', cx, y + h - 46, 30, { alpha: 0.07 });
  ctx.restore();

  // Rahmen
  roundRect(x, y, w, h, 5);
  ctx.strokeStyle = gLin(x, y, x + w, y + h, [[0, color], [1, color2]]);
  ctx.lineWidth = 1.1 + hv * 0.7;
  ctx.stroke();
  roundRect(x + 3, y + 3, w - 6, h - 6, 3);
  ctx.strokeStyle = hexA(R.color, 0.3 + 0.35 * hv);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.fillStyle = R.color;
  for (const [px, py] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]]) diamond(px, py, 2);
  if (rar >= 3) {
    for (let j = 0; j < 4; j++) {
      const [px, py] = perimeterPoint(x, y, w, h, (t * 0.22 + j / 4) % 1);
      drawSparkle(px, py, 2.4 + Math.sin(t * 8 + j) * 0.8, '#fff1a0', 0.95);
    }
  }
  // Nummer
  fillCircle(x + 11, y + 11, 5.5, '#0c0714');
  strokeCircle(x + 11, y + 11, 5.5, hexA(color, 0.8), 0.7);
  text(`${st.i + 1}`, x + 11, y + 7.7, { size: 6, align: 'center', bold: true, color: '#e8dcf4' });

  // Bild: Kreis mit Emblem
  const ay = y + 39, ar = 27;
  fillCircle(cx, ay, ar, gRad(cx, ay, 0, ar, [[0, hexA(color, 0.5)], [0.65, hexA(color, 0.12)], [1, hexA(color, 0.02)]]));
  strokeCircle(cx, ay, ar, hexA(R.color, 0.9), 1);
  ctx.save();
  ctx.translate(cx, ay);
  ctx.rotate(t * (0.25 + hv * 1.2) + st.i);
  ctx.strokeStyle = hexA(light, 0.7);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU, l = k % 6 === 0 ? 3.5 : 1.5;
    ctx.moveTo(Math.cos(a) * (ar - 1.5), Math.sin(a) * (ar - 1.5));
    ctx.lineTo(Math.cos(a) * (ar - 1.5 - l), Math.sin(a) * (ar - 1.5 - l));
  }
  ctx.stroke();
  ctx.restore();
  strokeCircle(cx, ay, ar - 7, hexA(light, 0.22), 0.6);
  glow(cx, ay, 28, color, 0.25 + 0.2 * hv);
  if (b) {
    if (els.length > 1) {
      drawEmblem(els[0], cx - 10, ay + 1.5, 11);
      drawEmblem(els[1], cx + 10, ay - 1.5, 11);
      drawSparkle(cx, ay - 13, 3.6, '#ffffff', 0.9);
    } else drawEmblem(els[0], cx, ay, 15 + hv);
  } else if (opt.mod) {
    const id = game.player.weapon, spr = SPR[id], [gx, gy] = WEAPON_GRIP[id];
    const len = (spr.w - gx) * 2;
    const ang = -Math.PI / 4 + Math.sin(t * 1.5) * 0.06;
    drawRotated(spr, cx - Math.cos(ang) * len * 0.45, ay - Math.sin(ang) * len * 0.45, ang, gx, gy, { scale: 2 });
    drawTypeEmblem('forge', cx + 13, ay + 12, 5);
  }
  if (opt.up) {
    const bx = cx + 21, by = ay - 20;
    fillCircle(bx, by, 6, '#0c0714');
    strokeCircle(bx, by, 6, '#ffd86a', 0.8);
    text('+1', bx, by - 3.4, { size: 5.5, align: 'center', bold: true, color: '#ffd86a' });
  }

  // Texte
  let yy = y + 71;
  pill(cx, yy, (b ? R.name : 'Schmiede').toUpperCase(), R.color, R.color);
  yy += 13;
  for (const l of wrapText(b ? boonName(b) : opt.mod.name, w - 14, 10.5, { title: true })) {
    text(l, cx, yy, { size: 10.5, title: true, align: 'center', color: '#fbf4ff' });
    yy += 12;
  }
  const chip = b ? (b.kind === 'slot' ? `${SLOT_NAMES[b.slot].toUpperCase()} · ${SLOT_KEYS[b.slot]}` : 'PASSIV') : WEAPONS[game.player.weapon].name.toUpperCase();
  pill(cx, yy, chip, color, light, 4.8);
  yy += 11;
  const tagCol = opt.tag.startsWith('NEU') ? '#8affb8' : opt.tag.startsWith('ERSETZT') ? '#ff9a6a' : '#ffd86a';
  text(opt.tag, cx, yy, { size: 5.2, align: 'center', bold: true, color: tagCol });
  yy += 8;
  ornamentLine(cx, yy, w / 2 - 14, color);
  yy += 5;
  yy = richText(b ? boonDesc(b) : opt.mod.desc, b ? String(boonVal(b)) : null, cx, yy, w - 16, 6.4, '#ece4f2', light);
  if (opt.up && opt.prevVal !== undefined && opt.prevVal !== boonVal(b)) {
    text(`Wert ${opt.prevVal} → ${boonVal(b)}`, cx, yy + 1, { size: 5.5, align: 'center', bold: true, color: '#ffd86a' });
    yy += 8;
  }
  if (b && b.kind === 'slot' && b.slot !== 'dash') {
    yy += 2;
    for (const l of wrapText(STATUS_TEXT[b.el], w - 18, 5.3, { italic: true })) {
      text(l, cx, yy, { size: 5.3, align: 'center', color: '#9a8ab0', italic: true });
      yy += 6.6;
    }
  }
  // Fußzeile: Element-Stufe mit Rauten
  if (b) {
    els.forEach((el, k) => {
      const fy = y + h - 11 - (els.length - 1 - k) * 9;
      const now = resonance(el), E = ELEMENTS[el];
      drawEmblem(el, x + 12, fy, 2.8);
      text(`${E.name}-Stufe`, x + 18, fy - 3, { size: 5, bold: true, color: E.color });
      const n = Math.min(10, Math.max(5, now + 1));
      for (let j = 0; j < n; j++) {
        const px = x + w - 10 - (n - 1 - j) * 5.5;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        diamond(px, fy, 2.4);
        if (j < now) { ctx.fillStyle = E.color; diamond(px, fy, 1.9); }
        else if (j === now) {
          const p = 0.5 + Math.sin(t * 6) * 0.5;
          ctx.fillStyle = hexA(E.light, 0.4 + 0.6 * p);
          diamond(px, fy, 1.9 + p * 0.5);
        }
      }
    });
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
