'use strict';
// ===== Pixel-Grafiken =====
// Jedes Zeichen ist ein Pixel ('.' = durchsichtig), die Farben stehen in PAL.
// Figuren schauen nach rechts und werden für links gespiegelt.
const PAL = {
  k: '#140f1c',                // Umriss
  P: '#5a2f7e', p: '#9a5ec4',  // Haar
  s: '#f6dcc6', S: '#d0a490',  // Haut
  e: '#3fe0c8',                // Augen der Heldin
  m: '#e8ecf4', M: '#9aa2b6',  // Silber
  v: '#9a62d8', V: '#5e3a96',  // Kleid
  b: '#2a1d2e',                // Stiefel
  y: '#ffd24a', Y: '#b8862a',  // Gold
  n: '#8a5a32', N: '#55361e',  // Holz / Fell
  o: '#e6dcc4', O: '#a89c80',  // Knochen
  r: '#e0453a', R: '#8a1f2a',  // Rot
  x: '#ff6a3a',                // Glühen
  g: '#79b84e', G: '#3d6b2e',  // Grün
  u: '#c06090', U: '#7a3058',  // Pilz
  w: '#ffffff',
  c: '#8fe8ff', C: '#3a8fc0',  // Kristall
  a: '#9a98a6', A: '#5a5866',  // Stein / Rüstung
  h: '#d9b070', H: '#9a7440',  // Stroh
};

function spriteCanvas(rows, pal, mirror, color) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const col = color || pal[ch] || PAL[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(mirror ? w - 1 - i : i, y, 1, 1);
    }
  });
  return c;
}
function makeSprite(rows, pal = {}) {
  return {
    w: Math.max(...rows.map((r) => r.length)),
    h: rows.length,
    rows, pal,
    img: spriteCanvas(rows, pal, false),
    flip: spriteCanvas(rows, pal, true),
    white: spriteCanvas(rows, pal, false, '#ffffff'),
    whiteFlip: spriteCanvas(rows, pal, true, '#ffffff'),
  };
}
// einfarbige Kopie (für Nachbilder beim Sprint, Frost-Tönung usw.)
const tintCache = new Map();
function tinted(spr, color) {
  const key = spr.img;
  if (!tintCache.has(key)) tintCache.set(key, {});
  const m = tintCache.get(key);
  if (!m[color]) m[color] = { img: spriteCanvas(spr.rows, spr.pal, false, color), flip: spriteCanvas(spr.rows, spr.pal, true, color) };
  return m[color];
}
// linke Hälfte spiegeln (für symmetrische Figuren)
const sym = (half) => half.map((r) => r + [...r].reverse().join(''));
// auf echte Bildschirmpixel runden: gleichmäßige Pixel, trotzdem weiche Bewegung
const snap = (v) => Math.round(v * S) / S;

// x, y = Fußpunkt in der Mitte
function drawSprite(spr, x, y, o = {}) {
  const sc = o.scale || 1;
  let img = o.flip ? spr.flip : spr.img;
  if (o.white) img = o.flip ? spr.whiteFlip : spr.white;
  if (o.tint) { const t = tinted(spr, o.tint); img = o.flip ? t.flip : t.img; }
  const w = spr.w * sc;
  const h = spr.h * sc * (o.sy || 1);
  const ww = w * (o.sx || 1);
  const base = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = base * o.alpha;
  ctx.drawImage(img, snap(x - ww / 2), snap(y - h), ww, h);
  ctx.globalAlpha = base;
}
// gedreht zeichnen, (ox, oy) = Drehpunkt im Sprite
function drawRotated(spr, x, y, ang, ox, oy, o = {}) {
  ctx.save();
  ctx.translate(snap(x), snap(y));
  ctx.rotate(ang);
  if (o.flipY) ctx.scale(1, -1);
  if (o.scale) ctx.scale(o.scale, o.scale);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.drawImage(o.white ? spr.white : spr.img, -ox, -oy);
  ctx.restore();
}

// ---------- Heldin ----------
const HERO_TOP = [
  '.....kkkkk....',
  '....kpPPPPk...',
  '...kpPPPPPPk..',
  '...kPPmmmmPk..',
  '..kPPPssssSk..',
  '..kPPPsssesk..',
  '..kPPPSsssSk..',
  '..kPPkkSSkk...',
  '.kPPkvvmmvk...',
  '.kPPkvmMmvvk..',
  '.kPkvvvmvvsk..',
  '.kPkvsvvvvsk..',
  '..kkVvvvvvVk..',
  '...kVvvvvvVk..',
  '..kVVvvvvvVVk.',
  '..kVVVVVVVVVk.',
  '...kkkkkkkkk..',
];
const HERO_LEGS = [
  ['....kbk.kbk...', '....kbk.kbk...', '....kkk.kkk...'],
  ['...kbk...kbk..', '...kbk...kbk..', '...kkk...kkk..'],
  ['.....kbkbk....', '.....kbkbk....', '.....kkkkk....'],
];
const SPR = {};
SPR.hero = HERO_LEGS.map((legs) => makeSprite([...HERO_TOP, ...legs]));

// ---------- Waffen (zeigen nach rechts) ----------
SPR.sword = makeSprite([
  '..kk.............',
  'kkkykkkkkkkkkkkk.',
  'kNNymmmmmmmmmmmmk',
  'kkkyMMMMMMMMMMMk.',
  '..kkkkkkkkkkkkk..',
]);
SPR.lance = makeSprite([
  '.....................kk...',
  'kkkkkkkkkkkkkkkkkkkkkmmkk.',
  'kNnnnnnnnnnnnnnnnnyymmmmmk',
  'kkkkkkkkkkkkkkkkkkkkkMMkk.',
  '.....................kk...',
]);
SPR.bow = makeSprite([
  '.kkk....',
  '.w.knk..',
  '.w..knk.',
  '.w...knk',
  '.w...knk',
  '.w...kyk',
  '.w...kyk',
  '.w...knk',
  '.w...knk',
  '.w..knk.',
  '.w.knk..',
  '.kkk....',
]);
SPR.staff = makeSprite([
  '................kk..',
  '...............kcck.',
  'kkkkkkkkkkkkkkykcwck',
  'kNnnnnnnnnnnnnyykcwk',
  'kkkkkkkkkkkkkkykcck.',
  '...............kk...',
]);
SPR.arrow = makeSprite(['ww......k.', '.nnnnnnnmk', 'ww......k.']);
// Drehpunkte (Griff) der Waffen
const WEAPON_GRIP = { sword: [3, 2], lance: [9, 2], bow: [5, 6], staff: [7, 3] };

// ---------- Gegner ----------
SPR.imp = makeSprite([
  '..k.....k..',
  '.kok...kok.',
  '.kooookook.',
  'kooooooooOk',
  'koooxkooxOk',
  'kOooooooOOk',
  '.kOkokokOk.',
  '..kkOOOkk..',
  '.kOkoookOk.',
  'kOk.koOk.kk',
  '.k.kOkOk...',
  '...kk.kk...',
]);
SPR.spitter = makeSprite([
  '....kkkkk....',
  '..kkgggggkk..',
  '.kgggggggwkk.',
  '.kggggggggkk.',
  'kgggGGGGkkkk.',
  'kgggGGkRRRRk.',
  'kGgggGGkkkkk.',
  'kGGgggggggGk.',
  '.kGGGGGGGGk..',
  '..kkk..kkk...',
]);
SPR.shroom = makeSprite([
  '...kkkkkk...',
  '.kkuuwuuukk.',
  'kuuwuuuuwuuk',
  'kuuuuuwuuuUk',
  'kUUuuuuuUUUk',
  '.kkkkkkkkkk.',
  '...kooook...',
  '...koxoxk...',
  '...kooook...',
  '...kOooOk...',
  '....kkkk....',
]);
SPR.ram = makeSprite([
  '...k.k.k..kk....',
  '..kakakak.knnk..',
  '........kknNk...',
  '..kkkkkkknnnkk..',
  '.knnnnnnnnnnnk..',
  'knnnnnnnnnnnxnk.',
  'kNnnnnnnnnnnnnnk',
  'kNNnnnnnnnnnkkk.',
  'kNNNnnnnnnNk....',
  '.kNNNNNNNNNk....',
  '.kNk.kNk.kNk....',
  '.kNk.kNk.kNk....',
  '.kkk.kkk.kkk....',
]);
SPR.eye = makeSprite([
  '...kkkkkk...',
  '.kkuUUUUukk.',
  'kuUwwwwwwUuk',
  'kUwwwrrwwwUk',
  'kUwwrkkrwwUk',
  'kUwwrkkrwwUk',
  'kUwwwrrwwwUk',
  'kuUwwwwwwUuk',
  '.kkuUUUUukk.',
  '...kkkkkk...',
  '..k.k..k.k..',
  '.k..k..k..k.',
], { u: '#9a5ab8', U: '#5a2a78' });
SPR.knight = makeSprite([
  '....kkkkk.....',
  '...kaaaaak....',
  '...kakkxak....',
  '...kaaaaak.kk.',
  '..kkAAAAkkkmmk',
  '.kaaaAAkmmmmMk',
  '.kaaaaakmyymMk',
  '.kAaaaakmyymMk',
  '.kAAaaakmmmmMk',
  '..kAAAAkkmmMk.',
  '..kaaaak.kkk..',
  '..kAkkAk......',
  '..kAk.kAk.....',
  '..kkk.kkk.....',
]);
SPR.dummy = makeSprite([
  '...kkkk...',
  '..khhhhk..',
  '..khkkhk..',
  '..khhhhk..',
  'kkkkhhkkkk',
  'khhhhhhhhk',
  'kkkkhhkkkk',
  '...khhk...',
  '...kHHk...',
  '...kNNk...',
  '...kNNk...',
  '..kNNNNk..',
  '..kkkkkk..',
]);

// ---------- Boss (symmetrisch, wird doppelt so groß gezeichnet) ----------
SPR.boss = makeSprite(sym([
  '.kk............',
  'kook...........',
  'kOook..........',
  '.kOook.........',
  '..kOook........',
  '...kOookkkkkkkk',
  '....kOkRRRRRRRR',
  '....kRRRRRRRRRR',
  '...kRRrrrrRRRRR',
  '...kRrxxxxrRRRR',
  '...kRrxyyxrRRRR',
  '...kRRrrrrRRRRR',
  '..kRRRRRRRRRRRk',
  '..kRRRRRRRRRRkx',
  '.kRRRRRRRRRRRRR',
  '.kRRRRkkkkkkkkk',
  'kNRRRkwkwkwkwkx',
  'kNRRRRkkkkkkkkk',
  'kNNRRRRRRRRRRRR',
  'kNNNRRRRxRRRRRR',
  'kNNNNRRRRxRRRRR',
  '.kNNNNRRRRRRRRR',
  '.kNNNNNRRRRRRRR',
  '..kNkkNNNNNNNNN',
  '..kNk.kNNNkkkkk',
  '.kNNk.kNNNk....',
  '.kkkk.kkkkk....',
]), { R: '#5a2626', r: '#8a3a2a', N: '#331b1b', x: '#ff7a2a', y: '#ffe08a', o: '#e8dcc0', O: '#a8987a' });

// ---------- Chronistin (NPC in der Zuflucht, zeigt die Statistik) ----------
SPR.chronist = makeSprite([
  '.....kkkk.....',
  '....kttttk....',
  '...kttttttk...',
  '...ktTsssTk...',
  '..kttTssesk...',
  '..kttTsssSk...',
  '..kttTwwwTk...',
  '..kttkwwwkk...',
  '.kttttkykttk..',
  '.ktTttyyytTtk.',
  'ktTkkkkkkkkkTk',
  'ktTknwwwwwwnks',
  'ktsknwcwwcwnkk',
  '.kTknwwcwwwnk.',
  '.kTkkkkkkkkkk.',
  '.kTTtttttttTk.',
  '.kTTttyyytTTk.',
  '.kTTTtttttTTk.',
  '..kTTTTTTTTk..',
  '..kkkkkkkkkk..',
], { t: '#3a7480', T: '#24505a', n: '#7a3a2a', w: '#f5ecd0', c: '#4fb8d8', s: '#f0d2bc', S: '#c99c8a', e: '#2a1a2a' });
