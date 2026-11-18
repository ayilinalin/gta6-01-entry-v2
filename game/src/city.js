// NEON TIDE v2 — Port Meridian itself: roads, blocks, buildings, water, shops.
// The city is generated once from a seed. Roads sit at the start of every
// 384px block, both axes; buildings fill the block interiors.
import { BLOCK, MAP, ROAD_W, DISTRICTS, PALETTE } from './config.js';
import { mulberry32, int, pick, range, chance } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[1];
}

export function onRoad(x, y) {
  if (x < 0 || y < 0 || x >= MAP || y >= MAP) return false;
  return (x % BLOCK) < ROAD_W || (y % BLOCK) < ROAD_W;
}

export function roadCenterX(x) { return Math.floor(x / BLOCK) * BLOCK + ROAD_W / 2; }
export function roadCenterY(y) { return Math.floor(y / BLOCK) * BLOCK + ROAD_W / 2; }

function roadAxis(x, y) {
  const vx = (x % BLOCK) < ROAD_W;
  const hy = (y % BLOCK) < ROAD_W;
  if (vx && !hy) return 'v';
  if (hy && !vx) return 'h';
  return 'x'; // intersection
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const props = []; // palms, lamps, crates, containers, hydrants
  const blocksX = MAP / BLOCK;
  for (let bx = 0; bx < blocksX; bx += 1) {
    for (let by = 0; by < blocksX; by += 1) {
      const x0 = bx * BLOCK + ROAD_W + 14;
      const y0 = by * BLOCK + ROAD_W + 14;
      const w = BLOCK - ROAD_W - 28;
      const d = districtAt(x0 + w / 2, y0 + w / 2);
      const harbor = d.name === 'Harbor';
      const marina = d.name === 'Marina';
      const count = int(rng, 1, 3);
      for (let i = 0; i < count; i += 1) {
        const bw = marina ? range(rng, 60, 110) : range(rng, 70, w - 20);
        const bh = marina ? range(rng, 50, 90) : range(rng, 60, w - 20);
        const px = x0 + range(rng, 0, Math.max(1, w - bw));
        const py = y0 + range(rng, 0, Math.max(1, w - bh));
        const tall = d.name === 'Downtown' && chance(rng, 0.45);
        buildings.push({
          x: px, y: py, w: bw, h: bh,
          color: pick(rng, PALETTE.building),
          roof: pick(rng, PALETTE.roof),
          height: tall ? int(rng, 26, 54) : int(rng, 6, 16),
          neon: chance(rng, d.name === 'Downtown' ? 0.5 : 0.12) ? pick(rng, PALETTE.neon) : null,
          district: d.name,
        });
      }
      // Street props: palms in Marina, containers in Harbor, lamps everywhere.
      const propCount = int(rng, 2, 5);
      for (let i = 0; i < propCount; i += 1) {
        const kind = harbor ? pick(rng, ['container', 'crate', 'lamp']) : marina ? pick(rng, ['palm', 'lamp', 'hydrant']) : pick(rng, ['lamp', 'hydrant', 'crate']);
        props.push({
          kind, x: x0 + range(rng, 0, w), y: y0 + range(rng, 0, w),
          s: kind === 'container' ? range(rng, 46, 70) : range(rng, 10, 18),
          color: kind === 'container' ? pick(rng, ['#b8542e', '#2e7a8a', '#8a6a2e']) : '#3a3f45',
        });
      }
    }
  }

  // Water along the west edge, with three piers jutting into it.
  const water = { x0: 0, y0: 0, x1: 64, y1: MAP };
  const piers = [700, 1500, 2350].map((y) => ({ x0: 0, y0: y - 26, x1: 190, y1: y + 26 }));

  // Shops and landmarks, all placed on roads so the player can reach them.
  const shops = [
    { kind: 'arms', name: 'Ironworks Arms', x: 1240, y: 430, blurb: 'Guns & armor' },
    { kind: 'spray', name: 'Neon Spray', x: 430, y: 1240, blurb: 'New paint, clean slate' },
    { kind: 'spray', name: 'Harbor Spray', x: 2450, y: 1650, blurb: 'New paint, clean slate' },
    { kind: 'hospital', name: 'Meridian General', x: 1650, y: 2450, blurb: 'Patch up, $150' },
    { kind: 'diner', name: 'Tide Diner', x: 900, y: 2050, blurb: 'A meal, $50' },
    { kind: 'hideout', name: 'Tide Hideout', x: 430, y: 2400, blurb: 'Lay low here' },
  ];

  return { buildings, props, water, piers, shops, seed };
}

// Circle vs building test, for cars and pedestrians.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of any building it overlaps. Returns true when pushed.
export function resolveBuildings(city, p, r) {
  let pushed = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r; p.y = cy + (dy / d) * r;
      pushed = true;
    } else if (d2 <= 0.01) {
      p.x = b.x - r - 1;
      pushed = true;
    }
  }
  return pushed;
}

export function nearestRoadPoint(x, y) {
  // Snap a point onto the nearest road centreline.
  const cx = roadCenterX(x);
  const cy = roadCenterY(y);
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  return dx < dy ? { x: cx, y } : { x, y: cy };
}

export function randomRoadPoint(rng) {
  const vertical = chance(rng, 0.5);
  if (vertical) return { x: roadCenterX(range(rng, 0, MAP)), y: range(rng, 0, MAP), axis: 'v' };
  return { x: range(rng, 0, MAP), y: roadCenterY(range(rng, 0, MAP)), axis: 'h' };
}

export { roadAxis };
