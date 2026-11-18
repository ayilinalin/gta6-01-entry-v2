// NEON TIDE v2 — saves. Three localStorage slots: cash, respect, missions
// done, position, clock, weapons. Continue resumes the newest slot.
const KEY = 'neon-tide-v2-saves';

export function listSaves() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [null, null, null];
    const arr = JSON.parse(raw);
    return [arr[0] || null, arr[1] || null, arr[2] || null];
  } catch { return [null, null, null]; }
}

export function saveGame(G, slot) {
  try {
    const saves = listSaves();
    const p = G.player;
    saves[slot] = {
      cash: p.cash, respect: p.respect, missionsDone: G.mission.done,
      nextMission: Math.min(G.mission.index + (G.mission.active ? 0 : 1), 7),
      x: p.x, y: p.y, hp: p.hp, armor: p.armor, weapon: p.weapon,
      ammo: p.ammo, minutes: G.clock.minutes, day: G.clock.day,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(saves));
    return true;
  } catch { return false; }
}

export function loadGame(G, slot) {
  const saves = listSaves();
  const s = saves[slot];
  if (!s) return false;
  const p = G.player;
  p.cash = s.cash; p.respect = s.respect;
  p.x = s.x; p.y = s.y; p.hp = s.hp; p.armor = s.armor;
  p.weapon = s.weapon || 'fists'; p.ammo = s.ammo || { pistol: 0, smg: 0 };
  G.mission.done = s.missionsDone || 0;
  G.mission.index = s.nextMission || 0;
  G.clock.minutes = s.minutes; G.clock.day = s.day || 1;
  p.wanted = 0; p.heat = 0;
  return true;
}
