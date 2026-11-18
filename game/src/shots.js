// NEON TIDE v2 — the screenshot scenes behind ?shot= and ?seed=.
// Each scene plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { STEP, BLOCK, ROAD_W } from './config.js';
import { mulberry32 } from './random.js';
import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { enterCar } from './player.js';
import { startMission } from './missions.js';
import { stepWorld } from './world.js';
import { hitsBuilding, onRoad, roadCenterX, roadCenterY, nearestRoadPoint } from './city.js';

const STUB_INPUT = {
  down: () => false,
  consumePressed: () => false,
  mouseDown: false, mousePressedEdge: false, mouseX: 0, mouseY: 0,
};

// Steer the player's car toward (tx, ty) along the road grid: drive down
// the current road, turn at intersections, and only cut across a block
// when the target sits off-road. Returns the drive input.
function driveToward(G, tx, ty) {
  const car = G.player.car;
  if (!car) return { up: false, down: false, left: false, right: false, brake: false };
  // Aim at the nearest road point to the target, so the route stays on roads.
  const wx = onRoad(tx, ty) ? tx : roadCenterX(tx);
  const wy = onRoad(tx, ty) ? ty : roadCenterY(ty);
  const onV = (car.x % BLOCK) < ROAD_W;
  const onH = (car.y % BLOCK) < ROAD_W;
  const dx = wx - car.x, dy = wy - car.y;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let want;
  if (Math.abs(dx) > 60 && onH) {
    want = dx > 0 ? 0 : Math.PI;
    want += clamp((roadCenterY(car.y) - car.y) * 0.002, -0.3, 0.3);
  } else if (Math.abs(dy) > 60 && onV) {
    want = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
    want += clamp((roadCenterX(car.x) - car.x) * 0.002, -0.3, 0.3);
  } else if (onV) {
    const cy = roadCenterY(car.y);
    want = Math.abs(car.y - cy) < 24 ? (dx > 0 ? 0 : Math.PI) : (cy > car.y ? Math.PI / 2 : -Math.PI / 2);
  } else if (onH) {
    const cx = roadCenterX(car.x);
    want = Math.abs(car.x - cx) < 24 ? (dy > 0 ? Math.PI / 2 : -Math.PI / 2) : (cx > car.x ? 0 : Math.PI);
  } else {
    const np = nearestRoadPoint(car.x, car.y);
    want = Math.atan2(np.y - car.y, np.x - car.x);
  }
  // Look ahead: a building in the way means turn early.
  const aheadX = car.x + Math.cos(car.angle) * 90;
  const aheadY = car.y + Math.sin(car.angle) * 90;
  if (hitsBuilding(G.city, aheadX, aheadY, 16)) want = car.angle + 0.9;
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const dist = Math.hypot(dx, dy);
  // Nearly reversed: three-point it — reverse while steering, instead of
  // swinging a wide U-turn through the block next door.
  if (Math.abs(diff) > 2.5) {
    return { up: false, down: true, left: diff < -0.08, right: diff > 0.08, brake: false };
  }
  // Slow down for sharp turns: a fast car cannot make a 90-degree city
  // corner inside one intersection, so coast and brake into the turn.
  return {
    up: dist > 40 && Math.abs(diff) < 0.7,
    down: false,
    left: diff < -0.08,
    right: diff > 0.08,
    brake: (Math.abs(diff) > 0.6 && Math.abs(car.speed) > 150) || (dist < 60 && Math.abs(car.speed) > 200),
  };
}

// Run the world forward for `seconds`, steering the player's car at the
// mission marker (or the given point) the whole way. The player is
// unkillable while staging, and restored to full health for the frame.
function playForward(G, seconds, tx, ty) {
  G.player.hp = 1000;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    G.autoDrive = driveToward(G, tx, ty);
    stepWorld(G, STUB_INPUT, STEP);
    if (G.screen !== 'play') break;
  }
  G.autoDrive = null;
  G.player.hp = 100;
  if (G.player.car) G.player.car.hp = G.player.car.maxHp;
  G.screen = 'play';
}

function putPlayerInCar(G, type, x, y, angle) {
  const car = makeCar('player', type, x, y, angle);
  car.hp = 5000; // staging armor: the scene must survive to the frame
  G.cars.push(car);
  const p = G.player;
  p.x = x; p.y = y;
  enterCar(G, car);
  return car;
}

function spawnCopChase(G, n) {
  const p = G.player;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + 0.6;
    const car = makeCar('police', 'police', p.x + Math.cos(a) * 420, p.y + Math.sin(a) * 420, 0);
    car.angle = Math.atan2(p.y - car.y, p.x - car.x);
    car.speed = 380;
    G.cars.push(car);
  }
  G.player.wanted = Math.max(G.player.wanted, 4);
  G.player.heat = 85;
  G.heli = { x: p.x, y: p.y - 260, angle: 0, rotor: 0 };
}

/**
 * Set the world to the named scene (start, play, chase or heist; any other
 * name is start) and return the screen to draw over it.
 */
export function stageShot(name, G) {
  G.screen = 'play';
  G.staging = true; // no foot cops, no busts while a scene is staged
  if (name === 'play') {
    // Midday downtown: sports car, traffic, peds, Night Shift running —
    // a long drive east then south, so the frame lands mid-city, not on
    // the map edge.
    G.clock.minutes = 12 * 60;
    G.clock.rainTarget = 0; G.clock.rain = 0;
    putPlayerInCar(G, 'sports', 1500, 470, 0); // east along the top road
    startMission(G, 3); // Night Shift: drive the fare to the Marina
    G.mission.step = 1;
    G.mission.target = { x: 2400, y: 2800 }; // the marker follows the drive
    // Extra life along the route: cars on the roads, peds on the walks.
    const rng = mulberry32(7);
    for (const [type, x, y, angle] of [
      ['sedan', 1968, 470, 0], ['taxi', 2352, 1200, Math.PI / 2],
      ['van', 2352, 1900, Math.PI / 2], ['truck', 2736, 2600, -Math.PI / 2],
      ['sedan', 1584, 2352, 0],
    ]) {
      const c = makeCar('traffic', type, x, y, angle);
      c.speed = 140 + rng() * 60;
      G.cars.push(c);
    }
    for (const [x, y] of [[2300, 500], [2400, 900], [2300, 1400], [2400, 2000], [2300, 2600], [2000, 2750], [2700, 2750], [2400, 600]]) {
      G.peds.push(makePed(x, y, rng));
    }
    playForward(G, 20, 2400, 2800);
    return { screen: 'play' };
  }
  if (name === 'chase') {
    // Rainy night, 4 stars: cops, chopper, roadblock, neon everywhere.
    G.clock.minutes = 22 * 60;
    G.clock.rainTarget = 0.7; G.clock.rain = 0.7;
    putPlayerInCar(G, 'sports', 1240, 470, Math.PI / 2);
    startMission(G, 2); // Hot Pursuit: drive to the meet, then lose them
    G.mission.step = 1;
    spawnCopChase(G, 3);
    playForward(G, 16, 2000, 2900);
    return { screen: 'play' };
  }
  if (name === 'heist') {
    // Dusk: the Harbor Heist getaway, cash in the truck, heat on.
    G.clock.minutes = 18 * 60 + 30;
    G.clock.rainTarget = 0; G.clock.rain = 0;
    putPlayerInCar(G, 'truck', 430, 900, Math.PI / 2);
    G.player.cash += 4000;
    startMission(G, 5); // Harbor Heist, escape leg
    G.mission.step = 1; // skip straight to the escape
    G.mission.target = { x: 1500, y: 2600 }; // the Marina hideout marker
    spawnCopChase(G, 2);
    playForward(G, 18, 1500, 2600);
    return { screen: 'play' };
  }
  // start: a quiet morning over the harbor, title on top.
  G.clock.minutes = 9 * 60;
  G.clock.rainTarget = 0; G.clock.rain = 0;
  for (let i = 0; i < Math.floor(5 / STEP); i += 1) stepWorld(G, STUB_INPUT, STEP);
  return { screen: 'title' };
}

export { mulberry32 };
