import { describe, expect, it } from 'vitest';

import { createInitialState, type InitialStateInput } from '@/domain/initialState';
import { testScenario } from '@/test/fixtures/scenario';

const baseInput: InitialStateInput = {
  scenario: testScenario,
  seed: 412,
  districtId: 'GA-05',
  party: 'democratic',
  values: ['Tenant Stability', 'Fair Access'],
};

describe('createInitialState', () => {
  it('is deterministic for the same input', () => {
    const first = createInitialState(baseInput);
    const second = createInitialState(baseInput);

    expect(first).toEqual(second);
  });

  it('starts a paused Week 1 term with the approved opening resources', () => {
    const state = createInitialState(baseInput);

    expect(state.schemaVersion).toBe(1);
    expect(state.snapshotId).toBe(testScenario.snapshotId);
    expect(state.seed).toBe(412);
    expect(state.week).toBe(1);
    expect(state.elapsedMs).toBe(0);
    expect(state.paused).toBe(true);
    expect(state.resources).toEqual({
      staffAttention: 3,
      politicalCapital: 3,
      districtTrust: 60,
      billMomentum: 10,
      policyIntegrity: 60,
      staffMorale: 70,
    });
  });

  it('records the player profile selections', () => {
    const state = createInitialState(baseInput);

    expect(state.player.districtId).toBe('GA-05');
    expect(state.player.party).toBe('democratic');
    expect(state.player.values).toEqual(['Tenant Stability', 'Fair Access']);
  });

  it('deals the three starting definitions, one stack per card', () => {
    const state = createInitialState(baseInput);

    expect(state.cards).toHaveLength(3);
    expect(state.cards.map((card) => card.definitionId)).toEqual([
      ...testScenario.startingCardDefinitionIds,
    ]);
    expect(state.stacks).toHaveLength(3);
    for (const card of state.cards) {
      const owning = state.stacks.filter((stack) => stack.cardIds.includes(card.id));
      expect(owning).toHaveLength(1);
      expect(card.stackId).toBe(owning[0].id);
      expect(owning[0].cardIds).toEqual([card.id]);
    }
  });

  it('starts with no discoveries, no expansions and no election effects', () => {
    const state = createInitialState(baseInput);

    expect(state.discoveredPatternIds).toEqual([]);
    expect(state.unlockedSlotExpansions).toEqual({});
    expect(state.electionEffects).toEqual([]);
    expect(state.storyHistory).toEqual([]);
    expect(state.eventLog).toEqual([]);
  });

  it('draws the opponent once from the seeded stream and reveals it in Week 1', () => {
    const first = createInitialState(baseInput);
    const second = createInitialState(baseInput);

    expect(first.player.election.opponentStrength).toBe(second.player.election.opponentStrength);
    expect(['weak', 'moderate', 'strong']).toContain(first.player.election.opponentStrength);
    expect(first.player.election.revealedWeek).toBe(1);
    expect(first.rngCursor).toBe(1);
  });

  it('lets a different seed change the revealed opponent across the seed space', () => {
    const drawn = new Set(
      Array.from({ length: 60 }, (_, index) =>
        createInitialState({ ...baseInput, seed: index + 1 }).player.election.opponentStrength),
    );

    expect(drawn.size).toBeGreaterThan(1);
  });

  it('applies the standard run settings and week length by default', () => {
    const state = createInitialState(baseInput);

    expect(state.settings.pace).toBe('standard');
    expect(state.settings.guidance).toBe('standard');
    expect(state.settings.locale).toBe('en');
    expect(state.settings.reducedMotion).toBe(false);
    expect(state.weekLengthMs).toBe(105_000);
  });

  it('honours an overridden pace', () => {
    const state = createInitialState({ ...baseInput, settings: { pace: 'relaxed' } });

    expect(state.settings.pace).toBe('relaxed');
    expect(state.weekLengthMs).toBe(150_000);
  });

  it('rejects an unknown district', () => {
    expect(() => createInitialState({ ...baseInput, districtId: 'ZZ-99' })).toThrow(/district/i);
  });

  it('rejects duplicate governing values', () => {
    expect(() =>
      createInitialState({ ...baseInput, values: ['Fair Access', 'Fair Access'] }),
    ).toThrow(/value/i);
  });

  it('never reads a demographic field when drawing the opponent', () => {
    const districtA = createInitialState({ ...baseInput, districtId: 'GA-05' });
    const districtB = createInitialState({ ...baseInput, districtId: 'IA-04' });

    expect(districtB.player.election.opponentStrength).toBe(
      districtA.player.election.opponentStrength,
    );
  });
});
