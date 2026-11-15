// NOVA DRIFT — every pixel: the nebula backdrop, the starfield, the ships,
// the particles, the HUD and all six screens. Canvas 2D only, no assets.

import { FIELD, FONT, FONT_DISPLAY, PALETTE, STARS } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_DRAFT = 'draft';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const TAU = Math.PI * 2;

function poly(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (i / sides) * TAU;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function glowCircle(ctx, x, y, radius, color, blur) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const rng = createRandom(1337);

  // Star layers, fixed once: each star has a field position and a parallax factor.
  const stars = STARS.map((layer) => {
    const list = [];
    for (let i = 0; i < layer.count; i += 1) {
      list.push({
        x: rng.range(0, FIELD.width),
        y: rng.range(0, FIELD.height),
        r: rng.range(layer.size[0], layer.size[1]),
        a: rng.range(0.4, 1) * layer.alpha,
        tw: rng.range(0, TAU),
      });
    }
    return { layer, list };
  });

  // The nebula is painted once to an offscreen canvas and blitted each frame.
  const nebula = document.createElement('canvas');
  nebula.width = FIELD.width;
  nebula.height = FIELD.height;
  {
    const n = nebula.getContext('2d');
    const blobs = [
      { x: 220, y: 150, r: 340, c: PALETTE.nebulaA },
      { x: 1080, y: 560, r: 380, c: PALETTE.nebulaB },
      { x: 950, y: 120, r: 260, c: PALETTE.nebulaC },
      { x: 350, y: 620, r: 300, c: PALETTE.nebulaB },
    ];
    for (const b of blobs) {
      const g = n.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      n.fillStyle = g;
      n.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || FIELD.width;
    const h = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function drawBackground(state, time) {
    // Deep-space gradient.
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.backdrop);
    g.addColorStop(0.55, PALETTE.deep);
    g.addColorStop(1, '#120a24');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.drawImage(nebula, 0, 0);

    // Parallax starfield: drifts gently opposite the player.
    const px = state.player ? (state.player.x - FIELD.width / 2) * 0.02 : 0;
    const py = state.player ? (state.player.y - FIELD.height / 2) * 0.02 : 0;
    for (const { layer, list } of stars) {
      ctx.fillStyle = '#ffffff';
      for (const s of list) {
        const twinkle = 0.75 + 0.25 * Math.sin(time * 1.6 + s.tw);
        const x = (((s.x - px * layer.speed) % FIELD.width) + FIELD.width) % FIELD.width;
        const y = (((s.y - py * layer.speed) % FIELD.height) + FIELD.height) % FIELD.height;
        ctx.globalAlpha = s.a * twinkle;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Faint hex grid for depth.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 80) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
    }
    ctx.stroke();
  }

  function drawShip(p, time) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // Engine glow when thrusting.
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 60) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.9, speed / 400);
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.moveTo(-p.radius * 0.8, 0);
      ctx.lineTo(-p.radius * 1.7 - Math.random() * 8, 5);
      ctx.lineTo(-p.radius * 1.7 - Math.random() * 8, -5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Hull: a sleek dart.
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#0e7490';
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.radius + 6, 0);
    ctx.lineTo(-p.radius * 0.7, p.radius * 0.75);
    ctx.lineTo(-p.radius * 0.35, 0);
    ctx.lineTo(-p.radius * 0.7, -p.radius * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cockpit.
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(p.radius * 0.25, 0, 4.5, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Invulnerability shimmer.
    if (p.invuln > 0 && Math.floor(time * 12) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    // Dash cooldown ring.
    if (p.dashCooldown > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.dashCooldown / p.dashCooldownMax));
      ctx.stroke();
      ctx.restore();
    }
    // Overdrive aura.
    if (p.overdrive > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 10);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 12, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.flash > 0;
    const color = flash ? '#ffffff' : e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = flash ? 26 : 14;
    ctx.fillStyle = flash ? '#ffffff' : e.color;
    ctx.globalAlpha = 0.92;
    if (e.shape === 'tri') {
      ctx.rotate(e.angle);
      ctx.beginPath();
      ctx.moveTo(e.radius + 2, 0);
      ctx.lineTo(-e.radius * 0.8, e.radius * 0.85);
      ctx.lineTo(-e.radius * 0.4, 0);
      ctx.lineTo(-e.radius * 0.8, -e.radius * 0.85);
      ctx.closePath();
      ctx.fill();
    } else if (e.shape === 'diamond') {
      ctx.rotate(e.angle);
      ctx.beginPath();
      ctx.moveTo(0, -e.radius);
      ctx.lineTo(e.radius * 0.8, 0);
      ctx.lineTo(0, e.radius);
      ctx.lineTo(-e.radius * 0.8, 0);
      ctx.closePath();
      ctx.fill();
    } else if (e.shape === 'square') {
      ctx.rotate(e.angle * 0.5);
      ctx.fillRect(-e.radius * 0.8, -e.radius * 0.8, e.radius * 1.6, e.radius * 1.6);
    } else {
      ctx.rotate(e.angle * 0.3);
      poly(ctx, 0, 0, e.radius, 6, 0);
      ctx.fill();
    }
    // Gunner telegraph: a charging amber ring in the half-second before it
    // fires, so the shot is dodgeable instead of a surprise.
    if (e.kind === 'gunner' && e.fireTimer < 0.5) {
      const charge = 1 - Math.max(0, e.fireTimer) / 0.5;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.3 + 0.6 * charge;
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2 + 2 * charge;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 7 + 5 * charge, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // Core dot + hull ticks for damaged enemies.
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(e.x, e.y, Math.max(2, e.radius * 0.22), 0, TAU);
    ctx.fill();
    if (e.hull < e.maxHull) {
      const w = e.radius * 2;
      const frac = Math.max(0, e.hull / e.maxHull);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 4);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w * frac, 4);
    }
    ctx.restore();
  }

  function drawBullets(state) {
    ctx.save();
    ctx.shadowColor = PALETTE.bullet;
    ctx.shadowBlur = 10;
    for (const b of state.bullets) {
      const a = Math.atan2(b.vy, b.vx);
      ctx.strokeStyle = '#cffafe';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(a) * 12, b.y - Math.sin(a) * 12);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOrbs(state, time) {
    for (const o of state.orbs) {
      const pulse = 1 + 0.18 * Math.sin(time * 8 + o.x);
      glowCircle(ctx, o.x, o.y, o.radius * pulse, '#fb923c', 16);
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius * 0.4, 0, TAU);
      ctx.fill();
    }
  }

  function drawPickups(state, time) {
    for (const pk of state.pickups) {
      const bob = Math.sin(time * 4 + pk.x) * 2;
      const blink = pk.life < 3 ? (Math.floor(time * 6) % 2 === 0 ? 0.35 : 1) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      if (pk.kind === 'shard') {
        ctx.translate(pk.x, pk.y + bob);
        ctx.rotate(time * 2 + pk.x);
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.moveTo(0, -pk.radius);
        ctx.lineTo(pk.radius * 0.7, 0);
        ctx.lineTo(0, pk.radius);
        ctx.lineTo(-pk.radius * 0.7, 0);
        ctx.closePath();
        ctx.fill();
      } else if (pk.kind === 'heart') {
        ctx.translate(pk.x, pk.y + bob);
        ctx.shadowColor = '#f472b6';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(-4, -2, 5.5, 0, TAU);
        ctx.arc(4, -2, 5.5, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-8.5, -1);
        ctx.lineTo(0, 9);
        ctx.lineTo(8.5, -1);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.translate(pk.x, pk.y + bob);
        ctx.rotate(time * 1.5);
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#fbbf24';
        poly(ctx, 0, 0, pk.radius, 5, 0);
        ctx.fill();
        ctx.fillStyle = '#fff7ed';
        ctx.font = `bold 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×2', 0, 0.5);
      }
      ctx.restore();
    }
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (pt.life / pt.maxLife), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters(state) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.font = `bold ${f.size}px ${FONT_DISPLAY}`;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function bar(x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.14)') {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function drawHUD(state, best, muted) {
    const p = state.player;
    ctx.save();
    ctx.textBaseline = 'middle';

    // Top-left: hull + overdrive.
    ctx.textAlign = 'left';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('HULL', 24, 26);
    bar(24, 36, 220, 14, p.hull / p.maxHull, p.hull / p.maxHull > 0.35 ? '#34d399' : '#ef4444');
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(`${Math.ceil(p.hull)} / ${p.maxHull}`, 252, 43);
    if (p.overdrive > 0) {
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`OVERDRIVE ${p.overdrive.toFixed(1)}s`, 24, 66);
    }
    if (p.dashCooldown > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(`DASH ${p.dashCooldown.toFixed(1)}s`, 24, p.overdrive > 0 ? 84 : 66);
    }

    // Top-center: wave.
    ctx.textAlign = 'center';
    ctx.font = `bold 15px ${FONT_DISPLAY}`;
    ctx.fillStyle = PALETTE.text;
    const waveLabel = state.won ? `WAVE ${state.wave} · ENDLESS` : `WAVE ${state.wave} / 10`;
    ctx.fillText(waveLabel, FIELD.width / 2, 26);
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    const left = state.spawnQueue.length + state.enemies.length;
    ctx.fillText(state.boss ? '⚠ HEX CORE ⚠' : `${left} hostiles remain`, FIELD.width / 2, 46);

    // Top-right: score, combo, best.
    ctx.textAlign = 'right';
    ctx.font = `bold 26px ${FONT_DISPLAY}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(state.score.toLocaleString('en-US'), FIELD.width - 24, 34);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, state.score).toLocaleString('en-US')} · ✦ ${state.shards}`, FIELD.width - 24, 58);
    if (state.combo >= 3) {
      ctx.font = `bold 15px ${FONT_DISPLAY}`;
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`COMBO x${state.comboMult.toFixed(2)} (${state.combo})`, FIELD.width - 24, 80);
      bar(FIELD.width - 144, 90, 120, 5, state.comboTimer / 3, '#ffd166');
    }
    if (muted) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `13px ${FONT}`;
      ctx.fillText('MUTED (M)', FIELD.width - 24, 108);
    }

    // Boss bar.
    if (state.boss) {
      const b = state.boss;
      ctx.textAlign = 'center';
      ctx.font = `bold 13px ${FONT_DISPLAY}`;
      ctx.fillStyle = '#ff5d73';
      ctx.fillText('HEX CORE', FIELD.width / 2, 66);
      bar(FIELD.width / 2 - 180, 76, 360, 10, b.hull / b.maxHull, '#ff2e63');
    }
    ctx.restore();
  }

  function panel(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawBanner(state) {
    const b = state.banner;
    if (!b) return;
    const alpha = Math.min(1, b.timer / 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ecfeff';
    ctx.font = `900 54px ${FONT_DISPLAY}`;
    ctx.fillText(b.text, FIELD.width / 2, 150);
    ctx.restore();
  }

  function drawTitle(state, time, best) {
    // Ghost ship orbiting the logo.
    const cx = FIELD.width / 2;
    const cy = 300;
    const orbitR = 190;
    const a = time * 0.35;
    const sx = cx + Math.cos(a) * orbitR;
    const sy = cy + Math.sin(a) * orbitR * 0.42;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.atan2(Math.cos(a) * 0.42, -Math.sin(a)) + Math.PI / 2);
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#0e7490';
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 11);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glow = 22 + 8 * Math.sin(time * 2);
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = glow;
    ctx.fillStyle = '#ecfeff';
    ctx.font = `900 92px ${FONT_DISPLAY}`;
    ctx.fillText('NOVA DRIFT', cx, 168);
    ctx.shadowBlur = 0;
    ctx.font = `20px ${FONT}`;
    ctx.fillStyle = '#a5f3fc';
    ctx.fillText('a neon arena survival shooter', cx, 224);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Blast the swarm. Chain the combo. Survive all 10 waves.', cx, 252);
    if (best > 0) {
      ctx.fillStyle = '#ffd166';
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillText(`BEST ${best.toLocaleString('en-US')}`, cx, 278);
    }

    // Controls card.
    panel(cx - 330, 300, 660, 132);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText('HOW TO FLY', cx, 326);
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('WASD / arrows — move      Mouse — aim      Hold click / Space — fire', cx, 356);
    ctx.fillText('Shift — dash (brief shield)      P — pause      M — mute      R — restart', cx, 382);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('Clear a wave to draft an upgrade. Beat wave 10 to stabilize the nebula.', cx, 408);

    const pulse = 0.65 + 0.35 * Math.sin(time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 22px ${FONT_DISPLAY}`;
    ctx.fillText('PRESS SPACE OR CLICK TO LAUNCH', cx, 500);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawDraft(state, mouse) {
    const draft = state.draft;
    ctx.save();
    ctx.fillStyle = 'rgba(3, 5, 16, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `900 40px ${FONT_DISPLAY}`;
    ctx.fillText(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, 120);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = '#a5f3fc';
    ctx.fillText('Choose one upgrade — press 1, 2 or 3, or click a card', FIELD.width / 2, 162);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Score ${state.score.toLocaleString('en-US')} · Hull ${Math.ceil(state.player.hull)}/${state.player.maxHull}`, FIELD.width / 2, 188);

    const cw = 300;
    const ch = 210;
    const gap = 28;
    const total = cw * 3 + gap * 2;
    const x0 = (FIELD.width - total) / 2;
    const y0 = 250;
    draft.forEach((u, i) => {
      const x = x0 + i * (cw + gap);
      const hover = mouse.inside && mouse.x >= x && mouse.x <= x + cw && mouse.y >= y0 && mouse.y <= y0 + ch;
      ctx.save();
      if (hover) {
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 22;
      }
      panel(x, y0, cw, ch);
      ctx.restore();
      ctx.fillStyle = '#ffd166';
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillText(`[${i + 1}]`, x + cw / 2, y0 + 34);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 21px ${FONT_DISPLAY}`;
      ctx.fillText(u.name, x + cw / 2, y0 + 72);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `15px ${FONT}`;
      const words = u.desc.split(' ');
      let line = '';
      let ly = y0 + 116;
      for (const w of words) {
        if ((line + ' ' + w).trim().length > 26) {
          ctx.fillText(line.trim(), x + cw / 2, ly);
          ly += 22;
          line = w;
        } else {
          line += ' ' + w;
        }
      }
      ctx.fillText(line.trim(), x + cw / 2, ly);
      ctx.restore();
    });
    ctx.restore();
  }

  function drawPaused() {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 5, 16, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `900 52px ${FONT_DISPLAY}`;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 20);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press P or Space to resume · R to restart', FIELD.width / 2, FIELD.height / 2 + 30);
    ctx.restore();
  }

  function drawOver(state, best, won) {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 5, 16, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const title = won ? 'NEBULA STABILIZED' : 'SIGNAL LOST';
    ctx.shadowColor = won ? '#34d399' : '#ff5d73';
    ctx.shadowBlur = 26;
    ctx.fillStyle = won ? '#a7f3d0' : '#fecdd3';
    ctx.font = `900 56px ${FONT_DISPLAY}`;
    ctx.fillText(title, FIELD.width / 2, 210);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 30px ${FONT_DISPLAY}`;
    ctx.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 300);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    const accuracy = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
    ctx.fillText(`Wave ${state.wave} · ${state.kills} kills · ${accuracy}% accuracy · Best ${Math.max(best, state.score).toLocaleString('en-US')}`, FIELD.width / 2, 344);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 20px ${FONT_DISPLAY}`;
    ctx.fillText('PRESS SPACE OR CLICK TO FLY AGAIN', FIELD.width / 2, 420);
    ctx.restore();
  }

  function drawVictory(state) {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 5, 16, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#a7f3d0';
    ctx.font = `900 54px ${FONT_DISPLAY}`;
    ctx.fillText('NEBULA STABILIZED', FIELD.width / 2, 200);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    ctx.fillText('All 10 waves cleared — the Drift holds the line.', FIELD.width / 2, 252);
    ctx.font = `bold 28px ${FONT_DISPLAY}`;
    ctx.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 306);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Endless mode continues — press Space to keep flying', FIELD.width / 2, 350);
    ctx.restore();
  }

  /** Paint one frame. `screen` is one of the SCREEN_* constants. */
  function draw(state, screen, best, mouse = { x: 0, y: 0, inside: false }, muted = false) {
    resize();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // Letterbox centering.
    const ox = (canvas.width / dpr - FIELD.width * (scale / dpr)) / 2 * dpr;
    const oy = (canvas.height / dpr - FIELD.height * (scale / dpr)) / 2 * dpr;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    const time = state.time;
    ctx.save();
    if (state.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawBackground(state, time);
    for (const e of state.enemies) drawEnemy(e);
    drawPickups(state, time);
    drawBullets(state);
    drawOrbs(state, time);
    drawParticles(state);
    if (state.player && screen !== SCREEN_TITLE) drawShip(state.player, time);
    drawFloaters(state);
    ctx.restore();

    if (screen === SCREEN_TITLE) drawTitle(state, time, best);
    else if (screen === SCREEN_DRAFT) {
      drawHUD(state, best, muted);
      drawDraft(state, mouse);
    } else if (screen === SCREEN_PAUSED) {
      drawHUD(state, best, muted);
      drawPaused();
    } else if (screen === SCREEN_OVER) {
      drawOver(state, best, state.won);
    } else if (screen === SCREEN_VICTORY) {
      drawHUD(state, best, muted);
      drawVictory(state);
    } else {
      drawHUD(state, best, muted);
      drawBanner(state);
    }
  }

  return { draw, resize };
}
