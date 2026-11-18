// NEON TIDE v2 — weapons, bullets, pickups. Fists up close, guns at range.
// Every shot is a crime the police can hear.
import { WEAPONS } from './config.js';
import { addHeat } from './player.js';

export function fireWeapon(G) {
  const p = G.player;
  if (!p.onFoot) return;
  const w = WEAPONS[p.weapon];
  if (p.fireCooldown > 0) return;
  if (p.weapon === 'fists') {
    p.punchCooldown = w.rate;
    p.fireCooldown = w.rate;
    // A swing in front of the player.
    const hx = p.x + Math.cos(p.angle) * 26, hy = p.y + Math.sin(p.angle) * 26;
    for (const ped of G.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - hx, ped.y - hy) < 30) {
        ped.hp -= w.damage;
        if (ped.hp <= 0) { ped.state = 'down'; addHeat(G, 45, 'killPed'); }
      }
    }
    for (const cop of G.cops) {
      if (Math.hypot(cop.x - hx, cop.y - hy) < 30) {
        cop.hp -= w.damage;
        if (cop.hp <= 0) { G.cops.splice(G.cops.indexOf(cop), 1); addHeat(G, 60, 'killCop'); }
      }
    }
    G.audio.punch();
    return;
  }
  if ((p.ammo[p.weapon] || 0) <= 0) {
    G.toast(`No ${w.name} ammo — buy more at Ironworks Arms.`, 'bad');
    p.fireCooldown = 0.3;
    G.audio.click();
    return;
  }
  p.ammo[p.weapon] -= 1;
  p.fireCooldown = w.rate;
  const spread = (G.rng() - 0.5) * w.spread * 2;
  const a = p.angle + spread;
  G.bullets.push({
    x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
    vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
    damage: w.damage, range: w.range, from: 'player',
  });
  G.muzzle = 0.06;
  G.lastShotAt = G.time; G.lastShotX = p.x; G.lastShotY = p.y;
  addHeat(G, 8, 'shoot');
  G.audio.shot(p.weapon);
}

export function stepBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.range -= Math.hypot(b.vx, b.vy) * dt;
    let dead = b.range <= 0;
    // Walls stop bullets.
    if (!dead && G.city && hitsWall(G, b.x, b.y)) dead = true;
    if (!dead && b.from === 'player') {
      for (const ped of G.peds) {
        if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
          ped.hp -= b.damage;
          if (ped.hp <= 0) { ped.state = 'down'; addHeat(G, 45, 'killPed'); }
          dead = true; break;
        }
      }
      if (!dead) for (const cop of G.cops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 12) {
          cop.hp -= b.damage;
          if (cop.hp <= 0) { G.cops.splice(G.cops.indexOf(cop), 1); addHeat(G, 60, 'killCop'); }
          dead = true; break;
        }
      }
      if (!dead) for (const car of G.cars) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 22) {
          car.hp -= b.damage;
          G.sparks.push({ x: b.x, y: b.y, life: 0.25, max: 0.25 });
        if (car.hp <= 0 && !car.wrecked) { car.wrecked = true; G.events.push({ type: 'carWrecked', car }); }
          dead = true; break;
        }
      }
    }
    if (!dead && b.from === 'cop') {
      const p = G.player;
      if (Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        // Player damage is applied by the caller via damagePlayer.
        G.pendingDamage = (G.pendingDamage || 0) + b.damage;
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

function hitsWall(G, x, y) {
  for (const b of G.city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

export function spawnPickup(G, kind, x, y) {
  G.pickups.push({ kind, x, y, life: 30 });
}

export function stepPickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const pk = G.pickups[i];
    pk.life -= dt;
    if (pk.life <= 0) { G.pickups.splice(i, 1); continue; }
    if (p.onFoot && Math.hypot(p.x - pk.x, p.y - pk.y) < 26) {
      if (pk.kind === 'cash') { p.cash += 150; G.toast('Picked up $150.', 'good'); }
      if (pk.kind === 'health') { p.hp = Math.min(100, p.hp + 40); G.toast('Health +40.', 'good'); }
      if (pk.kind === 'armor') { p.armor = Math.min(100, p.armor + 50); G.toast('Armor +50.', 'good'); }
      if (pk.kind === 'pistol_ammo') { p.ammo.pistol += 24; G.toast('Pistol ammo +24.', 'good'); }
      if (pk.kind === 'smg_ammo') { p.ammo.smg += 60; G.toast('SMG ammo +60.', 'good'); }
      G.audio.pickup();
      G.pickups.splice(i, 1);
    }
  }
}

// Foot cops shoot back when the player is armed and wanted.
export function copFire(G, dt) {
  const p = G.player;
  if (p.wanted < 2) return;
  for (const cop of G.cops) {
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < 340 && d > 60) {
      cop.shootAt = (cop.shootAt || 0) - dt;
      if (cop.shootAt <= 0) {
        cop.shootAt = 1.1 + G.rng() * 0.8;
        const a = Math.atan2(p.y - cop.y, p.x - cop.x) + (G.rng() - 0.5) * 0.12;
        G.bullets.push({
          x: cop.x + Math.cos(a) * 20, y: cop.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 800, vy: Math.sin(a) * 800,
          damage: 9, range: 360, from: 'cop',
        });
        G.audio.shot('pistol');
      }
    }
  }
}
