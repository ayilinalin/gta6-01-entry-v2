// NEON TIDE v2 — cars: arcade physics, theft, and the traffic that fills
// Port Meridian. Every car is a circle-ish body with a heading and a speed.
import { CAR_TYPES, MAP, BLOCK, ROAD_W } from './config.js';
import { mulberry32, range, pick, chance } from './random.js';
import { onRoad, roadCenterX, roadCenterY, hitsBuilding, resolveBuildings } from './city.js';

let nextId = 1;

export function makeCar(kind, type, x, y, angle) {
  const t = CAR_TYPES[type];
  return {
    id: nextId += 1, kind, type, name: t.name, color: t.color, roof: t.roof,
    x, y, angle, speed: 0, accel: t.accel, top: t.top, grip: t.grip,
    hp: t.hp, maxHp: t.hp, driver: kind !== 'parked', locked: kind === 'parked',
    length: type === 'truck' ? 46 : 34, width: 18,
    targetSpeed: 0, turnAt: 0, brake: false, smoke: 0, honk: 0,
  };
}

export function spawnTraffic(city, count, seed) {
  const rng = mulberry32(seed);
  const cars = [];
  const types = ['sedan', 'taxi', 'van', 'sedan', 'taxi', 'truck'];
  for (let i = 0; i < count; i += 1) {
    const vertical = chance(rng, 0.5);
    const x = vertical ? roadCenterX(range(rng, 0, MAP)) : range(rng, 0, MAP);
    const y = vertical ? range(rng, 0, MAP) : roadCenterY(range(rng, 0, MAP));
    const angle = vertical ? (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2) : (chance(rng, 0.5) ? 0 : Math.PI);
    const car = makeCar('traffic', pick(rng, types), x, y, angle);
    car.speed = range(rng, 120, 210);
    car.targetSpeed = car.speed;
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, count, seed) {
  const rng = mulberry32(seed);
  const cars = [];
  const types = ['sedan', 'sports', 'van', 'taxi', 'sedan', 'truck'];
  for (let i = 0; i < count; i += 1) {
    // Parked along a road edge, facing along the road.
    const vertical = chance(rng, 0.5);
    const x = vertical ? roadCenterX(range(rng, 0, MAP)) + (chance(rng, 0.5) ? 34 : -34) : range(rng, 0, MAP);
    const y = vertical ? range(rng, 0, MAP) : roadCenterY(range(rng, 0, MAP)) + (chance(rng, 0.5) ? 34 : -34);
    const angle = vertical ? (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2) : (chance(rng, 0.5) ? 0 : Math.PI);
    cars.push(makeCar('parked', pick(rng, types), x, y, angle));
  }
  return cars;
}

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function aheadBlocked(cars, self, look) {
  const fx = Math.cos(self.angle), fy = Math.sin(self.angle);
  for (const c of cars) {
    if (c === self) continue;
    const dx = c.x - self.x, dy = c.y - self.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < look && side < 30) return true;
  }
  return false;
}

// Traffic AI: follow the road centreline, turn at intersections, brake for
// the car ahead. Runs once per step for every traffic car.
export function stepTraffic(G, dt) {
  const { cars } = G;
  for (const car of cars) {
    if (car.kind !== 'traffic') continue;
    const axis = (car.x % BLOCK) < ROAD_W ? 'v' : 'h';
    let want = car.angle;
    if (axis === 'v') {
      const cx = roadCenterX(car.x);
      const dir = Math.sin(car.angle) > 0 ? 1 : -1;
      want = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      // Drift back onto the centreline.
      car.x += (cx - car.x) * Math.min(1, dt * 1.2);
      // At an intersection, sometimes turn.
      const iy = car.y % BLOCK;
      if (iy < ROAD_W && Math.abs(car.y - (Math.floor(car.y / BLOCK) * BLOCK + ROAD_W / 2)) < 6 && car.turnAt <= 0) {
        car.turnAt = 4;
        const r = G.rng();
        if (r < 0.3) want = dir > 0 ? 0 : Math.PI; // turn onto the cross road
      }
    } else {
      const cy = roadCenterY(car.y);
      const dir = Math.cos(car.angle) > 0 ? 1 : -1;
      want = dir > 0 ? 0 : Math.PI;
      car.y += (cy - car.y) * Math.min(1, dt * 1.2);
      const ix = car.x % BLOCK;
      if (ix < ROAD_W && Math.abs(car.x - (Math.floor(car.x / BLOCK) * BLOCK + ROAD_W / 2)) < 6 && car.turnAt <= 0) {
        car.turnAt = 4;
        const r = G.rng();
        if (r < 0.3) want = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    car.turnAt -= dt;
    const diff = angleDiff(car.angle, want);
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const blocked = aheadBlocked(cars, car, 90);
    const target = blocked ? 0 : car.targetSpeed;
    if (car.speed < target) car.speed += car.accel * 0.5 * dt;
    else if (car.speed > target) car.speed -= car.accel * dt;
    car.speed = Math.max(0, Math.min(car.top, car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Keep traffic inside the map: bounce off the edge.
    if (car.x < 40 || car.x > MAP - 40 || car.y < 40 || car.y > MAP - 40) {
      car.angle += Math.PI;
      car.x = Math.max(40, Math.min(MAP - 40, car.x));
      car.y = Math.max(40, Math.min(MAP - 40, car.y));
    }
    if (hitsBuilding(G.city, car.x, car.y, 20)) {
      car.angle += Math.PI / 2;
      car.speed *= 0.5;
    }
  }
}

// Arcade driving for the car the player sits in. input: {up, down, left, right, brake}
export function stepPlayerCar(G, car, input, dt) {
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  if (input.up) car.speed += car.accel * dt;
  if (input.down) car.speed -= car.accel * 1.4 * dt;
  if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * 60 * dt;
  if (input.brake) car.speed -= Math.sign(car.speed) * 500 * dt;
  car.speed = Math.max(-140, Math.min(car.top, car.speed));
  if (Math.abs(car.speed) < 8 && !input.up && !input.down) car.speed = 0;
  const turn = steer * car.grip * dt * Math.min(1, Math.abs(car.speed) / 120) * dir;
  car.angle += turn * (input.brake ? 1.5 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(30, Math.min(MAP - 30, car.x));
  car.y = Math.max(30, Math.min(MAP - 30, car.y));
  // Walls scrape the car and push it back out; never let it embed.
  // Scrape damage ticks at most twice a second, so a long grind along
  // one wall cannot eat the car alive.
  if (resolveBuildings(G.city, car, 18)) {
    car.speed *= 0.5;
    if (G.time - (car.scrapeAt || -99) > 0.5) {
      car.scrapeAt = G.time;
      car.hp -= 1;
      G.sparks.push({ x: car.x, y: car.y, life: 0.3, max: 0.3 });
      if (car.hp <= 0 && !car.wrecked) { car.wrecked = true; G.events.push({ type: 'carWrecked', car }); }
    }
  }
}

// Circle-vs-circle separation between all cars. A hard hit costs health,
// but only once per car per 0.8 s: two cars grinding together in traffic
// is one crash, not sixty a second.
export function collideCars(G) {
  const { cars } = G;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 30;
      if (d > 0.01 && d < min) {
        // The player's car shoves others aside; it is not shoved itself.
        const gap = min - d;
        const aShare = a.kind === 'player' ? 0.2 : b.kind === 'player' ? 0.8 : 0.5;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * gap * aShare; a.y -= ny * gap * aShare;
        b.x += nx * gap * (1 - aShare); b.y += ny * gap * (1 - aShare);
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 120 && G.time - Math.max(a.lastHit || -99, b.lastHit || -99) > 0.8) {
          a.lastHit = G.time; b.lastHit = G.time;
          a.hp -= impact * 0.02; b.hp -= impact * 0.02;
          G.sparks.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, life: 0.3, max: 0.3 });
          if (a.kind === 'player' || b.kind === 'player') G.events.push({ type: 'crash' });
          for (const c of [a, b]) {
            if (c.hp <= 0 && !c.wrecked) { c.wrecked = true; G.events.push({ type: 'carWrecked', car: c }); }
          }
        }
      }
    }
  }
}

export function nearestCar(G, x, y, maxDist, kinds) {
  let best = null, bestD = maxDist;
  for (const c of G.cars) {
    if (kinds && !kinds.includes(c.kind)) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

export { onRoad };
