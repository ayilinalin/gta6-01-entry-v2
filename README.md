# NEON TIDE v2

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ayilinalin/gta6-01-entry-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ayilinalin/gta6-01-entry-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime story in **Port Meridian** — a sun-baked harbor city you
can explore on foot and by stolen car, now bigger and deeper: four districts,
a day/night cycle with neon nights and rain, a helicopter at four stars, and
eight story jobs for the Tide crew. Built for the
[make.fun "Make GTA 6" bounty (gta6-01)](https://make.fun/bounty/gta6-01).
Original game: no Rockstar content, all art and sound generated in code.

## Play

Open `game/index.html` in a desktop browser (or serve `game/` statically).
No network, no libraries, no build step — plain canvas + ES modules.

- **WASD** — move on foot / drive, **Shift** — run
- **Mouse** — aim, **click** — attack / shoot
- **E** — steal a nearby car (the PMPD notices) or use a shop, **F** — get out
- **1 / 2 / 3** — fists / pistol / SMG, **Space** — handbrake
- **N** — take the next job, **Esc** — pause, **M** — mute

## What is in the city

- **Open world**: Harbor, Downtown, Industrial and Marina — four districts
  with their own look, all drivable and walkable, with traffic AI, parked cars
  to steal, and pedestrians on the sidewalks who flee gunfire.
- **Day/night + rain**: a full clock, neon signs and headlights after dark,
  rain that rolls in and out.
- **Wanted level 0–5**: stealing, hitting pedestrians and shooting raise your
  heat. PMPD cruisers chase and ram you, foot cops try to bust you, roadblocks
  seal the avenues at 3 stars, and a helicopter circles at 4+.
- **8 story missions** for Rook and Mara — a first car, a harbor run, a courier
  takedown, a night of fares, a clean getaway, the Harbor Bank heist, vigilante
  work, and the final convoy job — with cash and respect rewards.
- **Economy**: Ironworks Arms sells guns and armor, Neon Spray repaints your
  car and clears the heat, Meridian General patches you up, the Tide Diner
  feeds you. The Tide Hideout is where you lay low.
- **Combat** on foot with mouse aim (fists, pistol, SMG), **HUD** with wanted
  stars, health, armor, money, mission objective, speed, clock, district, and
  a live **minimap** with police, mission and shop blips.
- **Start screen + saves** (three localStorage slots, continue where you left
  off), **procedural WebAudio** sound: engine hum, sirens, gunshots, jingles.

## Structure

| File | Job |
| --- | --- |
| `game/index.html` | Canvas shell, loads the game |
| `game/src/main.js` | Game loop, screens, input, state flow |
| `game/src/world.js` | One fixed step of the whole simulation |
| `game/src/city.js` | Road grid, buildings, water, shops |
| `game/src/player.js` | On-foot movement, aiming, entering cars |
| `game/src/vehicles.js` | Stolen cars, traffic AI, driving physics |
| `game/src/pedestrians.js` | Sidewalk walkers that flee danger |
| `game/src/police.js` | Wanted level, pursuit, roadblocks, helicopter |
| `game/src/missions.js` | 8-mission chain, side jobs, story text |
| `game/src/combat.js` | Shooting, bullets, pickups, cop fire |
| `game/src/economy.js` | Cash, shops, prices, paint jobs |
| `game/src/time.js` | Clock, day/night, rain |
| `game/src/hud.js` | HUD, minimap, menus, end screens |
| `game/src/audio.js` | Procedural WebAudio sounds |
| `game/src/save.js` | localStorage save slots |
| `game/src/render.js` | Camera, city, cars, night lighting |
| `game/src/shots.js` | Deterministic `?shot=` scenes for screenshots |
| `game/src/config.js` | Tuning, palettes, cars, weapons |
| `game/src/random.js` | Seeded RNG and math helpers |
| `main.ts` | Copies `game/` + `screenshots/` to the output dir and writes `dossier.json` |
| `vendor/makefun-game.ts` | make.fun dossier library, copied from the kit |

## Build (reproduce the entry)

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/game, out/screenshots, out/dossier.json
```

Run it twice — both runs write byte-identical output.

## License

MIT — see [LICENSE](LICENSE).
