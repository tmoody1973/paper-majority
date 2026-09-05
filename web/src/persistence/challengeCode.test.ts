import { describe, expect, it } from 'vitest';

import { getCandidateScenario } from '@/content/loadScenario';
import { executeCommand } from '@/domain/engine';
import { DEFAULT_RUN_SETTINGS } from '@/domain/initialState';
import { createRun } from '@/domain/runSetup';
import type { ChallengeSetup } from '@/persistence/challengeCode';
import {
  createChallengeSetup,
  decodeChallenge,
  encodeChallenge,
  MAX_CHALLENGE_CODE_LENGTH,
} from '@/persistence/challengeCode';
import { scenarioSnapshotHash } from '@/persistence/saveMigrations';

const scenario = getCandidateScenario();
const setup = createChallengeSetup({
  seed: 20260905,
  districtId: scenario.districts[4]!.id,
  party: 'republican',
  values: ['Fair Access', 'Housing Supply'],
  settings: {
    ...DEFAULT_RUN_SETTINGS,
    pace: 'relaxed',
    guidance: 'expert',
    termStyle: 'district-pulse',
    voteInformation: 'detailed',
    policyComplexity: 'advanced',
    locale: 'es',
    reducedMotion: true,
  },
}, scenario);

function mutate(changes: Partial<ChallengeSetup>): string {
  return encodeURIComponent(JSON.stringify({ ...setup, ...changes }));
}

describe('versioned Session challenge codes', () => {
  it('round trips every setup field and preserves governing-value order', () => {
    const code = encodeChallenge(setup);
    expect(code.length).toBeLessThan(MAX_CHALLENGE_CODE_LENGTH);
    expect(decodeChallenge(code, scenario)).toEqual({ ok: true, setup });
    expect(setup.values).toEqual(['Fair Access', 'Housing Supply']);
    expect(setup.snapshotHash).toBe(scenarioSnapshotHash(scenario));
    expect(setup.snapshotHash).toBe('ff90f497eaf2efc4c4e18877ff360f824f2ffe2391badbb44900d6301f0a13e4');
  });

  it.each([
    ['code version', { schemaVersion: 2 }, /unsupported code version/i],
    ['rules version', { rulesVersion: 99 }, /unsupported rules version/i],
    ['snapshot id', { snapshotId: 'missing-snapshot' }, /not available/i],
    ['snapshot hash', { snapshotHash: '0'.repeat(64) }, /not available/i],
    ['mode', { mode: 'term' }, /six-week Session/i],
  ])('rejects an unsupported %s', (_label, changes, reason) => {
    const code = `paper-majority.challenge.v1:${mutate(changes as Partial<ChallengeSetup>)}`;
    expect(decodeChallenge(code, scenario)).toEqual({ ok: false, reason: expect.stringMatching(reason as RegExp) });
  });

  it('reports an unsupported outer code version clearly', () => {
    expect(decodeChallenge('paper-majority.challenge.v9:%7B%7D', scenario)).toEqual({
      ok: false,
      reason: 'This challenge uses unsupported code version 9.',
    });
  });

  it('strictly rejects invalid settings, districts, values, seeds and extra fields', () => {
    const cases: unknown[] = [
      { ...setup, settings: { ...setup.settings, reducedMotion: 'yes' } },
      { ...setup, districtId: 'XX-99' },
      { ...setup, values: ['Fair Access', 'Fair Access'] },
      { ...setup, seed: -1 },
      { ...setup, proof: 'authenticated-score' },
    ];
    for (const value of cases) {
      const code = `paper-majority.challenge.v1:${encodeURIComponent(JSON.stringify(value))}`;
      expect(decodeChallenge(code, scenario).ok).toBe(false);
    }
  });

  it('bounds pasted text before decoding or parsing', () => {
    const oversized = `paper-majority.challenge.v1:${'%7B'.repeat(MAX_CHALLENGE_CODE_LENGTH)}`;
    expect(decodeChallenge(oversized, scenario)).toEqual({
      ok: false,
      reason: `Challenge codes cannot exceed ${MAX_CHALLENGE_CODE_LENGTH} characters.`,
    });
  });

  it('reproduces the full run and first Story state, including draws and the RNG cursor', () => {
    const decoded = decodeChallenge(encodeChallenge(setup), scenario);
    if (!decoded.ok) throw new Error(decoded.reason);
    const direct = createRun({ scenario, ...setup });
    const imported = createRun({ scenario, ...decoded.setup });
    expect(imported).toEqual(direct);
    expect(imported.cards.map(({ definitionId, staffTraitId }) => ({ definitionId, staffTraitId })))
      .toEqual(direct.cards.map(({ definitionId, staffTraitId }) => ({ definitionId, staffTraitId })));
    expect(imported.runVariation).toEqual(direct.runVariation);
    expect(imported.rngCursor).toBe(direct.rngCursor);

    const openedDirect = executeCommand(direct, { type: 'DRAW_STORY_EVENT' }, { scenario }).state;
    const openedImported = executeCommand(imported, { type: 'DRAW_STORY_EVENT' }, { scenario }).state;
    expect(openedImported).toEqual(openedDirect);
    expect(openedImported.pendingStoryDecisions).toEqual(openedDirect.pendingStoryDecisions);
  });
});
