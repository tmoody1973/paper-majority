import { describe, expect, it } from 'vitest';

import { createRng, drawOpponentStrength } from '@/domain/rng';

function take(next: () => number, count: number): number[] {
  return Array.from({ length: count }, () => next());
}

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const first = take(createRng(412), 10);
    const second = take(createRng(412), 10);

    expect(first).toEqual(second);
  });

  it('produces a different sequence for a different seed', () => {
    const first = take(createRng(412), 10);
    const other = take(createRng(413), 10);

    expect(other).not.toEqual(first);
  });

  it('stays inside the unit interval', () => {
    for (const value of take(createRng(412), 100)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('drawOpponentStrength', () => {
  it('uses the approved 25/50/25 thresholds', () => {
    expect(drawOpponentStrength(0)).toBe('weak');
    expect(drawOpponentStrength(0.2499)).toBe('weak');
    expect(drawOpponentStrength(0.25)).toBe('moderate');
    expect(drawOpponentStrength(0.7499)).toBe('moderate');
    expect(drawOpponentStrength(0.75)).toBe('strong');
    expect(drawOpponentStrength(0.9999)).toBe('strong');
  });
});
