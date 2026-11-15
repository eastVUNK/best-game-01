// NOVA DRIFT — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Seconds the player must survive a wave's spawn queue before the wave is cleared. */
export const WAVE = {
  /** Base enemies in wave 1; each later wave adds this many, up to the cap. */
  baseCount: 6,
  perWave: 3,
  maxCount: 34,
  /** Seconds between spawn ticks; shrinks slightly as waves climb. */
  spawnInterval: 0.9,
  spawnIntervalMin: 0.35,
  /** Boss waves. */
  bossEvery: 5,
  /** Clearing this wave wins the run; play then continues in endless mode. */
  winWave: 10,
};

export const PLAYER = {
  radius: 14,
  speed: 330,
  accel: 2600,
  friction: 4.2,
  hull: 100,
  /** Seconds of invulnerability after a hit. */
  hurtInvuln: 1.2,
  /** Dash: burst speed, cooldown, and the invulnerability it grants. */
  dashSpeed: 780,
  dashTime: 0.16,
  dashCooldown: 2.2,
  dashInvuln: 0.28,
  /** Fire. */
  fireInterval: 0.16,
  bulletSpeed: 720,
  bulletRadius: 5,
  bulletDamage: 12,
  bulletRange: 560,
  /** Thruster particles while moving. */
  thrustRate: 0.03,
};

/** Enemy kinds. Health and speed scale a little with the wave (see world.js). */
export const ENEMY = {
  chaser: { radius: 15, speed: 150, hull: 24, score: 50, shards: 2, color: '#ff5d73', shape: 'tri' },
  weaver: { radius: 14, speed: 190, hull: 18, score: 60, shards: 2, color: '#c77dff', shape: 'diamond' },
  gunner: { radius: 16, speed: 110, hull: 30, score: 80, shards: 3, color: '#ffb703', shape: 'square' },
  splitter: { radius: 20, speed: 105, hull: 44, score: 100, shards: 4, color: '#4cc9f0', shape: 'hex' },
  mite: { radius: 9, speed: 230, hull: 8, score: 20, shards: 1, color: '#80ed99', shape: 'tri' },
  boss: { radius: 58, speed: 62, hull: 900, score: 1500, shards: 24, color: '#ff2e63', shape: 'hex' },
};

/** Enemy bullets. */
export const ORB = { radius: 7, speed: 230, damage: 10 };

/** Pickups dropped by enemies. */
export const PICKUP = {
  shard: { radius: 8, value: 25, magnet: 260, life: 9 },
  heart: { radius: 11, heal: 25, magnet: 220, life: 10 },
  overdrive: { radius: 12, seconds: 6, magnet: 220, life: 10 },
};

/** Combo: kills inside this window raise the multiplier; it decays after. */
export const COMBO = { window: 3.0, step: 0.25, max: 4 };

/** Upgrade draft offered after every cleared wave (pick 1 of 3). */
export const UPGRADES = [
  { id: 'rapid', name: 'Rapid Cycler', desc: '+22% fire rate', apply: (s) => { s.fireInterval *= 0.82; } },
  { id: 'multi', name: 'Twin Barrels', desc: '+1 bullet per shot', apply: (s) => { s.bullets += 1; } },
  { id: 'heavy', name: 'Heavy Rounds', desc: '+35% bullet damage', apply: (s) => { s.bulletDamage *= 1.35; } },
  { id: 'swift', name: 'Ion Thrusters', desc: '+14% move speed', apply: (s) => { s.speed *= 1.14; } },
  { id: 'dash', name: 'Blink Capacitor', desc: '-30% dash cooldown', apply: (s) => { s.dashCooldown *= 0.7; } },
  { id: 'magnet', name: 'Tractor Web', desc: '+70% pickup magnet', apply: (s) => { s.magnet *= 1.7; } },
  { id: 'hull', name: 'Ablative Plating', desc: '+30 max hull, repair 30', apply: (s) => { s.maxHull += 30; s.hull = Math.min(s.maxHull, s.hull + 30); } },
  { id: 'overdrive', name: 'Overdrive Core', desc: 'Kills charge overdrive faster', apply: (s) => { s.overdriveGain *= 1.6; } },
];

/** Particle / juice budgets. */
export const FX = {
  maxParticles: 420,
  maxFloaters: 24,
  shakeDecay: 26,
  shakeMax: 14,
};

/** Starfield layers: count, speed factor, size range. */
export const STARS = [
  { count: 90, speed: 12, size: [1, 2], alpha: 0.5 },
  { count: 55, speed: 28, size: [1.5, 2.5], alpha: 0.75 },
  { count: 26, speed: 55, size: [2, 3.5], alpha: 1 },
];

export const PALETTE = {
  backdrop: '#05060f',
  deep: '#0a0d24',
  nebulaA: 'rgba(88, 28, 135, 0.55)',
  nebulaB: 'rgba(8, 145, 178, 0.42)',
  nebulaC: 'rgba(190, 24, 93, 0.30)',
  player: '#7df9ff',
  playerCore: '#e8feff',
  bullet: '#a5f3fc',
  grid: 'rgba(125, 249, 255, 0.05)',
  panel: 'rgba(10, 14, 36, 0.88)',
  panelEdge: 'rgba(125, 249, 255, 0.35)',
  text: '#eef6ff',
  muted: '#8b9bb8',
  gold: '#ffd166',
  danger: '#ff5d73',
  ok: '#80ed99',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nova-drift.best';
