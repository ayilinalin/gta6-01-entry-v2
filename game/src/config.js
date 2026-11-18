// NEON TIDE v2 — tuning, palettes, districts, cars, weapons, prices.
// Every number the sim uses lives here, so the game is tuned in one place.
export const STEP = 1 / 60;
export const TILE = 64;
export const BLOCK = 384; // one city block, edge to edge
export const MAP = 3072; // 8 x 8 blocks, Port Meridian
export const ROAD_W = 96; // road band at the start of every block

// Day length in real seconds; the clock starts at noon on day one.
export const DAY_SECONDS = 480;
export const START_MINUTES = 12 * 60;

// District rectangles: [x0, y0, x1, y1] in world pixels.
export const DISTRICTS = [
  { name: 'Harbor', x0: 0, y0: 0, x1: 768, y1: MAP, ground: '#5d6a58', road: '#3a3f45', accent: '#e8a13a' },
  { name: 'Downtown', x0: 768, y0: 0, x1: 2304, y1: 1536, ground: '#6b6f66', road: '#33373d', accent: '#ff2e88' },
  { name: 'Industrial', x0: 2304, y0: 0, x1: MAP, y1: MAP, ground: '#67604f', road: '#3d3a33', accent: '#ffb02e' },
  { name: 'Marina', x0: 768, y0: 1536, x1: 2304, y1: MAP, ground: '#7d8a6a', road: '#3f463c', accent: '#2ee6c8' },
];

export const PALETTE = {
  sky: '#87b7e8',
  water: '#1d5f8a',
  waterDeep: '#14486b',
  sand: '#d9c08a',
  sidewalk: '#8d8d84',
  building: ['#7a6a8a', '#8a6a5e', '#5e7a8a', '#6a7a5e', '#93706a', '#5e6a7a'],
  roof: ['#4a3f55', '#54423a', '#3a4a55', '#424a3a'],
  neon: ['#ff2e88', '#2ee6c8', '#ffb02e', '#7a5cff', '#ff5c5c'],
};

// Cars the player can steal or drive. topSpeed in px/s, accel in px/s^2.
export const CAR_TYPES = {
  sedan: { name: 'Meridian Sedan', color: '#c94f3d', roof: '#a83a2c', accel: 340, top: 380, grip: 2.6, hp: 100 },
  taxi: { name: 'Harbor Cab', color: '#f2c230', roof: '#f2c230', accel: 320, top: 360, grip: 2.6, hp: 90 },
  truck: { name: 'Dock Hauler', color: '#5e7a8a', roof: '#4a6274', accel: 240, top: 300, grip: 2.2, hp: 160 },
  sports: { name: 'Viper GT', color: '#ff2e88', roof: '#d11a6e', accel: 520, top: 520, grip: 3.4, hp: 80 },
  van: { name: 'Courier Van', color: '#e8e4da', roof: '#c9c4b6', accel: 280, top: 330, grip: 2.4, hp: 120 },
  police: { name: 'PMPD Interceptor', color: '#20242c', roof: '#e8e4da', accel: 460, top: 470, grip: 3.1, hp: 140 },
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.35, range: 34, spread: 0, price: 0, auto: false },
  pistol: { name: 'P9 Pistol', damage: 22, rate: 0.28, range: 420, spread: 0.03, price: 500, auto: false },
  smg: { name: 'K9 SMG', damage: 14, rate: 0.09, range: 380, spread: 0.09, price: 1500, auto: true },
};

export const PRICES = {
  pistol: 500, smg: 1500, armor: 300, heal: 150, snack: 50, spray: 200, repair: 100,
};

// Wanted: heat 0..100 per star. Crimes add heat; hiding sheds it.
export const WANTED = {
  stealCar: 25, hitPed: 20, killPed: 45, hitCop: 40, killCop: 60, shoot: 8,
  decayPerSec: 1.6, decayHiddenPerSec: 4.0, copCars: [0, 1, 2, 3, 4, 5],
  roadblockAt: 3, heliAt: 4, bustSeconds: 2.0,
};

export const PLAYER = {
  walkSpeed: 170, runSpeed: 260, hp: 100, armorMax: 100,
  enterRadius: 70, bustRadius: 46,
};

export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 34;
export const MISSION_REWARDS = [400, 800, 1200, 900, 1500, 4000, 1800, 6000];
