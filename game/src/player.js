// NEON TIDE v2 — the player on foot: walking, running, aiming, entering cars.
// When the player sits in a car, vehicles.js drives it instead.
import { PLAYER, MAP } from './config.js';
import { resolveBuildings } from './city.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: 0, speed: 0, hp: PLAYER.hp, armor: 0,
    onFoot: true, car: null, weapon: 'fists', ammo: { pistol: 48, smg: 0 },
    cash: 150, respect: 0, wanted: 0, heat: 0,
    aimX: 0, aimY: 0, fireCooldown: 0, punchCooldown: 0,
    bustTimer: 0, hiddenTimer: 0, lastCrime: 0,
  };
}

export function stepPlayer(G, input, dt) {
  const p = G.player;
  if (!p.onFoot) return;
  let mx = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
  let my = (input.down('KeyS', 'ArrowDown') ? 1 : 0) - (input.down('KeyW', 'ArrowUp') ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  const run = input.down('ShiftLeft', 'ShiftRight');
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.x += mx * speed * dt;
  p.y += my * speed * dt;
  p.x = Math.max(20, Math.min(MAP - 20, p.x));
  p.y = Math.max(20, Math.min(MAP - 20, p.y));
  resolveBuildings(G.city, p, 14);
  // Aim at the mouse: the camera transform turns screen into world in main.js.
  p.aimX = G.mouseWorldX;
  p.aimY = G.mouseWorldY;
  const dx = p.aimX - p.x, dy = p.aimY - p.y;
  if (Math.hypot(dx, dy) > 4) p.angle = Math.atan2(dy, dx);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
}

// Step out of the car next to it, keeping the car parked where it stops.
export function exitCar(G) {
  const p = G.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  car.speed = 0;
  car.driver = false;
  car.kind = 'parked';
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
  p.onFoot = true;
  p.car = null;
  resolveBuildings(G.city, p, 14);
}

// Climb into the nearest car. Stealing a parked car is a crime.
export function enterCar(G, car) {
  const p = G.player;
  if (!car) return false;
  if (car.kind === 'parked') {
    car.locked = false;
    addHeat(G, 25, 'stealCar');
    G.events.push({ type: 'stoleCar', car });
    G.toast(`Stole a ${car.name} — the law noticed.`, 'bad');
  }
  if (car.kind === 'traffic') {
    // Yank the driver out: the car is yours, the driver runs off screaming.
    addHeat(G, 25, 'stealCar');
    G.events.push({ type: 'carjack', car });
    G.toast(`Carjacked a ${car.name}!`, 'bad');
  }
  car.kind = 'player';
  car.driver = true;
  p.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
  return true;
}

export function addHeat(G, amount, crime) {
  const p = G.player;
  p.heat = Math.min(100, p.heat + amount);
  p.wanted = Math.min(5, Math.floor(p.heat / 20));
  p.lastCrime = G.time;
  if (crime) G.events.push({ type: 'crime', crime, wanted: p.wanted });
}

export function damagePlayer(G, amount) {
  const p = G.player;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left);
    p.armor -= absorbed; left -= absorbed;
  }
  p.hp -= left;
  if (p.hp <= 0) {
    p.hp = 0;
    G.events.push({ type: 'playerDown' });
  }
}
