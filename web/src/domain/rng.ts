import type { OpponentStrength } from '@/domain/types';

/**
 * Mulberry32.
 *
 * A 32-bit state PRNG chosen because it is short enough to audit by eye, has no
 * dependencies and is exactly reproducible across engines. Determinism is the
 * requirement here, not cryptographic quality — never use this for secrets.
 *
 * Returns a function producing values in `[0, 1)`.
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;

  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * The approved 25 / 50 / 25 opponent weights.
 *
 * Drawn exactly once during setup and revealed in Week 1. Never rerolled, and no
 * demographic field takes part.
 */
export function drawOpponentStrength(roll: number): OpponentStrength {
  if (roll < 0.25) return 'weak';
  if (roll < 0.75) return 'moderate';
  return 'strong';
}
