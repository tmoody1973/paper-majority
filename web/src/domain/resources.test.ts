import { describe, expect, it } from 'vitest';

import { OPENING_RESOURCES } from '@/domain/initialState';
import { applyResourceDelta } from '@/domain/resources';

describe('applyResourceDelta', () => {
  it('reports the gain actually applied at the capital cap', () => {
    const before = { ...OPENING_RESOURCES, politicalCapital: 8 };
    const result = applyResourceDelta(before, { politicalCapital: 3 });

    expect(result.resources.politicalCapital).toBe(9);
    expect(result.applied.politicalCapital).toBe(1);
  });

  it('clamps counters to 0–9 and meters to 0–100 without mutating the input', () => {
    const before = { ...OPENING_RESOURCES };
    const result = applyResourceDelta(before, {
      staffAttention: -20,
      politicalCapital: 20,
      districtTrust: -80,
      billMomentum: 200,
      policyIntegrity: -100,
      staffMorale: 100,
    });

    expect(result.resources).toEqual({
      staffAttention: 0,
      politicalCapital: 9,
      districtTrust: 0,
      billMomentum: 100,
      policyIntegrity: 0,
      staffMorale: 100,
    });
    expect(result.applied).toEqual({
      staffAttention: -3,
      politicalCapital: 6,
      districtTrust: -60,
      billMomentum: 90,
      policyIntegrity: -60,
      staffMorale: 30,
    });
    expect(before).toEqual(OPENING_RESOURCES);
  });
});
