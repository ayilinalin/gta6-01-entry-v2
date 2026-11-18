// NEON TIDE v2 — money and the shops that take it: guns, armor, a new
// paint job that sheds the heat, a hospital bed and a cheap meal.
import { PRICES, WEAPONS } from './config.js';
import { addHeat } from './player.js';

export function nearestShop(G, maxDist) {
  const p = G.player;
  let best = null, bestD = maxDist;
  for (const s of G.city.shops) {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

export function shopMenu(shop) {
  if (shop.kind === 'arms') return [
    { label: `P9 Pistol — $${PRICES.pistol}`, action: 'pistol' },
    { label: `K9 SMG — $${PRICES.smg}`, action: 'smg' },
    { label: `Body armor — $${PRICES.armor}`, action: 'armor' },
    { label: 'Pistol ammo x24 — $120', action: 'pistol_ammo' },
    { label: 'SMG ammo x60 — $200', action: 'smg_ammo' },
  ];
  if (shop.kind === 'spray') return [
    { label: `Respray + lose the heat — $${PRICES.spray}`, action: 'spray' },
    { label: `Repair car — $${PRICES.repair}`, action: 'repair' },
  ];
  if (shop.kind === 'hospital') return [
    { label: `Full treatment — $${PRICES.heal}`, action: 'heal' },
  ];
  if (shop.kind === 'diner') return [
    { label: `A hot meal — $${PRICES.snack}`, action: 'snack' },
  ];
  if (shop.kind === 'hideout') return [
    { label: 'Lay low (heat fades fast here)', action: 'hide' },
  ];
  return [];
}

export function buyItem(G, action) {
  const p = G.player;
  const pay = (amount) => {
    if (p.cash < amount) { G.toast('Not enough cash.', 'bad'); return false; }
    p.cash -= amount;
    return true;
  };
  switch (action) {
    case 'pistol':
      if (pay(PRICES.pistol)) { p.weapon = 'pistol'; p.ammo.pistol += 48; G.toast('Bought a P9 Pistol. Press 2 to draw it.', 'good'); }
      break;
    case 'smg':
      if (pay(PRICES.smg)) { p.weapon = 'smg'; p.ammo.smg += 120; G.toast('Bought a K9 SMG. Press 3 to draw it.', 'good'); }
      break;
    case 'armor':
      if (pay(PRICES.armor)) { p.armor = 100; G.toast('Body armor on — 100.', 'good'); }
      break;
    case 'pistol_ammo':
      if (pay(120)) { p.ammo.pistol += 24; G.toast('Pistol ammo +24.', 'good'); }
      break;
    case 'smg_ammo':
      if (pay(200)) { p.ammo.smg += 60; G.toast('SMG ammo +60.', 'good'); }
      break;
    case 'spray':
      if (pay(PRICES.spray)) {
        p.heat = 0; p.wanted = 0;
        if (p.car) { p.car.hp = p.car.maxHp; p.car.color = pickPaint(G); }
        G.toast('Fresh paint, clean record. The heat is off.', 'good');
      }
      break;
    case 'repair':
      if (p.car && pay(PRICES.repair)) { p.car.hp = p.car.maxHp; G.toast('Car repaired.', 'good'); }
      else if (!p.car) G.toast('No car to repair — bring one.', 'bad');
      break;
    case 'heal':
      if (pay(PRICES.heal)) { p.hp = 100; G.toast('Patched up — HP 100.', 'good'); }
      break;
    case 'snack':
      if (pay(PRICES.snack)) { p.hp = Math.min(100, p.hp + 25); G.toast('A hot meal. HP +25.', 'good'); }
      break;
    case 'hide':
      p.heat = Math.max(0, p.heat - 20);
      G.toast('Laying low at the hideout…', 'info');
      break;
    default:
      break;
  }
  G.audio.buy();
}

function pickPaint(G) {
  const colors = ['#c94f3d', '#5e7a8a', '#e8e4da', '#2ee6c8', '#ffb02e', '#7a5cff'];
  return colors[Math.floor(G.rng() * colors.length)];
}

export function earnCash(G, amount, why) {
  G.player.cash += amount;
  G.toast(`+$${amount} — ${why}.`, 'good');
}
