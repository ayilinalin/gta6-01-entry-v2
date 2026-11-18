// NEON TIDE v2 — the Port Meridian Police Department: wanted levels, pursuit
// cars, foot cops, roadblocks and the helicopter that comes out at 4 stars.
import { WANTED, MAP, BLOCK, ROAD_W } from './config.js';
import { makeCar, nearestCar } from './vehicles.js';
import { onRoad, roadCenterX, roadCenterY, randomRoadPoint, resolveBuildings } from './city.js';
import { damagePlayer, addHeat } from './player.js';

export function makeCopCar(G, x, y) {
  const car = makeCar('police', 'police', x, y, 0);
  car.targetSpeed = 430;
  return car;
}

export function makeFootCop(x, y) {
  return { x, y, angle: 0, speed: 150, hp: 50, state: 'chase', grab: 0 };
}

// Wanted heat: rises with crime, sheds when the player lays low and unseen.
export function stepWanted(G, dt) {
  const p = G.player;
  const sinceCrime = G.time - p.lastCrime;
  const copNear = G.cops.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 500)
    || G.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 500);
  if (sinceCrime > 6 && !copNear) {
    p.heat = Math.max(0, p.heat - WANTED.decayHiddenPerSec * dt);
  } else if (sinceCrime > 20) {
    p.heat = Math.max(0, p.heat - WANTED.decayPerSec * dt);
  }
  const w = Math.min(5, Math.floor(p.heat / 20));
  if (w !== p.wanted) {
    p.wanted = w;
    if (w === 0) G.toast('You lost them. The heat is off — for now.', 'good');
    else G.toast(`Wanted level ${w} — PMPD is on you.`, 'bad');
  }
}

// Keep the right number of pursuit cars on the road for the wanted level.
export function stepPolice(G, dt) {
  const p = G.player;
  const want = WANTED.copCars[p.wanted];
  const policeCars = G.cars.filter((c) => c.kind === 'police');
  if (policeCars.length < want) {
    // Spawn a cruiser on a road behind the player.
    const spot = randomRoadPoint(G.rng);
    const car = makeCopCar(G, spot.x, spot.y);
    car.angle = Math.atan2(p.y - spot.y, p.x - spot.x);
    G.cars.push(car);
    G.events.push({ type: 'copSpawn' });
  }
  // Foot cops at wanted 2+: they chase on foot and try to bust the player.
  // Never during a staged screenshot scene.
  const wantFoot = G.staging ? 0 : (p.wanted >= 2 ? p.wanted - 1 : 0);
  while (G.cops.length < wantFoot) {
    const spot = randomRoadPoint(G.rng);
    G.cops.push(makeFootCop(spot.x, spot.y));
  }
  while (G.cops.length > wantFoot) G.cops.pop();

  for (const car of policeCars) {
    // Pursuit driving: steer at a ring point around the player, one per
    // cruiser, so the pack surrounds instead of stacking into one pile.
    const ringA = (policeCars.indexOf(car) * 2.4) % (Math.PI * 2);
    const tx = p.x + Math.cos(ringA) * 100, ty = p.y + Math.sin(ringA) * 100;
    const dx = tx - car.x, dy = ty - car.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    car.speed = Math.min(car.top, car.speed + car.accel * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(30, Math.min(MAP - 30, car.x));
    car.y = Math.max(30, Math.min(MAP - 30, car.y));
    // Cruisers stay on the roads: a pursuit that cuts through a block
    // would read as cars parked on a rooftop.
    if (resolveBuildings(G.city, car, 18)) car.speed *= 0.6;
    // Ram the player's car, or shove the player on foot. A ram only
    // lands when the cruiser is actually moving into the player, and at
    // most once a second per cruiser — contact alone is not damage.
    if (dist < 40) {
      if (!p.onFoot && p.car) {
        if (car.speed > 120 && G.time - (car.ramAt || -99) > 1.0) {
          car.ramAt = G.time;
          p.car.hp -= 25;
          G.sparks.push({ x: (car.x + p.car.x) / 2, y: (car.y + p.car.y) / 2, life: 0.25, max: 0.25 });
          if (p.car.hp <= 0 && !p.car.wrecked) { p.car.wrecked = true; G.events.push({ type: 'carWrecked', car: p.car }); }
        }
        car.speed *= 0.96;
      } else {
        damagePlayer(G, 12 * dt);
      }
    }
    // Give up the chase when the player is long gone and cold.
    if (p.wanted === 0 && dist > 900) {
      car.kind = 'traffic';
      car.type = 'sedan';
      car.targetSpeed = 180;
    }
  }

  // Foot cops: run the player down, grab them when close and still.
  for (const cop of G.cops) {
    const dx = p.x - cop.x, dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (dist > 26) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      cop.grab = 0;
    } else if (p.onFoot) {
      cop.grab += dt;
      if (cop.grab > WANTED.bustSeconds) G.events.push({ type: 'busted' });
    } else {
      // Yank the player out of the car.
      cop.grab += dt;
      if (cop.grab > 1.2) G.events.push({ type: 'draggedOut', cop });
    }
  }

  // Roadblock at wanted 3+: a line of cruisers across the road ahead.
  if (p.wanted >= WANTED.roadblockAt && !G.roadblock && G.time - (G.roadblockAt || 0) > 25) {
    G.roadblock = makeRoadblock(G);
    G.roadblockAt = G.time;
    G.toast('Roadblock ahead — PMPD has the avenue sealed.', 'bad');
  }
  if (G.roadblock) {
    if (p.wanted < WANTED.roadblockAt || Math.hypot(p.x - G.roadblock.x, p.y - G.roadblock.y) > 1400) {
      G.roadblock = null;
    }
  }

  // Helicopter at wanted 4+: circles overhead, keeps the player lit at night.
  if (p.wanted >= WANTED.heliAt && !G.heli) {
    G.heli = { x: p.x, y: p.y - 260, angle: 0, rotor: 0 };
    G.toast('PMPD air unit overhead. Lose the chopper.', 'bad');
  }
  if (G.heli) {
    if (p.wanted < WANTED.heliAt) { G.heli = null; }
    else {
      const dx = p.x - G.heli.x, dy = p.y - G.heli.y;
      const d = Math.hypot(dx, dy);
      G.heli.angle = Math.atan2(dy, dx);
      const sp = Math.min(260, d * 0.8);
      G.heli.x += Math.cos(G.heli.angle) * sp * dt;
      G.heli.y += Math.sin(G.heli.angle) * sp * dt;
      G.heli.rotor += dt * 30;
    }
  }
}

function makeRoadblock(G) {
  const p = G.player;
  // Ahead of the player, across the nearest road.
  const ahead = 420;
  const bx = p.x + Math.cos(p.angle) * ahead;
  const by = p.y + Math.sin(p.angle) * ahead;
  const vertical = Math.abs(Math.cos(p.angle)) < 0.5;
  const cars = [];
  for (let i = -1; i <= 1; i += 1) {
    const car = makeCopCar(G, vertical ? bx : bx + i * 60, vertical ? by + i * 60 : by);
    car.angle = vertical ? 0 : Math.PI / 2;
    car.speed = 0;
    cars.push(car);
    G.cars.push(car);
  }
  return { x: bx, y: by, cars, vertical };
}

export function clearRoadblockCars(G) {
  if (!G.roadblock) return;
  for (const c of G.roadblock.cars) {
    const i = G.cars.indexOf(c);
    if (i >= 0) G.cars.splice(i, 1);
  }
  G.roadblock = null;
}
