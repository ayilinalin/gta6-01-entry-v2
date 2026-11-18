// NEON TIDE v2 — the story: eight missions for the Tide crew, plus side
// work. Each mission is a chain of steps (go / take / chase / escape / lose
// the heat), with dialogue, a map marker and a cash reward.
import { MISSION_REWARDS } from './config.js';

// Step types: go (reach the marker), take (pick up at the marker),
// chase (ram the target car until it stops), escape (reach the marker
// with the heat on), lose (drop wanted to 0), wait (survive the timer).
const MISSIONS = [
  {
    name: 'First Wheels', giver: 'Rook',
    intro: 'Rook: "New in Port Meridian? Wheels first. Grab any car on the street and bring it to me."',
    steps: [
      { type: 'take', kind: 'car', text: 'Steal any car', x: 0, y: 0 },
      { type: 'go', text: 'Drive it to Rook at the docks', x: 420, y: 700 },
    ],
  },
  {
    name: 'Harbor Run', giver: 'Rook',
    intro: 'Rook: "A package is waiting on Pier 2. Pick it up, run it downtown. Keep it quiet."',
    steps: [
      { type: 'take', kind: 'package', text: 'Pick up the package on Pier 2', x: 150, y: 1500 },
      { type: 'go', text: 'Deliver it to the Downtown drop', x: 1500, y: 430 },
    ],
  },
  {
    name: 'Hot Pursuit', giver: 'Mara',
    intro: 'Mara: "A courier skimmed our cash and he is running. Run his sedan off the road."',
    steps: [
      { type: 'chase', text: 'Ram the courier sedan until it stops', x: 0, y: 0 },
      { type: 'go', text: 'Grab the cash and get clear', x: 2000, y: 2000 },
    ],
  },
  {
    name: 'Night Shift', giver: 'Mara',
    intro: 'Mara: "The cabs are short tonight. Run three fares before dawn and keep the meter honest."',
    steps: [
      { type: 'take', kind: 'fare', text: 'Pick up fare 1 of 3', x: 0, y: 0 },
      { type: 'go', text: 'Drop fare 1 off', x: 0, y: 0 },
      { type: 'take', kind: 'fare', text: 'Pick up fare 2 of 3', x: 0, y: 0 },
      { type: 'go', text: 'Drop fare 2 off', x: 0, y: 0 },
      { type: 'take', kind: 'fare', text: 'Pick up fare 3 of 3', x: 0, y: 0 },
      { type: 'go', text: 'Drop fare 3 off', x: 0, y: 0 },
    ],
  },
  {
    name: 'Clean Getaway', giver: 'Rook',
    intro: 'Rook: "Three stars on you. Vanish. Lose the heat and meet me at the hideout."',
    steps: [
      { type: 'lose', text: 'Lose the wanted level', x: 0, y: 0 },
      { type: 'go', text: 'Meet Rook at the Tide Hideout', x: 430, y: 2400 },
    ],
  },
  {
    name: 'Harbor Heist', giver: 'Mara',
    intro: 'Mara: "The Harbor Bank vault, tonight. Grab the cash, then run — the whole city will be on you."',
    steps: [
      { type: 'take', kind: 'vault', text: 'Crack the Harbor Bank vault', x: 430, y: 900 },
      { type: 'escape', text: 'Escape to the Marina hideout', x: 1500, y: 2600 },
    ],
  },
  {
    name: 'Vigilante', giver: 'Port Authority',
    intro: 'Port Authority: "Three getaway cars are tearing through the city. Stop them — officially unofficially."',
    steps: [
      { type: 'chase', text: 'Stop getaway car 1 of 3', x: 0, y: 0 },
      { type: 'chase', text: 'Stop getaway car 2 of 3', x: 0, y: 0 },
      { type: 'chase', text: 'Stop getaway car 3 of 3', x: 0, y: 0 },
    ],
  },
  {
    name: 'King of the Tide', giver: 'Mara',
    intro: 'Mara: "One last job. Lift the convoy payroll, lose the air unit, and sail out of the marina a legend."',
    steps: [
      { type: 'take', kind: 'crew', text: 'Pick up the crew at the docks', x: 300, y: 2350 },
      { type: 'chase', text: 'Hit the payroll convoy', x: 0, y: 0 },
      { type: 'escape', text: 'Escape to the marina boat', x: 1200, y: 2900 },
    ],
  },
];

export function makeMissionState() {
  return { index: 0, step: 0, active: false, target: null, targetCar: null, timer: 0, done: 0, banner: '' };
}

export function startMission(G, index) {
  const m = MISSIONS[index];
  G.mission.index = index;
  G.mission.step = 0;
  G.mission.active = true;
  G.mission.banner = `${m.name} — ${m.giver}`;
  G.toast(m.intro, 'info');
  G.audio.mission();
  setupStep(G);
}

export function missionOf(G) { return MISSIONS[G.mission.index]; }
export function stepOf(G) {
  const m = missionOf(G);
  return m.steps[Math.min(G.mission.step, m.steps.length - 1)];
}

function setupStep(G) {
  const step = stepOf(G);
  const ms = G.mission;
  ms.target = null; ms.targetCar = null;
  if (step.type === 'chase') {
    // Spawn the target car ahead of the player, fleeing.
    const p = G.player;
    const spot = { x: p.x + 500, y: p.y + 200 };
    const car = { kind: 'target', type: 'sedan', name: 'Target', color: '#8a2be2', roof: '#6a1fb2',
      x: spot.x, y: spot.y, angle: 0, speed: 300, accel: 380, top: 420, grip: 2.6,
      hp: 120, maxHp: 120, driver: true, locked: false, length: 34, width: 18,
      targetSpeed: 300, turnAt: 0, brake: false, smoke: 0, honk: 0, id: 9000 + ms.step };
    car.angle = Math.atan2(p.y - spot.y, p.x - spot.x);
    G.cars.push(car);
    ms.targetCar = car;
  }
  if ((step.type === 'take' || step.type === 'go' || step.type === 'escape') && (step.x || step.y)) {
    ms.target = { x: step.x, y: step.y };
  }
  if (step.type === 'take' && step.kind === 'fare') {
    // A fare waves on a nearby sidewalk.
    const p = G.player;
    const a = G.rng() * Math.PI * 2;
    const d = 300 + G.rng() * 300;
    ms.target = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
    ms.target.x = Math.max(80, Math.min(2990, ms.target.x));
    ms.target.y = Math.max(80, Math.min(2990, ms.target.y));
    ms.fareFrom = { x: ms.target.x, y: ms.target.y };
  }
  if (step.type === 'go' && step.kind === undefined && ms.prevFare) {
    ms.target = ms.prevFare;
    ms.prevFare = null;
  }
}

// Called every step while a mission is active. Advances steps, pays out.
export function stepMissions(G, dt) {
  const ms = G.mission;
  if (!ms.active) return;
  const p = G.player;
  const step = stepOf(G);
  const at = (t, r) => t && Math.hypot(p.x - t.x, p.y - t.y) < (r || 60);
  let advance = false;

  if (step.type === 'take' && step.kind === 'car') {
    if (!p.onFoot) advance = true;
  } else if (step.type === 'take' && step.kind === 'fare') {
    if (at(ms.target, 50)) {
      ms.prevFare = { x: p.x + (G.rng() < 0.5 ? -700 : 700), y: p.y + (G.rng() < 0.5 ? -500 : 500) };
      ms.prevFare.x = Math.max(80, Math.min(2990, ms.prevFare.x));
      ms.prevFare.y = Math.max(80, Math.min(2990, ms.prevFare.y));
      G.toast('Fare aboard — drive them to the marker.', 'good');
      advance = true;
    }
  } else if (step.type === 'take') {
    if (at(ms.target, 60)) {
      if (step.kind === 'vault') { p.cash += 500; G.toast('Vault cracked — $500 in the bag.', 'good'); }
      if (step.kind === 'crew') G.toast('Crew aboard. Hit the convoy.', 'good');
      if (step.kind === 'package') G.toast('Package secured.', 'good');
      advance = true;
    }
  } else if (step.type === 'go' || step.type === 'escape') {
    if (at(ms.target, 70)) advance = true;
  } else if (step.type === 'chase') {
    const t = ms.targetCar;
    if (t && (t.hp <= 0 || t.speed < 5)) {
      const i = G.cars.indexOf(t);
      if (i >= 0) G.cars.splice(i, 1);
      if (missionOf(G).name === 'Hot Pursuit') {
        p.cash += 300; G.toast('Courier stopped — skimmed $300.', 'good');
      }
      advance = true;
    } else if (t) {
      // The target flees from the player.
      const dx = t.x - p.x, dy = t.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = Math.atan2(dy, dx);
      let diff = want - t.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      t.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
      t.speed = Math.min(t.top, t.speed + t.accel * 0.6 * dt);
      t.x += Math.cos(t.angle) * t.speed * dt;
      t.y += Math.sin(t.angle) * t.speed * dt;
    }
  } else if (step.type === 'lose') {
    if (p.wanted === 0) advance = true;
  }

  if (advance) {
    ms.step += 1;
    const m = missionOf(G);
    if (ms.step >= m.steps.length) {
      const reward = MISSION_REWARDS[ms.index] || 500;
      p.cash += reward;
      p.respect += 1;
      ms.done += 1;
      ms.active = false;
      G.toast(`${m.name} complete — $${reward} and a little respect.`, 'good');
      G.audio.complete();
      G.events.push({ type: 'missionComplete', name: m.name, reward });
      if (ms.index + 1 < MISSIONS.length) {
        ms.nextOffer = ms.index + 1;
        G.toast(`New job from ${MISSIONS[ms.index + 1].giver}: ${MISSIONS[ms.index + 1].name} — press N to take it.`, 'info');
      } else {
        G.toast('That was the last job. Port Meridian is yours, legend.', 'good');
      }
    } else {
      setupStep(G);
      G.toast(stepOf(G).text, 'info');
    }
  }
}

// Side work: taxi fares and vigilante targets spawn while free-roaming.
export function stepSideJobs(G, dt) {
  const ms = G.mission;
  if (ms.active) return;
  ms.sideTimer = (ms.sideTimer || 8) - dt;
  if (ms.sideTimer > 0) return;
  ms.sideTimer = 20 + G.rng() * 20;
  if (G.player.cash < 50 && G.rng() < 0.6) {
    G.toast('A fare is waving nearby — pick them up for quick cash (drive close).', 'info');
  }
}

export { MISSIONS };
