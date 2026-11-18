// NEON TIDE v2 — pedestrians: sidewalk walkers who flee gunfire and
// speeding cars, and scream about it. They make the city feel inhabited.
import { MAP, BLOCK, ROAD_W } from './config.js';
import { mulberry32, range, pick, chance } from './random.js';
import { onRoad, roadCenterX, roadCenterY, resolveBuildings } from './city.js';

const SHIRTS = ['#e8e4da', '#c94f3d', '#5e7a8a', '#f2c230', '#7a5cff', '#2ee6c8', '#ff9a3d'];

export function makePed(x, y, rng) {
  return {
    x, y, angle: pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
    speed: range(rng, 40, 70), shirt: pick(rng, SHIRTS),
    state: 'walk', // walk | flee | down
    tx: x, ty: y, wait: range(rng, 0, 3), panic: 0, hp: 30,
  };
}

export function spawnPeds(city, count, seed) {
  const rng = mulberry32(seed);
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const vertical = chance(rng, 0.5);
    const x = vertical ? roadCenterX(range(rng, 0, MAP)) + (chance(rng, 0.5) ? 40 : -40) : range(rng, 0, MAP);
    const y = vertical ? range(rng, 0, MAP) : roadCenterY(range(rng, 0, MAP)) + (chance(rng, 0.5) ? 40 : -40);
    peds.push(makePed(x, y, rng));
  }
  return peds;
}

function pickWalkTarget(G, ped) {
  // Stroll to a nearby sidewalk point.
  const vertical = G.rng() < 0.5;
  if (vertical) {
    ped.tx = roadCenterX(ped.x) + (G.rng() < 0.5 ? 40 : -40);
    ped.ty = ped.y + (G.rng() < 0.5 ? -1 : 1) * range(G.rng, 120, 420);
  } else {
    ped.tx = ped.x + (G.rng() < 0.5 ? -1 : 1) * range(G.rng, 120, 420);
    ped.ty = roadCenterY(ped.y) + (G.rng() < 0.5 ? 40 : -40);
  }
  ped.tx = Math.max(30, Math.min(MAP - 30, ped.tx));
  ped.ty = Math.max(30, Math.min(MAP - 30, ped.ty));
}

export function stepPeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    // Panic sources: gunfire nearby, or the player barrelling at them in a car.
    const nearShot = G.lastShotAt && G.time - G.lastShotAt < 1.5 && Math.hypot(ped.x - G.lastShotX, ped.y - G.lastShotY) < 320;
    const nearCar = !p.onFoot && p.car && Math.hypot(ped.x - p.car.x, ped.y - p.car.y) < 70 && Math.abs(p.car.speed) > 200;
    if (nearShot || nearCar) { ped.state = 'flee'; ped.panic = 3; }
    if (ped.state === 'flee') {
      ped.panic -= dt;
      const fx = ped.x - (nearShot ? G.lastShotX : p.x);
      const fy = ped.y - (nearShot ? G.lastShotY : p.y);
      const d = Math.hypot(fx, fy) || 1;
      ped.x += (fx / d) * 150 * dt;
      ped.y += (fy / d) * 150 * dt;
      ped.angle = Math.atan2(fy, fx);
      if (ped.panic <= 0) ped.state = 'walk';
    } else {
      ped.wait -= dt;
      const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 8 || ped.wait <= 0) {
        if (ped.wait <= 0 && d < 8) ped.wait = range(G.rng, 1, 4);
        else if (d < 8) pickWalkTarget(G, ped);
      } else {
        ped.x += (dx / d) * ped.speed * dt;
        ped.y += (dy / d) * ped.speed * dt;
        ped.angle = Math.atan2(dy, dx);
      }
    }
    ped.x = Math.max(20, Math.min(MAP - 20, ped.x));
    ped.y = Math.max(20, Math.min(MAP - 20, ped.y));
    resolveBuildings(G.city, ped, 10);
  }
}

// A car ploughing through a pedestrian. Returns the ped hit, if any.
export function carHitsPed(G, car) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 26 && Math.abs(car.speed) > 60) {
      ped.state = 'down';
      ped.hp = 0;
      return ped;
    }
  }
  return null;
}
