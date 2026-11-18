// NEON TIDE v2 — the clock: a full day runs DAY_SECONDS real seconds,
// dawn to neon night, with rain that rolls in and out.
import { DAY_SECONDS, START_MINUTES } from './config.js';

export function makeClock() {
  return {
    minutes: START_MINUTES, // minutes since midnight
    rain: 0, // 0..1, how hard it rains right now
    rainTarget: 0,
    day: 1,
  };
}

// 0 = midnight, 0.5 = noon. Returns 0..1 daylight (1 = full sun).
export function daylight(clock) {
  // Sun up roughly 06:00–19:00, smooth sine over the daylight hours.
  return Math.max(0, Math.min(1, 0.5 + 0.5 * Math.sin(((clock.minutes - 360) / 780) * Math.PI)));
}

export function clockLabel(clock) {
  const h = Math.floor(clock.minutes / 60) % 24;
  const m = Math.floor(clock.minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isNight(clock) { return daylight(clock) < 0.35; }

export function stepClock(G, dt) {
  const c = G.clock;
  const before = c.minutes;
  c.minutes += (dt / DAY_SECONDS) * 1440;
  if (c.minutes >= 1440) { c.minutes -= 1440; c.day += 1; }
  // Rain drifts toward its target; a new target every in-game hour or so.
  c.rain += (c.rainTarget - c.rain) * Math.min(1, dt * 0.2);
  if (Math.floor(c.minutes / 60) !== Math.floor(before / 60)) {
    if (G.rng() < 0.18) c.rainTarget = 0.4 + G.rng() * 0.6;
    else c.rainTarget = 0;
  }
}
