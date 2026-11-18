// The screenshot scenes behind ?shot=title|play|draft|boss|over. Each one plays the
// real rules forward from a fresh world, steered by a simple autopilot (keep
// range from the nearest enemy, aim with a little lead, fire constantly, dash
// out when something gets too close), so the frame is what a short game
// really looks like and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_DRAFT, EVENT_OVER, EVENT_VICTORY } from './world.js';
import { SCREEN_DRAFT, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const TITLE_SECONDS = 6;
const PLAY_SECONDS = 24;
// The boss frame is taken 8 s into the fight: the first orb bursts are
// still on screen and the boss bar is nearly full, so the shot reads as a
// fight in progress rather than a mop-up.
const BOSS_SECONDS = 8;
const MAX_PLAY_SECONDS = 240;
// The game-over scene plays a reckless run until it dies. The cap is
// generous (900 s) because the run is long; the hull-skip below is what
// actually guarantees it ends on a real game over instead of outliving it.
const OVER_SECONDS = 900;

/** Aim at the nearest enemy with a little bullet-travel lead. */
function nearestEnemy(state) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function autopilot(state) {
  const p = state.player;
  const target = nearestEnemy(state);
  let move = { x: 0, y: 0 };
  let angle = p.angle;
  let dash = false;
  if (target) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    // Lead the target: bullets take d/720 s to arrive.
    const lead = Math.min(0.45, d / 720);
    const ax = target.x + target.vx * lead;
    const ay = target.y + target.vy * lead;
    angle = Math.atan2(ay - p.y, ax - p.x);
    // Hold ~280 px range: close in when far, back off when close, strafe.
    const want = 280;
    const radial = d > want + 40 ? 1 : d < want - 60 ? -1 : 0;
    const strafe = Math.sin(state.time * 1.7) > 0 ? 1 : -1;
    const rx = dx / d;
    const ry = dy / d;
    let mx = rx * radial + -ry * strafe * 0.7;
    let my = ry * radial + rx * strafe * 0.7;
    // Stay inside the arena.
    if (p.x < 90) mx += 1;
    if (p.x > FIELD.width - 90) mx -= 1;
    if (p.y < 90) my += 1;
    if (p.y > FIELD.height - 90) my -= 1;
    const len = Math.hypot(mx, my) || 1;
    move = { x: mx / len, y: my / len };
    if (d < 80 && p.dashCooldown <= 0) dash = true;
  } else {
    // Nothing to shoot: drift to the centre.
    const dx = FIELD.width / 2 - p.x;
    const dy = FIELD.height / 2 - p.y;
    const d = Math.hypot(dx, dy) || 1;
    move = d > 40 ? { x: dx / d, y: dy / d } : { x: 0, y: 0 };
    angle = Math.atan2(dy, dx);
  }
  return { move, angle, firing: true, dash };
}

function playSteps(world, seconds, autoDraft = false, cap = MAX_PLAY_SECONDS) {
  const limit = Math.min(seconds, cap) / STEP;
  let events = 0;
  for (let i = 0; i < limit; i += 1) {
    events = world.step(STEP, autopilot(world.state), false);
    if (events & EVENT_OVER) break;
    if (events & EVENT_VICTORY) break;
    if (events & EVENT_DRAFT) {
      if (autoDraft && world.state.draft) world.applyUpgrade(world.state.draft[0].id);
      else break;
    }
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Names: title, play, draft, boss (any other is title).
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    // Start at wave 3 so the frame is dense: gunners, weavers and a full
    // spawn queue, not the sparse opening wave.
    world.startWave(3);
    playSteps(world, 22, true);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'draft') {
    // Play wave 1 until the draft is offered (or the pilot dies trying).
    const events = playSteps(world, MAX_PLAY_SECONDS);
    if (events & EVENT_DRAFT) return { screen: SCREEN_DRAFT, best: world.state.score };
    if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    // Jump straight to the wave-5 boss: clear the queue down to the boss.
    world.startWave(5);
    world.state.spawnQueue = ['boss', 'chaser', 'weaver', 'gunner'];
    world.state.spawnTimer = 0.05;
    let events = 0;
    for (let i = 0; i < 20 / STEP; i += 1) {
      events = world.step(STEP, autopilot(world.state), false);
      if (world.state.boss) break;
      if (events & EVENT_OVER) break;
    }
    if (world.state.boss) playSteps(world, BOSS_SECONDS, true);
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'over') {
    // A short, reckless run: no dashing, straight at the swarm.
    const reckless = (state) => {
      const input = autopilot(state);
      input.dash = false;
      const target = nearestEnemy(state);
      if (target) {
        const dx = target.x - state.player.x;
        const dy = target.y - state.player.y;
        const d = Math.hypot(dx, dy) || 1;
        input.move = { x: dx / d, y: dy / d };
      }
      return input;
    };
    for (let i = 0; i < OVER_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, reckless(world.state), false);
      if (events & EVENT_DRAFT && world.state.draft) {
        // Skip plating: a run that never takes hull dies on schedule, so
        // the scene ends on a real game over instead of outliving the cap.
        const pick = world.state.draft.find((u) => u.id !== 'hull') ?? world.state.draft[0];
        world.applyUpgrade(pick.id);
      }
      if (events & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // Title: the attract demo behind the logo.
  for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
    world.step(STEP, { move: { x: 0, y: 0 }, angle: 0, firing: false, dash: false }, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
