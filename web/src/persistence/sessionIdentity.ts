import type { ScenarioDefinition } from '@/domain/types';
import { canonicalSha256 } from '@/persistence/canonicalHash';

export const CURRENT_RULES_VERSION = 2 as const;

export interface SessionCompatibilityIdentity {
  mode: 'session';
  rulesVersion: typeof CURRENT_RULES_VERSION;
  snapshotId: string;
  snapshotHash: string;
}

export function scenarioSnapshotHash(scenario: ScenarioDefinition): string {
  return canonicalSha256(scenario);
}

/** One source for the compatibility fields captured by saves, records and challenges. */
export function sessionIdentityForScenario(
  scenario: ScenarioDefinition,
): SessionCompatibilityIdentity {
  return {
    mode: 'session',
    rulesVersion: CURRENT_RULES_VERSION,
    snapshotId: scenario.snapshotId,
    snapshotHash: scenarioSnapshotHash(scenario),
  };
}

export function matchesSessionIdentity(
  identity: SessionCompatibilityIdentity,
  scenario: ScenarioDefinition,
): boolean {
  const expected = sessionIdentityForScenario(scenario);
  return identity.mode === expected.mode
    && identity.rulesVersion === expected.rulesVersion
    && identity.snapshotId === expected.snapshotId
    && identity.snapshotHash === expected.snapshotHash;
}
