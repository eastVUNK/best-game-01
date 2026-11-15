# NOVA DRIFT

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/eastVUNK/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/eastVUNK/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A neon twin-stick arena survival shooter that runs offline in a desktop browser from static files. Pilot the last ship of the Drift through a collapsing nebula: blast geometric drone swarms, chain kill combos, collect shards, draft an upgrade after every wave, and face the HEX CORE boss every fifth wave. Clear all 10 waves to stabilize the nebula — then keep flying in endless mode.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network requests: every file the game loads lives under `game/`, and all sound is synthesized live with WebAudio.

## How to play

- **WASD / arrow keys** — move
- **Mouse** — aim
- **Hold click / Space** — fire
- **Shift** — dash (brief shield)
- **P** — pause · **M** — mute · **R** — restart

Kills build a combo multiplier (up to ×4); shards are worth points; hearts repair hull; overdrive pickups double your fire rate. After each cleared wave, pick 1 of 3 upgrades: faster fire, twin barrels, heavier rounds, thrusters, dash recharge, magnet, plating, or overdrive cores.

## Structure

- `game/index.html` — the shell (canvas + status line)
- `game/src/config.js` — every tuning number and colour
- `game/src/world.js` — the simulation: player, enemies, waves, boss, combo, draft
- `game/src/render.js` — all drawing: nebula, starfield, ships, particles, HUD, screens
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — synthesized sound effects (WebAudio, no audio files)
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=title|play|draft|boss|over&seed=N`)
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `screenshots/` — real renders of the game's own code

## Screenshots

1. `1-title.jpg` — title screen
2. `2-action.jpg` — mid-wave combat
3. `3-draft.jpg` — the upgrade draft after a cleared wave
4. `4-boss.jpg` — the HEX CORE boss fight

---

<sub>Entered on [make.fun](https://make.fun/?ref=x13west&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · best-game-01</sub>
