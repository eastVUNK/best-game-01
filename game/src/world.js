// NOVA DRIFT — the simulation: the player ship, enemies, bullets, pickups,
// waves, the boss, the combo meter and the upgrade draft. Pure logic, no DOM
// and no drawing: render.js paints this state, main.js drives it.

import { COMBO, ENEMY, FIELD, FX, ORB, PICKUP, PLAYER, UPGRADES, WAVE } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_VICTORY = 8;
export const EVENT_BOSS = 16;
export const EVENT_SHOOT = 32;
export const EVENT_ENEMY_SHOOT = 64;
export const EVENT_EXPLODE = 128;
export const EVENT_PICKUP = 256;
export const EVENT_DASH = 512;
export const EVENT_HEAL = 1024;
export const EVENT_DRAFT = 2048;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** The wave's spawn queue: kinds in order, shuffled. */
function buildWaveQueue(rng, wave) {
  const count = Math.min(WAVE.baseCount + (wave - 1) * WAVE.perWave, WAVE.maxCount);
  const queue = [];
  for (let i = 0; i < count; i += 1) {
    const roll = rng.next();
    let kind = 'chaser';
    if (wave >= 4 && roll < 0.16) kind = 'splitter';
    else if (wave >= 3 && roll < 0.38) kind = 'gunner';
    else if (wave >= 2 && roll < 0.62) kind = 'weaver';
    queue.push(kind);
  }
  // Shuffle.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  if (wave % WAVE.bossEvery === 0) queue.push('boss');
  return queue;
}

function makeEnemy(rng, kind, wave, x, y) {
  const base = ENEMY[kind];
  const scale = 1 + (wave - 1) * 0.05;
  const enemy = {
    kind,
    x, y,
    vx: 0, vy: 0,
    radius: base.radius,
    hull: Math.round(base.hull * scale),
    maxHull: Math.round(base.hull * scale),
    speed: base.speed * (0.9 + rng.next() * 0.2),
    score: base.score,
    shards: base.shards,
    color: base.color,
    shape: base.shape,
    angle: rng.angle(),
    spin: rng.range(-1.5, 1.5),
    // Weaver phase; gunner fire timer; boss timers.
    phase: rng.range(0, TAU),
    fireTimer: rng.range(1.2, 2.4),
    burstTimer: 3,
    spawnTimer: 5,
    flash: 0,
    wobble: rng.range(0, TAU),
  };
  return enemy;
}

export function createWorld(rng) {
  const state = {
    time: 0,
    wave: 0,
    score: 0,
    shards: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    combo: 0,
    comboTimer: 0,
    comboMult: 1,
    best: 0,
    won: false,
    over: false,
    shake: 0,
    spawnQueue: [],
    spawnTimer: 0,
    draft: null,
    boss: null,
    player: null,
    bullets: [],
    enemies: [],
    orbs: [],
    pickups: [],
    particles: [],
    floaters: [],
  };

  function freshPlayer() {
    return {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0, vy: 0,
      angle: -Math.PI / 2,
      radius: PLAYER.radius,
      hull: PLAYER.hull,
      maxHull: PLAYER.hull,
      fireTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashX: 0, dashY: 0,
      invuln: 0,
      overdrive: 0,
      thrustTimer: 0,
      // Upgradeable stats.
      speed: PLAYER.speed,
      fireInterval: PLAYER.fireInterval,
      bulletDamage: PLAYER.bulletDamage,
      bullets: 1,
      magnet: 120,
      dashCooldownMax: PLAYER.dashCooldown,
      overdriveMult: 1,
      overdriveGain: 1,
    };
  }

  function spawnParticles(x, y, color, count, speed, size = 3, life = 0.6) {
    for (let i = 0; i < count && state.particles.length < FX.maxParticles; i += 1) {
      const a = rng.angle();
      const v = rng.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: rng.range(life * 0.5, life),
        maxLife: life,
        size: rng.range(size * 0.6, size * 1.4),
        color,
        drag: 2.2,
      });
    }
  }

  function addFloater(x, y, text, color, size = 15) {
    if (state.floaters.length >= FX.maxFloaters) state.floaters.shift();
    state.floaters.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
  }

  function dropPickups(enemy) {
    for (let i = 0; i < enemy.shards; i += 1) {
      state.pickups.push({
        kind: 'shard',
        x: enemy.x + rng.range(-14, 14),
        y: enemy.y + rng.range(-14, 14),
        vx: rng.range(-60, 60), vy: rng.range(-60, 60),
        radius: PICKUP.shard.radius,
        life: PICKUP.shard.life,
      });
    }
    const roll = rng.next();
    if (roll < 0.04) {
      state.pickups.push({
        kind: 'heart', x: enemy.x, y: enemy.y, vx: 0, vy: 0,
        radius: PICKUP.heart.radius, life: PICKUP.heart.life,
      });
    } else if (roll < 0.04 + 0.03 * state.player.overdriveGain) {
      state.pickups.push({
        kind: 'overdrive', x: enemy.x, y: enemy.y, vx: 0, vy: 0,
        radius: PICKUP.overdrive.radius, life: PICKUP.overdrive.life,
      });
    }
  }

  function killEnemy(enemy, index, events) {
    const p = state.player;
    state.enemies.splice(index, 1);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.comboMult = Math.min(1 + (state.combo - 1) * COMBO.step, COMBO.max);
    const gained = Math.round(enemy.score * state.comboMult);
    state.score += gained;
    addFloater(enemy.x, enemy.y - enemy.radius - 6, `+${gained}`, '#eef6ff', 15);
    if (state.combo >= 5 && state.combo % 5 === 0) {
      addFloater(p.x, p.y - 30, `COMBO x${state.comboMult.toFixed(2)}`, '#ffd166', 18);
    }
    spawnParticles(enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 60 : 16, enemy.kind === 'boss' ? 320 : 220, 3.5);
    spawnParticles(enemy.x, enemy.y, '#ffffff', 6, 140, 2);
    state.shake = Math.min(FX.shakeMax, state.shake + (enemy.kind === 'boss' ? 12 : 3));
    dropPickups(enemy);
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 3; i += 1) {
        const mite = makeEnemy(rng, 'mite', state.wave, enemy.x + rng.range(-20, 20), enemy.y + rng.range(-20, 20));
        state.enemies.push(mite);
      }
    }
    if (enemy.kind === 'boss') state.boss = null;
    return events | EVENT_EXPLODE;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = buildWaveQueue(rng, wave);
    state.spawnTimer = 0.6;
    state.draft = null;
  }

  function offerDraft() {
    const pool = [...UPGRADES];
    const picks = [];
    while (picks.length < 3 && pool.length > 0) {
      const i = Math.floor(rng.next() * pool.length);
      picks.push(pool.splice(i, 1)[0]);
    }
    state.draft = picks;
    return EVENT_DRAFT;
  }

  function applyUpgrade(id) {
    if (!state.draft) return;
    const found = state.draft.find((u) => u.id === id);
    if (!found) return;
    const p = state.player;
    // The upgrade functions mutate the player's upgradeable stats.
    found.apply(p);
    state.draft = null;
    startWave(state.wave + 1);
  }

  function reset() {
    state.time = 0;
    state.wave = 0;
    state.score = 0;
    state.shards = 0;
    state.kills = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.comboMult = 1;
    state.won = false;
    state.over = false;
    state.shake = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.draft = null;
    state.boss = null;
    state.player = freshPlayer();
    state.bullets = [];
    state.enemies = [];
    state.orbs = [];
    state.pickups = [];
    state.particles = [];
    state.floaters = [];
    startWave(1);
  }

  function spawnFromQueue() {
    const kind = state.spawnQueue.shift();
    // Spawn at a random edge point, away from the player.
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = Math.floor(rng.next() * 4);
      if (edge === 0) { x = rng.range(30, FIELD.width - 30); y = 24; }
      else if (edge === 1) { x = rng.range(30, FIELD.width - 30); y = FIELD.height - 24; }
      else if (edge === 2) { x = 24; y = rng.range(30, FIELD.height - 30); }
      else { x = FIELD.width - 24; y = rng.range(30, FIELD.height - 30); }
      const p = state.player;
      if (dist2(x, y, p.x, p.y) > 260 * 260) break;
    }
    const enemy = makeEnemy(rng, kind, state.wave, x, y);
    state.enemies.push(enemy);
    if (kind === 'boss') {
      state.boss = enemy;
      return EVENT_BOSS;
    }
    return 0;
  }

  /**
   * Advance the world one fixed step. `input` is { move: {x,y}, angle, firing,
   * dash } — the live controls or the screenshot autopilot. `attract` skips the
   * player and runs a background demo (title screen). Returns event flags.
   */
  function step(dt, input, attract = false) {
    let events = 0;
    state.time += dt;
    const p = state.player;

    // Combo decay.
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.comboMult = 1;
      }
    }
    // Shake decay.
    if (state.shake > 0) state.shake = Math.max(0, state.shake - FX.shakeDecay * dt);

    // Particles and floaters always animate.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { state.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const drag = Math.max(0, 1 - pt.drag * dt);
      pt.vx *= drag;
      pt.vy *= drag;
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }

    if (attract) {
      // Title backdrop: a few drones drift and a ghost ship circles.
      if (state.enemies.length < 7 && rng.next() < dt * 1.4) {
        const e = makeEnemy(rng, rng.pick(['chaser', 'weaver', 'gunner']), 1,
          rng.range(60, FIELD.width - 60), rng.range(60, FIELD.height - 60));
        state.enemies.push(e);
      }
      for (const e of state.enemies) {
        e.angle += e.spin * dt;
        e.x += Math.cos(e.angle) * e.speed * 0.25 * dt;
        e.y += Math.sin(e.angle) * e.speed * 0.25 * dt;
        if (e.x < 20 || e.x > FIELD.width - 20) e.angle = Math.PI - e.angle;
        if (e.y < 20 || e.y > FIELD.height - 20) e.angle = -e.angle;
      }
      return events;
    }

    if (state.over || state.draft) return events;

    // --- Player ---
    p.invuln = Math.max(0, p.invuln - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.overdrive = Math.max(0, p.overdrive - dt);
    p.angle = input.angle;

    if (input.dash && p.dashCooldown <= 0 && p.dashTimer <= 0) {
      const mx = input.move.x;
      const my = input.move.y;
      const len = Math.hypot(mx, my);
      if (len > 0.01) {
        p.dashX = mx / len;
        p.dashY = my / len;
      } else {
        p.dashX = Math.cos(p.angle);
        p.dashY = Math.sin(p.angle);
      }
      p.dashTimer = PLAYER.dashTime;
      p.dashCooldown = p.dashCooldownMax;
      p.invuln = Math.max(p.invuln, PLAYER.dashInvuln);
      spawnParticles(p.x, p.y, '#7df9ff', 10, 200, 3);
      events |= EVENT_DASH;
    }

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashX * PLAYER.dashSpeed;
      p.vy = p.dashY * PLAYER.dashSpeed;
    } else {
      p.vx += input.move.x * PLAYER.accel * dt;
      p.vy += input.move.y * PLAYER.accel * dt;
      const damp = Math.max(0, 1 - PLAYER.friction * dt);
      p.vx *= damp;
      p.vy *= damp;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > p.speed) {
        p.vx = (p.vx / speed) * p.speed;
        p.vy = (p.vy / speed) * p.speed;
      }
    }
    p.x = clamp(p.x + p.vx * dt, p.radius, FIELD.width - p.radius);
    p.y = clamp(p.y + p.vy * dt, p.radius, FIELD.height - p.radius);

    // Thruster particles.
    p.thrustTimer -= dt;
    if ((Math.abs(p.vx) > 40 || Math.abs(p.vy) > 40) && p.thrustTimer <= 0) {
      p.thrustTimer = PLAYER.thrustRate;
      const back = Math.atan2(p.vy, p.vx) + Math.PI;
      state.particles.push({
        x: p.x + Math.cos(back) * p.radius * 0.9 + rng.range(-3, 3),
        y: p.y + Math.sin(back) * p.radius * 0.9 + rng.range(-3, 3),
        vx: Math.cos(back + rng.range(-0.4, 0.4)) * 120,
        vy: Math.sin(back + rng.range(-0.4, 0.4)) * 120,
        life: 0.35, maxLife: 0.35, size: 2.5, color: '#38bdf8', drag: 3,
      });
    }

    // --- Firing ---
    p.fireTimer -= dt;
    const interval = p.overdrive > 0 ? p.fireInterval * 0.5 : p.fireInterval;
    if (input.firing && p.fireTimer <= 0) {
      p.fireTimer = interval;
      const n = p.bullets;
      const spread = 0.12;
      for (let i = 0; i < n; i += 1) {
        const off = (i - (n - 1) / 2) * spread;
        const a = p.angle + off;
        state.bullets.push({
          x: p.x + Math.cos(a) * (p.radius + 6),
          y: p.y + Math.sin(a) * (p.radius + 6),
          vx: Math.cos(a) * PLAYER.bulletSpeed + p.vx * 0.35,
          vy: Math.sin(a) * PLAYER.bulletSpeed + p.vy * 0.35,
          radius: PLAYER.bulletRadius,
          damage: p.bulletDamage * (p.overdrive > 0 ? 1.5 : 1),
          life: PLAYER.bulletRange / PLAYER.bulletSpeed,
        });
        state.shotsFired += 1;
      }
      events |= EVENT_SHOOT;
    }

    // --- Spawning ---
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = Math.max(WAVE.spawnIntervalMin, WAVE.spawnInterval - state.wave * 0.04);
        events |= spawnFromQueue();
      }
    }

    // --- Bullets ---
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        const rr = b.radius + e.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          e.hull -= b.damage;
          e.flash = 0.09;
          state.shotsHit += 1;
          spawnParticles(b.x, b.y, '#a5f3fc', 3, 120, 2);
          state.bullets.splice(i, 1);
          if (e.hull <= 0) events |= killEnemy(e, j, events);
          break;
        }
      }
    }

    // --- Enemies ---
    for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
      const e = state.enemies[j];
      e.flash = Math.max(0, e.flash - dt);
      e.angle += e.spin * dt * 0.4;
      e.phase += dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;

      if (e.kind === 'chaser' || e.kind === 'mite' || e.kind === 'splitter') {
        e.vx += nx * e.speed * 2.4 * dt;
        e.vy += ny * e.speed * 2.4 * dt;
      } else if (e.kind === 'weaver') {
        const px = -ny * Math.sin(e.phase * 2.4);
        const py = nx * Math.sin(e.phase * 2.4);
        e.vx += (nx * 0.8 + px * 0.9) * e.speed * 2.4 * dt;
        e.vy += (ny * 0.8 + py * 0.9) * e.speed * 2.4 * dt;
      } else if (e.kind === 'gunner') {
        const want = 300;
        const toward = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
        e.vx += nx * toward * e.speed * 2 * dt;
        e.vy += ny * toward * e.speed * 2 * dt;
        e.vx += -ny * Math.sin(e.phase * 1.3) * 40 * dt;
        e.vy += nx * Math.sin(e.phase * 1.3) * 40 * dt;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && d < 520) {
          e.fireTimer = 2.3;
          state.orbs.push({
            x: e.x, y: e.y,
            vx: nx * ORB.speed, vy: ny * ORB.speed,
            radius: ORB.radius, damage: ORB.damage, life: 4,
          });
          events |= EVENT_ENEMY_SHOOT;
        }
      } else if (e.kind === 'boss') {
        e.vx += nx * e.speed * 1.6 * dt;
        e.vy += ny * e.speed * 1.6 * dt;
        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burstTimer = 3.1;
          const n = 10 + Math.min(6, Math.floor(state.wave / 5) * 2);
          for (let k = 0; k < n; k += 1) {
            const a = (k / n) * TAU + e.phase;
            state.orbs.push({
              x: e.x, y: e.y,
              vx: Math.cos(a) * ORB.speed * 0.85,
              vy: Math.sin(a) * ORB.speed * 0.85,
              radius: ORB.radius, damage: ORB.damage, life: 5,
            });
          }
          events |= EVENT_ENEMY_SHOOT;
        }
        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0) {
          e.spawnTimer = 6;
          for (let k = 0; k < 2; k += 1) {
            const m = makeEnemy(rng, 'chaser', state.wave, e.x + rng.range(-50, 50), e.y + rng.range(-50, 50));
            state.enemies.push(m);
          }
        }
      }

      // Speed cap + light separation so enemies do not stack.
      const sp = Math.hypot(e.vx, e.vy);
      if (sp > e.speed) {
        e.vx = (e.vx / sp) * e.speed;
        e.vy = (e.vy / sp) * e.speed;
      }
      for (let k = 0; k < state.enemies.length; k += 1) {
        if (k === j) continue;
        const o = state.enemies[k];
        const rr = e.radius + o.radius;
        const dd2 = dist2(e.x, e.y, o.x, o.y);
        if (dd2 < rr * rr && dd2 > 0.01) {
          const dd = Math.sqrt(dd2);
          const push = (rr - dd) * 0.5;
          const ux = (e.x - o.x) / dd;
          const uy = (e.y - o.y) / dd;
          e.x += ux * push * 0.5;
          e.y += uy * push * 0.5;
        }
      }
      e.x = clamp(e.x + e.vx * dt, e.radius, FIELD.width - e.radius);
      e.y = clamp(e.y + e.vy * dt, e.radius, FIELD.height - e.radius);

      // Touching the player hurts.
      const rr = e.radius + p.radius - 4;
      if (p.invuln <= 0 && dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        const damage = e.kind === 'boss' ? 30 : 12;
        p.hull -= damage;
        p.invuln = PLAYER.hurtInvuln;
        state.combo = 0;
        state.comboMult = 1;
        state.shake = Math.min(FX.shakeMax, state.shake + 8);
        spawnParticles(p.x, p.y, '#ff5d73', 18, 260, 3.5);
        events |= EVENT_HIT;
        // Knock the enemy back so one touch is one hit.
        e.vx = -nx * 320;
        e.vy = -ny * 320;
        if (p.hull <= 0) {
          p.hull = 0;
          state.over = true;
          spawnParticles(p.x, p.y, '#7df9ff', 70, 380, 4, 1.1);
          spawnParticles(p.x, p.y, '#ffffff', 30, 260, 3, 0.9);
          state.shake = FX.shakeMax;
          events |= EVENT_OVER | EVENT_EXPLODE;
        }
      }
    }

    // --- Enemy orbs ---
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const o = state.orbs[i];
      o.life -= dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.life <= 0 || o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) {
        state.orbs.splice(i, 1);
        continue;
      }
      const rr = o.radius + p.radius - 2;
      if (p.invuln <= 0 && dist2(o.x, o.y, p.x, p.y) < rr * rr) {
        p.hull -= o.damage;
        p.invuln = PLAYER.hurtInvuln;
        state.combo = 0;
        state.comboMult = 1;
        state.shake = Math.min(FX.shakeMax, state.shake + 6);
        spawnParticles(p.x, p.y, '#ffb703', 14, 240, 3);
        state.orbs.splice(i, 1);
        events |= EVENT_HIT;
        if (p.hull <= 0) {
          p.hull = 0;
          state.over = true;
          spawnParticles(p.x, p.y, '#7df9ff', 70, 380, 4, 1.1);
          state.shake = FX.shakeMax;
          events |= EVENT_OVER | EVENT_EXPLODE;
        }
      }
    }

    // --- Pickups ---
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.life -= dt;
      if (pk.life <= 0) { state.pickups.splice(i, 1); continue; }
      pk.vx *= Math.max(0, 1 - 3 * dt);
      pk.vy *= Math.max(0, 1 - 3 * dt);
      const d = Math.hypot(p.x - pk.x, p.y - pk.y) || 1;
      const magnetRange = p.magnet * (pk.kind === 'shard' ? 1 : 0.85);
      if (d < magnetRange) {
        const pull = 900 * dt;
        pk.vx += ((p.x - pk.x) / d) * pull;
        pk.vy += ((p.y - pk.y) / d) * pull;
      }
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      const rr = pk.radius + p.radius + 2;
      if (dist2(pk.x, pk.y, p.x, p.y) < rr * rr) {
        if (pk.kind === 'shard') {
          state.score += PICKUP.shard.value;
          state.shards += 1;
          events |= EVENT_PICKUP;
        } else if (pk.kind === 'heart') {
          p.hull = Math.min(p.maxHull, p.hull + PICKUP.heart.heal);
          addFloater(p.x, p.y - 28, `+${PICKUP.heart.heal} HULL`, '#80ed99', 16);
          events |= EVENT_HEAL;
        } else if (pk.kind === 'overdrive') {
          p.overdrive = PICKUP.overdrive.seconds * p.overdriveMult;
          addFloater(p.x, p.y - 28, 'OVERDRIVE!', '#ffd166', 18);
          events |= EVENT_PICKUP;
        }
        spawnParticles(pk.x, pk.y, '#ffd166', 6, 140, 2.5);
        state.pickups.splice(i, 1);
      }
    }

    // --- Wave cleared? ---
    if (!state.over && state.spawnQueue.length === 0 && state.enemies.length === 0 && !state.draft) {
      if (state.wave >= WAVE.winWave && !state.won) {
        // Winning also offers the draft: confirm on the victory screen leads
        // straight into it, then the next wave in endless mode.
        state.won = true;
        events |= EVENT_VICTORY | offerDraft() | EVENT_WAVE_CLEAR;
      } else {
        events |= offerDraft() | EVENT_WAVE_CLEAR;
      }
    }

    return events;
  }

  reset();

  return { state, step, reset, applyUpgrade, startWave };
}
