import type {
  GoverningValue,
  Party,
  RunSettings,
  ScenarioDefinition,
  SessionRecord,
} from '@/domain/types';
import { canonicalJson } from '@/persistence/canonicalHash';
import {
  CURRENT_RULES_VERSION,
  isValidRunSettings,
  scenarioSnapshotHash,
} from '@/persistence/saveMigrations';

export const CHALLENGE_SCHEMA_VERSION = 1 as const;
export const MAX_CHALLENGE_CODE_LENGTH = 8_192;
const CHALLENGE_PREFIX = 'paper-majority.challenge.v1:';
const MAX_SEED = 0xffff_ffff;

const GOVERNING_VALUES = new Set<GoverningValue>([
  'Fiscal Stewardship', 'Local Control', 'Market Competition', 'Public Investment',
  'Tenant Stability', 'Housing Supply', 'Environmental Resilience', 'Fair Access',
]);

export interface ChallengeSetup {
  schemaVersion: typeof CHALLENGE_SCHEMA_VERSION;
  rulesVersion: typeof CURRENT_RULES_VERSION;
  snapshotId: string;
  snapshotHash: string;
  mode: 'session';
  seed: number;
  districtId: string;
  party: Party;
  values: [GoverningValue, GoverningValue];
  settings: RunSettings;
}

export type ChallengeDecodeResult =
  | { ok: true; setup: ChallengeSetup }
  | { ok: false; reason: string };

type SetupInput = Pick<ChallengeSetup, 'seed' | 'districtId' | 'party' | 'values' | 'settings'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validSeed(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SEED;
}

function validValues(value: unknown): value is [GoverningValue, GoverningValue] {
  return Array.isArray(value)
    && value.length === 2
    && GOVERNING_VALUES.has(value[0] as GoverningValue)
    && GOVERNING_VALUES.has(value[1] as GoverningValue)
    && value[0] !== value[1];
}

function validateSetup(value: unknown, scenario?: ScenarioDefinition): ChallengeDecodeResult {
  if (!isRecord(value) || !hasExactKeys(value, [
    'schemaVersion', 'rulesVersion', 'snapshotId', 'snapshotHash', 'mode',
    'seed', 'districtId', 'party', 'values', 'settings',
  ])) {
    return { ok: false, reason: 'This challenge has an invalid document shape.' };
  }
  if (value.schemaVersion !== CHALLENGE_SCHEMA_VERSION) {
    return { ok: false, reason: `This challenge uses unsupported code version ${String(value.schemaVersion)}.` };
  }
  if (value.rulesVersion !== CURRENT_RULES_VERSION) {
    return { ok: false, reason: `This challenge uses unsupported rules version ${String(value.rulesVersion)}.` };
  }
  if (value.mode !== 'session') {
    return { ok: false, reason: 'This challenge is not a six-week Session setup.' };
  }
  if (!validSeed(value.seed)) {
    return { ok: false, reason: `The challenge seed must be a whole number from 0 to ${MAX_SEED}.` };
  }
  if (value.party !== 'democratic' && value.party !== 'republican') {
    return { ok: false, reason: 'The challenge party is not supported.' };
  }
  if (!validValues(value.values)) {
    return { ok: false, reason: 'The challenge must contain exactly two distinct supported governing values.' };
  }
  if (!isValidRunSettings(value.settings)) {
    return { ok: false, reason: 'The challenge gameplay settings are incomplete or invalid.' };
  }
  if (typeof value.snapshotId !== 'string' || typeof value.snapshotHash !== 'string'
    || typeof value.districtId !== 'string') {
    return { ok: false, reason: 'The challenge snapshot or district is invalid.' };
  }
  if (scenario) {
    if (value.snapshotId !== scenario.snapshotId || value.snapshotHash !== scenarioSnapshotHash(scenario)) {
      return { ok: false, reason: 'This challenge uses a content snapshot that is not available in this build.' };
    }
    if (!scenario.supportedModes.includes('session')) {
      return { ok: false, reason: 'This build does not support six-week Session challenges.' };
    }
    if (!scenario.districts.some((district) => district.id === value.districtId)) {
      return { ok: false, reason: `The challenge district "${value.districtId}" is not available in this snapshot.` };
    }
  }
  return { ok: true, setup: structuredClone(value) as unknown as ChallengeSetup };
}

export function createChallengeSetup(input: SetupInput, scenario: ScenarioDefinition): ChallengeSetup {
  const candidate: ChallengeSetup = {
    schemaVersion: CHALLENGE_SCHEMA_VERSION,
    rulesVersion: CURRENT_RULES_VERSION,
    snapshotId: scenario.snapshotId,
    snapshotHash: scenarioSnapshotHash(scenario),
    mode: 'session',
    seed: input.seed,
    districtId: input.districtId,
    party: input.party,
    values: [input.values[0], input.values[1]],
    settings: { ...input.settings },
  };
  const validated = validateSetup(candidate, scenario);
  if (!validated.ok) throw new TypeError(validated.reason);
  return validated.setup;
}

export function challengeSetupFromRecord(
  record: SessionRecord,
  scenario: ScenarioDefinition,
): ChallengeSetup {
  if (record.setup.snapshotId !== scenario.snapshotId) {
    throw new TypeError('The finished record belongs to a content snapshot that is not available in this build.');
  }
  return createChallengeSetup({
    seed: record.setup.seed,
    districtId: record.setup.districtId,
    party: record.setup.party,
    values: [record.setup.values[0], record.setup.values[1]],
    settings: { ...record.setup.settings },
  }, scenario);
}

export function encodeChallenge(setup: ChallengeSetup): string {
  const validated = validateSetup(setup);
  if (!validated.ok) throw new TypeError(validated.reason);
  const code = `${CHALLENGE_PREFIX}${encodeURIComponent(canonicalJson(validated.setup))}`;
  if (code.length > MAX_CHALLENGE_CODE_LENGTH) {
    throw new RangeError(`Challenge codes cannot exceed ${MAX_CHALLENGE_CODE_LENGTH} characters.`);
  }
  return code;
}

export function decodeChallenge(code: string, scenario: ScenarioDefinition): ChallengeDecodeResult {
  if (typeof code !== 'string') return { ok: false, reason: 'The challenge code must be text.' };
  if (code.length > MAX_CHALLENGE_CODE_LENGTH) {
    return { ok: false, reason: `Challenge codes cannot exceed ${MAX_CHALLENGE_CODE_LENGTH} characters.` };
  }
  const normalized = code.trim();
  if (!normalized.startsWith(CHALLENGE_PREFIX)) {
    const versionPrefix = /^paper-majority\.challenge\.v([^:]+):/.exec(normalized);
    if (versionPrefix) {
      return { ok: false, reason: `This challenge uses unsupported code version ${versionPrefix[1]}.` };
    }
    return { ok: false, reason: 'This is not a Paper Majority challenge code.' };
  }
  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(normalized.slice(CHALLENGE_PREFIX.length))) as unknown;
  } catch {
    return { ok: false, reason: 'This challenge code could not be read.' };
  }
  return validateSetup(value, scenario);
}
