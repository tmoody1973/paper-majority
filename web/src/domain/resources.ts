import type { Resources } from '@/domain/types';

const RESOURCE_LIMITS: Record<keyof Resources, readonly [minimum: number, maximum: number]> = {
  staffAttention: [0, 9],
  politicalCapital: [0, 9],
  districtTrust: [0, 100],
  billMomentum: [0, 100],
  policyIntegrity: [0, 100],
  staffMorale: [0, 100],
};

export function applyResourceDelta(
  resources: Resources,
  requested: Partial<Resources>,
): { resources: Resources; applied: Partial<Resources> } {
  const next = { ...resources };
  const applied: Partial<Resources> = {};

  for (const [key, amount] of Object.entries(requested) as [keyof Resources, number][]) {
    const [minimum, maximum] = RESOURCE_LIMITS[key];
    next[key] = Math.min(maximum, Math.max(minimum, next[key] + amount));
    applied[key] = next[key] - resources[key];
  }

  return { resources: next, applied };
}
