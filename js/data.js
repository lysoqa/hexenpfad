'use strict';
// ===== Alle Balance-Werte an einer Stelle =====

// ---------- Heldin ----------
const PLAYER_BASE = {
  hp: 100,
  speed: 112,          // Lauftempo (Pixel pro Sekunde)
  accel: 22,           // wie schnell sie Tempo aufnimmt und abbremst (höher = direkter)
  dashSpeed: 370,
  dashTime: 0.15,      // Dauer eines Sprints (ca. 55 Pixel)
  dashInvuln: 0.2,     // unverwundbar während des Sprints
  dashCharges: 2,      // Sprints hintereinander
  dashRecharge: 0.7,   // Sekunden pro Ladung
  dashStrikeWindow: 0.2, // so lange nach einem Sprint gibt es den Sprint-Angriff
  castCd: 4.5,         // Abklingzeit Siegel (Q)
  castRange: 130,
  hurtInvuln: 0.8,
};

// ---------- Waffen ----------
// arc = Winkel des Hiebs (Bogenmaß), range/len = Reichweite, step = Schwung nach vorn
const WEAPONS = {
  sword: {
    name: 'Mondklinge', kind: 'Schwert', color: '#cfe3ff',
    desc: 'Flinke Hiebe in einer Dreier-Kombo. Ausgewogen und verzeihend.',
    attackText: 'Drei Hiebe, der letzte ist schwer.',
    specialText: 'Wirbelklinge: Rundumschlag.',
    combo: [
      { dmg: 20, range: 32, arc: 2.2, dur: 0.25, step: 80 },
      { dmg: 20, range: 32, arc: 2.2, dur: 0.23, step: 80 },
      { dmg: 38, range: 38, arc: 3.0, dur: 0.36, step: 130, heavy: true },
    ],
    dashStrike: { dmg: 34, range: 36, arc: 1.9, dur: 0.26, step: 220, heavy: true },
    special: { dmg: 30, range: 44, cd: 1.6, dur: 0.34 },
  },
  lance: {
    name: 'Sturmlanze', kind: 'Lanze', color: '#ffd9a0',
    desc: 'Große Reichweite. Halte die Spezialtaste, um einen Ansturm aufzuladen.',
    attackText: 'Zwei weite Stöße, dann ein Wirbel.',
    specialText: 'Lanzensturm: halten zum Aufladen, loslassen zum Durchstoßen.',
    combo: [
      { dmg: 22, len: 56, width: 12, dur: 0.27, step: 60 },
      { dmg: 22, len: 56, width: 12, dur: 0.27, step: 60 },
      { dmg: 32, range: 48, spin: true, dur: 0.42, step: 0, heavy: true },
    ],
    dashStrike: { dmg: 42, len: 70, width: 14, dur: 0.28, step: 220, heavy: true },
    special: { dmgMin: 28, dmgMax: 72, chargeMax: 0.7, distMin: 50, distMax: 150, cd: 1.4, speed: 430 },
  },
  bow: {
    name: 'Sternbogen', kind: 'Bogen', color: '#bff0c0',
    desc: 'Fernkampf. Nach jedem Schuss muss die Sehne neu gespannt werden.',
    attackText: 'Gezielter Schuss mit Abklingzeit.',
    specialText: 'Salve: ein Fächer aus fünf Pfeilen.',
    shot: { dmg: 26, speed: 340, cd: 0.55, life: 0.9 },
    dashStrike: { extra: 2, spread: 0.12 }, // Schuss direkt nach dem Sprint: 2 Pfeile mehr
    special: { arrows: 5, spread: 0.55, dmg: 15, cd: 2.4 },
  },
  staff: {
    name: 'Aschestab', kind: 'Stab', color: '#e0c0ff',
    desc: 'Magie. Kugeln explodieren beim Aufprall und treffen ganze Gruppen.',
    attackText: 'Arkane Kugel, explodiert beim Treffer.',
    specialText: 'Arkanflut: halten zum Aufladen, am Mauszeiger explodiert ein großer Kreis.',
    bolt: { dmg: 13, speed: 210, cd: 0.32, radius: 16, life: 1.2 },
    dashStrike: { dmg: 18, radius: 34 },
    special: { dmg: 52, radius: 42, chargeMax: 0.6, range: 150, cd: 3.0 },
  },
};
const WEAPON_ORDER = ['sword', 'lance', 'bow', 'staff'];

// Verbesserungen aus der Waffenschmiede
const WEAPON_MODS = {
  sword: [
    { id: 'sw_heavy', name: 'Schwere Klinge', desc: 'Hiebe machen +30% Schaden.' },
    { id: 'sw_wide', name: 'Weiter Bogen', desc: 'Hiebe reichen 35% weiter.' },
    { id: 'sw_double', name: 'Doppelwirbel', desc: 'Die Wirbelklinge trifft zweimal.' },
    { id: 'sw_wave', name: 'Klingenwelle', desc: 'Der dritte Hieb schleudert eine Klingenwelle nach vorn.' },
  ],
  lance: [
    { id: 'la_reach', name: 'Lange Spitze', desc: 'Stöße reichen 40% weiter.' },
    { id: 'la_pierce', name: 'Durchbohren', desc: 'Stöße machen +35% Schaden.' },
    { id: 'la_rush', name: 'Sturmlauf', desc: 'Lanzensturm lädt doppelt so schnell und macht +30% Schaden.' },
    { id: 'la_spin', name: 'Funkenwirbel', desc: 'Der Wirbel schleudert 8 Funken in alle Richtungen.' },
  ],
  bow: [
    { id: 'bo_quick', name: 'Schnellsehne', desc: 'Abklingzeit zwischen Schüssen -35%.' },
    { id: 'bo_pierce', name: 'Durchschuss', desc: 'Pfeile durchbohren Gegner.' },
    { id: 'bo_volley', name: 'Großsalve', desc: 'Die Salve schießt 4 Pfeile mehr.' },
    { id: 'bo_power', name: 'Sternpfeil', desc: 'Jeder 4. Pfeil ist ein Sternpfeil mit dreifachem Schaden.' },
  ],
  staff: [
    { id: 'st_blast', name: 'Splitterkugeln', desc: 'Explosionen der Kugeln sind 50% größer.' },
    { id: 'st_twin', name: 'Zwillingsbolzen', desc: 'Du feuerst zwei Kugeln gleichzeitig.' },
    { id: 'st_nova', name: 'Weite Flut', desc: 'Arkanflut hat +40% Radius und +25% Schaden.' },
    { id: 'st_seek', name: 'Suchende Magie', desc: 'Kugeln fliegen von selbst zum nächsten Gegner.' },
  ],
};

// ---------- Elemente ----------
const ELEMENTS = {
  fire: { name: 'Feuer', color: '#ff8a3a', dark: '#9a3416', light: '#ffd08a' },
  frost: { name: 'Frost', color: '#7fd6ff', dark: '#2a6a9e', light: '#e2f8ff' },
  storm: { name: 'Blitz', color: '#ffe95a', dark: '#a88010', light: '#fffbd0' },
  shadow: { name: 'Schatten', color: '#b583ff', dark: '#4b2a8a', light: '#ead9ff' },
};
const ELEMENT_ORDER = ['fire', 'frost', 'storm', 'shadow'];
const STATUS_TEXT = {
  fire: 'Brand: Schaden über Zeit, stapelt sich.',
  frost: 'Frost: verlangsamt. Bei 5 Frost friert der Gegner ein.',
  storm: 'Blitzkette: springt auf Gegner in der Nähe.',
  shadow: 'Mal: markierte Gegner nehmen mehr Schaden.',
};

// Element-Stufe = Summe der Stufen aller Segen eines Elements.
// Jede Stufe über 1 macht ALLE Effekte dieses Elements um resoStep stärker.
const STATUS = {
  resoStep: 0.15,
  burnDps: 3, burnDur: 3, burnMax: 3,       // Brand pro Stapel, Dauer, Grund-Maximum (+1 je Feuer-Stufe)
  chillSlow: 0.3, chillDur: 2.5, freezeAt: 5, freezeDur: 1.0, // Frost
  chainDmg: 9, chainRange: 80, chainJumps: 1, // Blitz
  markDur: 4, markBonus: 0.2,               // Schatten
};

const RARITY = [
  { name: 'Gewöhnlich', mult: 1.0, color: '#d8d2c4', w: 60 },
  { name: 'Selten', mult: 1.3, color: '#5fa8ff', w: 28 },
  { name: 'Episch', mult: 1.6, color: '#c77dff', w: 10 },
  { name: 'Legendär', mult: 2.0, color: '#ffc840', w: 2 },
];
const LEVEL_STEP = 0.5; // jede weitere Stufe eines Segens: +50% vom Grundwert

const SLOTS = ['attack', 'special', 'cast', 'dash'];
const SLOT_NAMES = { attack: 'Angriff', special: 'Spezial', cast: 'Siegel', dash: 'Sprint' };
const SLOT_KEYS = { attack: 'LMT', special: 'RMT', cast: 'Q', dash: 'LEER' };
const SLOT_BASE = { attack: 20, special: 30, cast: 50 };       // % Schaden
const DASH_BASE = { fire: 14, frost: 16, storm: 16, shadow: 60 }; // Wert des Sprint-Segens

const SLOT_BOONS = {
  fire: {
    attack: { name: 'Glutklinge', desc: 'Angriff +{v}% Schaden und setzt 1 Brand.' },
    special: { name: 'Flammensturz', desc: 'Spezial +{v}% Schaden und setzt 2 Brand.' },
    cast: { name: 'Feuersiegel', desc: 'Siegel +{v}% Schaden, jeder Puls setzt Brand.' },
    dash: { name: 'Aschenspur', desc: 'Dein Sprint hinterlässt Flammen ({v} Schaden pro Sekunde).' },
  },
  frost: {
    attack: { name: 'Frosthieb', desc: 'Angriff +{v}% Schaden und setzt 1 Frost.' },
    special: { name: 'Eisdorn', desc: 'Spezial +{v}% Schaden und setzt 2 Frost.' },
    cast: { name: 'Frostsiegel', desc: 'Siegel +{v}% Schaden, beim Aufprall 3 Frost auf alle darin.' },
    dash: { name: 'Eisschritt', desc: 'Beim Sprint entsteht eine Frostwelle ({v} Schaden, 2 Frost).' },
  },
  storm: {
    attack: { name: 'Donnerhieb', desc: 'Angriff +{v}% Schaden, Treffer lösen eine Blitzkette aus.' },
    special: { name: 'Himmelszorn', desc: 'Spezial +{v}% Schaden, Treffer lösen starke Blitzketten aus.' },
    cast: { name: 'Sturmsiegel', desc: 'Siegel +{v}% Schaden, jeder Puls entlädt Blitze.' },
    dash: { name: 'Funkenflug', desc: 'Nach dem Sprint schlagen Blitze in bis zu 3 Gegner ({v} Schaden).' },
  },
  shadow: {
    attack: { name: 'Nachtklinge', desc: 'Angriff +{v}% Schaden und setzt ein Mal.' },
    special: { name: 'Seelenriss', desc: 'Spezial +{v}% Schaden und setzt ein Mal.' },
    cast: { name: 'Nachtsiegel', desc: 'Siegel +{v}% Schaden, zieht Gegner in die Mitte und setzt Male.' },
    dash: { name: 'Schattenschritt', desc: 'Nach dem Sprint macht dein nächster Treffer +{v}% Schaden und setzt ein Mal.' },
  },
};

// Passive Segen (int = ganze Zahl pro Stufe, Seltenheit egal)
const PASSIVES = {
  fire_core: { el: 'fire', name: 'Glutkern', desc: 'Brand verursacht +{v}% Schaden.', base: 40 },
  fire_burst: { el: 'fire', name: 'Aschenregen', desc: 'Brennende Gegner explodieren beim Tod ({v} Schaden).', base: 22 },
  fire_heat: { el: 'fire', name: 'Hitzewelle', desc: '+{v}% Schaden gegen brennende Gegner.', base: 15 },
  frost_skin: { el: 'frost', name: 'Eishaut', desc: 'Du nimmst {v}% weniger Schaden.', base: 8 },
  frost_shatter: { el: 'frost', name: 'Splitterbruch', desc: 'Eingefrorene Gegner nehmen +{v}% Schaden.', base: 40 },
  frost_armor: { el: 'frost', name: 'Frostpanzer', desc: 'Wirst du getroffen, bekommen Gegner um dich {v} Frost.', base: 3, int: true },
  storm_chain: { el: 'storm', name: 'Kettenreaktion', desc: 'Blitzketten springen {v} Mal öfter.', base: 1, int: true },
  storm_cloud: { el: 'storm', name: 'Gewitterwolke', desc: 'Alle 2 Sekunden trifft ein Blitz einen Gegner ({v} Schaden).', base: 14 },
  storm_swift: { el: 'storm', name: 'Funkenschritt', desc: '+{v} Sprint-Ladung und Sprints laden 20% schneller.', base: 1, int: true },
  shadow_blood: { el: 'shadow', name: 'Blutzoll', desc: 'Stirbt ein markierter Gegner, heilst du dich um {v}.', base: 2, int: true },
  shadow_deep: { el: 'shadow', name: 'Tiefe Wunden', desc: 'Male erhöhen den Schaden um weitere {v}%.', base: 12 },
  shadow_crit: { el: 'shadow', name: 'Todeshauch', desc: '{v}% Chance auf kritische Treffer (dreifacher Schaden) gegen markierte Gegner.', base: 12 },
};

// Duo-Segen: erscheinen nur, wenn man schon Segen beider Elemente hat
const DUOS = {
  duo_steam: { els: ['fire', 'frost'], name: 'Dampfstoß', desc: 'Treffer auf eingefrorene Gegner lösen eine Dampfexplosion aus ({v} Schaden).', base: 30 },
  duo_plasma: { els: ['fire', 'storm'], name: 'Plasmabogen', desc: 'Jeder Blitz setzt {v} Brand.', base: 1, int: true },
  duo_hell: { els: ['fire', 'shadow'], name: 'Höllenmal', desc: 'Markierte Gegner nehmen +{v}% Brandschaden.', base: 100 },
  duo_super: { els: ['frost', 'storm'], name: 'Supraleiter', desc: 'Blitze von verlangsamten Gegnern springen {v} Mal öfter und machen +50% Schaden.', base: 2, int: true },
  duo_grave: { els: ['frost', 'shadow'], name: 'Grabeskälte', desc: 'Markierte Gegner bekommen doppelten Frost. Einfrieren setzt ein Mal.', base: 0, int: true },
  duo_soul: { els: ['storm', 'shadow'], name: 'Seelensturm', desc: 'Stirbt ein markierter Gegner, schlagen {v} Blitze in Gegner in der Nähe.', base: 3, int: true },
};

// ---------- Belohnungen hinter den Türen ----------
const REWARDS = {
  boon: { name: 'Element-Segen', w: 46 },
  gold: { name: 'Goldschatz', w: 12 },
  heart: { name: 'Lebensfrucht', w: 11 },
  forge: { name: 'Waffenschmiede', w: 10 },
  star: { name: 'Sternsplitter', w: 9 },
  spring: { name: 'Heilquelle', w: 6, room: true },
  shop: { name: 'Händlerschrein', w: 6, room: true },
};
const REWARD_VALUES = {
  gold: [45, 80],     // Gold (steigt etwas mit der Kammer)
  heart: 25,          // + max. Leben und Heilung
  spring: 0.4,        // Heilquelle heilt 40%
  goldDrop: 0.15,     // Chance, dass ein Gegner Gold fallen lässt
  eliteGold: [4, 7],
};
const SHOP_ITEMS = [
  { id: 'boon', name: 'Element-Segen', cost: 85, desc: 'Wähle einen Segen eines zufälligen Elements.' },
  { id: 'heal', name: 'Heiltrank', cost: 35, desc: 'Heilt 50% deines Lebens.' },
  { id: 'heart', name: 'Lebensfrucht', cost: 70, desc: '+25 maximales Leben.' },
  { id: 'star', name: 'Sternsplitter', cost: 95, desc: 'Verstärkt einen deiner Segen um 1 Stufe.' },
  { id: 'forge', name: 'Schmiedehammer', cost: 110, desc: 'Eine Verbesserung für deine Waffe.' },
];

// ---------- Ablauf eines Laufs ----------
const RUN = {
  rooms: 12,      // Kammer 12 = Boss
  shopAt: 6,      // in Kammer 6 gibt es immer einen Händler zur Auswahl
  guardianAt: 11, // Kammer 11: Wächterkammer (schwer, gute Belohnung)
  eliteFrom: 4, eliteChance: 0.22,
};

// ---------- Gegner ----------
const ENEMIES = {
  imp: { name: 'Knochenwicht', hp: 36, speed: 64, r: 5, dmg: 10, cost: 1, from: 1 },
  spitter: { name: 'Moorspucker', hp: 30, speed: 44, r: 5, dmg: 8, cost: 1.5, from: 1 },
  shroom: { name: 'Sporenbeule', hp: 22, speed: 52, r: 5, dmg: 16, cost: 1, from: 2 },
  ram: { name: 'Dornbock', hp: 70, speed: 42, r: 7, dmg: 14, cost: 2.5, from: 3 },
  eye: { name: 'Hexenauge', hp: 46, speed: 30, r: 6, dmg: 7, cost: 2.5, from: 4, fly: true },
  knight: { name: 'Schildwächter', hp: 55, armor: 60, speed: 34, r: 7, dmg: 15, cost: 4, from: 6 },
};
const ENEMY_SCALE = { hpPerRoom: 0.08, eliteHp: 1.8, eliteArmor: 30, eliteDmg: 1.25 };
const WAVES = { base: 4, perRoom: 1.25, waves: 2, extraWaveFrom: 5 };

const BOSS = {
  name: 'Grimmhorn', title: 'Wächter des Tores',
  hp: 1650, r: 15, speed: 46, phase2: 0.5,
  claw: 18, slam: 20, charge: 18, bullet: 9, meteor: 14,
};
