// NEON TIDE v2 — the world: one fixed step of the whole simulation.
// main.js runs the loop and the screens; shots.js stages scenes; both
// step the game through here, so a screenshot is a real game state.
import { STEP, TRAFFIC_COUNT, PED_COUNT } from './config.js';
import { mulberry32 } from './random.js';
import { buildCity } from './city.js';
import { makePlayer, stepPlayer, exitCar, enterCar, damagePlayer } from './player.js';
import { spawnTraffic, spawnParked, stepTraffic, stepPlayerCar, collideCars, nearestCar } from './vehicles.js';
import { spawnPeds, stepPeds, carHitsPed } from './pedestrians.js';
import { stepPolice, stepWanted, clearRoadblockCars } from './police.js';
import { stepBullets, stepPickups, copFire, fireWeapon, spawnPickup } from './combat.js';
import { makeMissionState, stepMissions, stepSideJobs, startMission } from './missions.js';
import { makeClock, stepClock } from './time.js';
import { nearestShop } from './economy.js';
import { createAudio } from './audio.js';
import { listSaves, saveGame } from './save.js';
import { makeCamera } from './render.js';

export function createGame(seed) {
  const G = {
    seed,
    rng: mulberry32(seed ^ 0x9e3779b9),
    city: null, player: null, cars: [], peds: [], cops: [],
    bullets: [], pickups: [], sparks: [], toasts: [], events: [],
    clock: null, mission: null, cam: makeCamera(),
    audio: createAudio(), screen: 'title',
    time: 0, mouseWorldX: 0, mouseWorldY: 0, muzzle: 0,
    lastShotAt: -99, lastShotX: 0, lastShotY: 0,
    heli: null, roadblock: null, roadblockAt: -99,
    shopNear: null, shopOpen: null, shopSel: 0, nearestCar: null,
    pendingDamage: 0, autoDrive: null, saves: listSaves(),
  };
  G.toast = (text, kind) => { G.toasts.push({ text, kind: kind || 'info', at: G.time }); };
  resetWorld(G, seed);
  return G;
}

export function resetWorld(G, seed) {
  G.city = buildCity(seed);
  G.player = makePlayer(1240, 520);
  G.cars = [...spawnTraffic(G.city, TRAFFIC_COUNT, seed + 1), ...spawnParked(G.city, 12, seed + 2)];
  G.peds = spawnPeds(G.city, PED_COUNT, seed + 3);
  G.cops = [];
  G.bullets = []; G.pickups = []; G.sparks = []; G.toasts = []; G.events = [];
  G.clock = makeClock();
  G.mission = makeMissionState();
  G.mission.nextOffer = 0;
  G.heli = null; G.roadblock = null; G.roadblockAt = -99;
  G.shopNear = null; G.shopOpen = null; G.shopSel = 0;
  G.pendingDamage = 0; G.autoDrive = null;
  G.time = 0; G.muzzle = 0;
  G.lastShotAt = -99;
  // A few pickups scattered on the streets.
  const prng = mulberry32(seed + 7);
  const kinds = ['cash', 'health', 'armor', 'pistol_ammo', 'cash', 'health'];
  for (const kind of kinds) {
    spawnPickup(G, kind, 300 + prng() * 2400, 300 + prng() * 2400);
  }
}

// One fixed step. input is the real keyboard/mouse state, or a stub in shots.
export function stepWorld(G, input, dt) {
  G.time += dt;
  G.muzzle = Math.max(0, G.muzzle - dt);
  for (let i = G.sparks.length - 1; i >= 0; i -= 1) {
    G.sparks[i].life -= dt;
    if (G.sparks[i].life <= 0) G.sparks.splice(i, 1);
  }
  stepClock(G, dt);

  const p = G.player;

  // --- player ---
  if (p.onFoot) {
    stepPlayer(G, input, dt);
    // Firing: hold for auto weapons, fresh press for the rest.
    const firing = input.mouseDown && (p.weapon === 'smg' || input.mousePressedEdge);
    if (firing) fireWeapon(G);
    if (input.consumePressed && input.consumePressed('KeyE')) {
      const shop = nearestShop(G, 80);
      if (shop) { G.shopOpen = shop; G.shopSel = 0; G.screen = 'shop'; }
      else {
        const car = nearestCar(G, p.x, p.y, 70, ['parked', 'traffic']);
        if (car) enterCar(G, car);
      }
    }
    if (input.consumePressed && input.consumePressed('KeyF')) { /* on foot: nothing */ }
  } else if (p.car) {
    const drive = G.autoDrive || {
      up: input.down('KeyW', 'ArrowUp'),
      down: input.down('KeyS', 'ArrowDown'),
      left: input.down('KeyA', 'ArrowLeft'),
      right: input.down('KeyD', 'ArrowRight'),
      brake: input.down('Space'),
    };
    stepPlayerCar(G, p.car, drive, dt);
    p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle;
    if (input.consumePressed && input.consumePressed('KeyF')) exitCar(G);
  }
  if (input.consumePressed) {
    if (input.consumePressed('Digit1')) { p.weapon = 'fists'; }
    if (input.consumePressed('Digit2') && (p.ammo.pistol > 0 || p.weapon === 'pistol')) { p.weapon = 'pistol'; }
    if (input.consumePressed('Digit3') && (p.ammo.smg > 0 || p.weapon === 'smg')) { p.weapon = 'smg'; }
    if (input.consumePressed('KeyN')) {
      const ms = G.mission;
      if (!ms.active && ms.nextOffer !== null && ms.nextOffer !== undefined) {
        startMission(G, ms.nextOffer);
        ms.nextOffer = null;
      }
    }
  }

  // --- the city lives ---
  stepTraffic(G, dt);
  stepPeds(G, dt);
  stepPolice(G, dt);
  stepWanted(G, dt);
  stepBullets(G, dt);
  stepPickups(G, dt);
  copFire(G, dt);
  stepMissions(G, dt);
  stepSideJobs(G, dt);
  collideCars(G);

  // The player's car running someone over is a crime.
  if (!p.onFoot && p.car) {
    const hit = carHitsPed(G, p.car);
    if (hit) {
      p.heat = Math.min(100, p.heat + 20);
      p.wanted = Math.min(5, Math.floor(p.heat / 20));
      G.toast('You ran someone over — the PMPD saw that.', 'bad');
    }
  }

  // Damage queued by cop bullets.
  if (G.pendingDamage > 0) {
    damagePlayer(G, G.pendingDamage);
    G.pendingDamage = 0;
  }

  // --- events ---
  for (const ev of G.events) {
    if (ev.type === 'playerDown') {
      G.screen = 'wasted';
      G.audio.complete();
    } else if (ev.type === 'busted') {
      const fine = Math.min(p.cash, 300);
      p.cash -= fine;
      p.wanted = 0; p.heat = 0;
      G.cops = [];
      clearRoadblockCars(G);
      G.screen = 'busted';
    } else if (ev.type === 'draggedOut') {
      exitCar(G);
      damagePlayer(G, 10);
      G.toast('A cop dragged you out of the car!', 'bad');
    } else if (ev.type === 'carWrecked' && ev.car === p.car) {
      exitCar(G);
      G.toast('Your car is wrecked.', 'bad');
    } else if (ev.type === 'carWrecked') {
      // A wrecked traffic / police / target car leaves the road.
      const i = G.cars.indexOf(ev.car);
      if (i >= 0) G.cars.splice(i, 1);
    } else if (ev.type === 'missionComplete') {
      saveGame(G, 0);
    }
  }
  G.events.length = 0;

  // --- proximity, for HUD hints and shops ---
  G.nearestCar = p.onFoot ? nearestCar(G, p.x, p.y, 70, ['parked', 'traffic']) : null;
  G.shopNear = p.onFoot ? nearestShop(G, 80) : null;

  // --- sound follows the action ---
  if (!p.onFoot && p.car) G.audio.engine(Math.abs(p.car.speed) / p.car.top);
  else G.audio.engine(0);
  if (p.wanted >= 2) G.audio.siren(dt);

  // Mouse position in world space, for aiming.
  if (input.mouseX !== undefined && G.cam) {
    G.mouseWorldX = G.cam.x + input.mouseX;
    G.mouseWorldY = G.cam.y + input.mouseY;
  }
}

export { STEP };
