# Solara Bay

[![make.fun](https://make.fun/badge/competition/gta6-01)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/entry/solara-bay-v19)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/player/mellow-robin-54)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the make.fun
`gta6-01` bounty. Solara Bay is a sun-soaked beachfront city: drive the
boulevard, walk the lantern market, outrun the Solara Bay Police Department,
fly a jetpack over the sunset roadblock, and run eight story missions for the
crew — from the first pickup at the pier to wrecking the Regent at wanted
level five.

## Play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and visit
http://localhost:8080). No network, no build step — every file the game loads
lives under `game/`.

| Key | Action |
| --- | --- |
| W A S D | Drive / walk / steer the jetpack |
| Shift | Boost (car) / climb (jetpack) |
| Space | Brake / handbrake |
| E | Enter / exit vehicle |
| F | Fire weapon (on foot) |
| J | Toggle jetpack |
| R | Reload |
| M / Tab | Map, stats, workshop and saves |
| Esc | Pause |

## What is in the game

- **A real city**: 8 districts, beach, ocean, pier, Ferris wheel, lantern
  market, yacht marina, traffic, and a dense varied crowd.
- **Wanted 0–5**: six named police units with roles and live distances, patrol
  cars, roadblocks, and helicopters with searchlights at wanted 3+.
- **8 story missions** with staged objectives, waypoints, ratings, and cash
  that varies per mission.
- **Combat**: 6 weapon slots, muzzle flash and tracers, armed enemies who
  shoot back, downed enemies with a pulsing red ring.
- **Jetpack**: flyable, with flame, fuel, and missions that use it.
- **Vehicles**: hero sports car, police sedans with POLICE door lettering,
  light bars and push bars, traffic, a scooter, a tank, and helicopters.
- **Progression**: 66.1% completion ring, 8 progress tracks, career stats,
  workshop upgrades (owned / locked with prices), weapons & gear, crew, and
  3 localStorage save slots.
- **Synth audio**: engine, sirens, gunfire, and mission stings, all
  synthesized in the browser — no audio files.
- **Three skies**: noon, golden hour, and night, with matching fog and sun.

## Layout

- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`.
- `game/index.html` — the page: import map, HUD, and the module entry.
- `game/src/config.js` — missions, districts, police units, weapons, tuning.
- `game/src/textures.js` — procedural canvas textures (facades, roads, sand,
  water, signs).
- `game/src/world.js` — the city: ground, ocean, beach, buildings, pier,
  Ferris wheel, yacht, palms, market, clouds, sky presets.
- `game/src/entities.js` — vehicles, helicopters, jetpack, pedestrians,
  enemies, and their behaviour.
- `game/src/missions.js` — mission state machine, wanted level, police AI,
  shooting combat, and autopilot.
- `game/src/hud.js` — HUD, circular minimap, dialogue, and the meta screen.
- `game/src/audio.js` — synthesized sound effects and music stings.
- `game/src/shots.js` — deterministic staged screenshot scenes.
- `game/src/main.js` — renderer, camera, input, saves, and the game loop.
- `tools/shoot.mjs` — headless-Chrome screenshot harness (CDP, fixed 60 Hz
  steps, adaptive-palette PNG output).
