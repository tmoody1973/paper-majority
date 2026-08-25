import { describe, expect, it } from 'vitest';

import { progressFraction } from '@/game/objects/progress';

describe('progressFraction', () => {
  it('starts empty and ends full', () => {
    expect(progressFraction(6000, 6000)).toBe(0);
    expect(progressFraction(0, 6000)).toBe(1);
  });

  it('reports the share of the work already done', () => {
    expect(progressFraction(4000, 6000)).toBeCloseTo(1 / 3, 5);
    expect(progressFraction(3000, 6000)).toBeCloseTo(0.5, 5);
    expect(progressFraction(2000, 6000)).toBeCloseTo(2 / 3, 5);
  });

  it('never runs past either end', () => {
    expect(progressFraction(-500, 6000)).toBe(1);
    expect(progressFraction(9000, 6000)).toBe(0);
  });

  it('is safe before a total is known', () => {
    expect(progressFraction(6000, 0)).toBe(0);
  });
});
