// A small seeded random generator (mulberry32) so a screenshot seed always
// stages the same scene, and live play can shuffle freely.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return {
    /** Next float in [0, 1). */
    next() {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    /** One of the array's items. */
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    },
    /** Angle in radians. */
    angle() {
      return this.next() * Math.PI * 2;
    },
  };
}
