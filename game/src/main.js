// NOVA DRIFT — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between six
// screens: title, play, draft, paused, game over and victory.
//
// ?seed=N fixes the spawn pattern. ?shot=title|play|draft|boss|over (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.

import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BOSS, EVENT_DASH, EVENT_DRAFT, EVENT_ENEMY_SHOOT, EVENT_EXPLODE, EVENT_HEAL, EVENT_HIT, EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART,
  ACTION_UPGRADE_1, ACTION_UPGRADE_2, ACTION_UPGRADE_3, createInput,
} from './input.js';
import {
  createRenderer, SCREEN_DRAFT, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_TITLE, SCREEN_VICTORY,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { x: 0, y: 0, inside: false }, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function playEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_ENEMY_SHOOT) audio.enemyShoot();
    if (events & EVENT_EXPLODE) audio.explode((events & EVENT_BOSS) !== 0);
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HEAL) audio.heart();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_BOSS) audio.bossAlarm();
    if (events & EVENT_WAVE_CLEAR) audio.waveHorn();
    if (events & EVENT_DRAFT) audio.upgrade();
    if (events & EVENT_VICTORY) audio.victory();
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Survive wave 1.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_VICTORY) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_DRAFT;
        announce('Choose an upgrade.');
      }
      return;
    }
    if (screen === SCREEN_DRAFT) {
      if (actions & ACTION_UPGRADE_1) pickUpgrade(0);
      else if (actions & ACTION_UPGRADE_2) pickUpgrade(1);
      else if (actions & ACTION_UPGRADE_3) pickUpgrade(2);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  }

  function pickUpgrade(index) {
    const draft = world.state.draft;
    if (!draft || !draft[index]) return;
    audio.click();
    world.applyUpgrade(draft[index].id);
    screen = SCREEN_PLAY;
    announce(`Wave ${world.state.wave}. Upgrade: ${draft[index].name}.`);
  }

  function handleClick() {
    if (!input.clicked) return;
    audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      startGame();
      return;
    }
    if (screen === SCREEN_VICTORY) {
      screen = SCREEN_DRAFT;
      announce('Choose an upgrade.');
      return;
    }
    if (screen === SCREEN_DRAFT) {
      // Click a card: cards are laid out by render.js — three 300x210 cards,
      // 28 px apart, starting at y=250, centred horizontally.
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
      const ox = (rect.width - FIELD.width * scale) / 2;
      const oy = (rect.height - FIELD.height * scale) / 2;
      const aim = input.aim();
      const fx = (aim.x - ox) / scale;
      const fy = (aim.y - oy) / scale;
      const cw = 300;
      const ch = 210;
      const gap = 28;
      const total = cw * 3 + gap * 2;
      const x0 = (FIELD.width - total) / 2;
      const y0 = 250;
      for (let i = 0; i < 3; i += 1) {
        const x = x0 + i * (cw + gap);
        if (fx >= x && fx <= x + cw && fy >= y0 && fy <= y0 + ch) {
          pickUpgrade(i);
          return;
        }
      }
    }
  }

  function step(actions, firstStep) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { move: { x: 0, y: 0 }, angle: 0, firing: false, dash: false }, true);
      return;
    }
    const p = world.state.player;
    const aim = input.aim();
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const ox = (rect.width - FIELD.width * scale) / 2;
    const oy = (rect.height - FIELD.height * scale) / 2;
    const aimX = (aim.x - ox) / scale;
    const aimY = (aim.y - oy) / scale;
    const angle = Math.atan2(aimY - p.y, aimX - p.x);
    const events = world.step(STEP, {
      move: input.move(),
      angle,
      firing: input.firing,
      dash: firstStep && (actions & ACTION_DASH) !== 0,
    }, false);
    playEvents(events);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_VICTORY) {
      screen = SCREEN_VICTORY;
      announce(`Victory! Score ${world.state.score}.`);
    } else if (events & EVENT_DRAFT) {
      screen = SCREEN_DRAFT;
      announce(`Wave ${world.state.wave} cleared. Choose an upgrade.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    handleClick();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions, first);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const aim = input.aim();
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const ox = (rect.width - FIELD.width * scale) / 2;
    const oy = (rect.height - FIELD.height * scale) / 2;
    renderer.draw(world.state, screen, best, {
      x: (aim.x - ox) / scale,
      y: (aim.y - oy) / scale,
      inside: aim.inside,
    }, muted);
  }

  // Leaving the tab pauses a running game rather than letting drones swarm unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('NOVA DRIFT. Press Space or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
