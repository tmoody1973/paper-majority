import { describe, expect, it } from 'vitest';

import { parseScenario, upgradeLegacyScenario } from '@/content/schema';
import spike from '@/content/fixtures/interaction-spike.json';
import { computeEffectiveTags } from '@/domain/recipes';
import { sessionScenario } from '@/test/fixtures/session';

const copy = () => structuredClone(sessionScenario) as unknown as Record<string, unknown>;

describe('parseScenario', () => {
  it('parses the strict canonical Session fixture', () => {
    expect(parseScenario(sessionScenario)).toEqual(sessionScenario);
  });

  it('rejects unknown fields and effect variants', () => {
    expect(() => parseScenario({ ...copy(), mystery: true })).toThrow();
    const withEffect = copy();
    (withEffect.tacticExpansions as Array<Record<string, unknown>>)[0].effect = {
      kind: 'output-strength',
      delta: 1,
    };
    expect(() => parseScenario(withEffect)).toThrow();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'rejects invalid pattern costs (%s)',
    (staffAttention) => {
      const invalid = copy();
      (invalid.patterns as Array<Record<string, unknown>>)[0].resourceCost = { staffAttention };
      expect(() => parseScenario(invalid)).toThrow();
    },
  );

  it('rejects malformed and duplicate definition IDs', () => {
    const malformed = copy();
    (malformed.cards as Array<Record<string, unknown>>)[0].id = 'Not Valid';
    expect(() => parseScenario(malformed)).toThrow();

    const duplicatePolicy = copy();
    const cards = duplicatePolicy.cards as Array<Record<string, unknown>>;
    cards[5].id = cards[4].id;
    expect(() => parseScenario(duplicatePolicy)).toThrow(/duplicate/i);
  });

  it('rejects invalid deadline positions and unknown source classes', () => {
    const deadline = copy();
    const obligations = deadline.obligationDefinitions as Array<Record<string, unknown>>;
    obligations[0].due = { week: 0, offsetMs: -1 };
    expect(() => parseScenario(deadline)).toThrow();

    const afterBriskBoundary = copy();
    const laterObligations = afterBriskBoundary.obligationDefinitions as Array<Record<string, unknown>>;
    laterObligations[0].due = { week: 1, offsetMs: 75_001 };
    expect(() => parseScenario(afterBriskBoundary)).toThrow();

    const sourceClass = copy();
    (sourceClass.cards as Array<Record<string, unknown>>)[0].sourceClass = 'rumor';
    expect(() => parseScenario(sourceClass)).toThrow();
  });

  it('rejects authored computed tags and unknown tags or references', () => {
    const computed = copy();
    (computed.cards as Array<Record<string, unknown>>)[0].tags = ['same-party'];
    expect(() => parseScenario(computed)).toThrow();

    const tag = copy();
    (tag.patterns as Array<Record<string, unknown>>)[0].slots = [
      { kind: 'staff', requiredTags: ['missing-tag'], quantity: 1 },
      { kind: 'evidence', quantity: 1 },
    ];
    expect(() => parseScenario(tag)).toThrow();

    const reference = copy();
    reference.startingCardDefinitionIds = ['missing-card'];
    expect(() => parseScenario(reference)).toThrow();
  });

  it('requires simulated fixture offices to use the simulated source class', () => {
    const invalid = copy();
    const office = (invalid.cards as Array<Record<string, unknown>>).find(
      (card) => card.id === 'coalition-office-hillcrest',
    );
    if (!office) throw new Error('missing fixture office');
    office.sourceClass = 'derived';
    office.citations = [
      {
        title: 'A record cannot verify a fictional office',
        url: 'https://example.com/record',
        retrievedAt: '2026-09-04',
      },
    ];

    expect(() => parseScenario(invalid)).toThrow(/simulated/i);
  });

  it('requires an authored concern to name an existing demand and its exact recipient office', () => {
    const unknownConcern = copy();
    const concernCard = (unknownConcern.cards as Array<Record<string, unknown>>).find(
      (card) => card.id === 'constituency-renter-concern',
    );
    if (!concernCard) throw new Error('missing fixture concern');
    concernCard.authoredConcern = {
      concernId: 'demand-missing',
      recipientOfficeDefinitionId: 'coalition-office-hillcrest',
    };
    expect(() => parseScenario(unknownConcern)).toThrow(/unknown authored concern/i);

    const wrongRecipient = copy();
    const wrongCard = (wrongRecipient.cards as Array<Record<string, unknown>>).find(
      (card) => card.id === 'constituency-renter-concern',
    );
    if (!wrongCard) throw new Error('missing fixture concern');
    wrongCard.authoredConcern = {
      concernId: 'demand-renter-protection',
      recipientOfficeDefinitionId: 'coalition-office-ridgeline',
    };
    expect(() => parseScenario(wrongRecipient)).toThrow(/recipient must match/i);
  });

  it('keeps decision bill, promise, and work effects inside bounded references', () => {
    const unknownProvision = copy();
    const choices = unknownProvision.decisionChoices as Array<Record<string, unknown>>;
    choices[0].effects = [{ kind: 'bill-add-provision', provisionId: 'policy-missing' }];
    expect(() => parseScenario(unknownProvision)).toThrow(/unknown decision provision/i);

    const unknownWork = copy();
    (unknownWork.decisionChoices as Array<Record<string, unknown>>)[0].requiredWorkPatternId = 'pattern-missing';
    expect(() => parseScenario(unknownWork)).toThrow(/unknown decision work pattern/i);

    const derivedIntegrity = copy();
    (derivedIntegrity.decisionChoices as Array<Record<string, unknown>>)[0].effects = [
      { kind: 'resource', resource: 'policyIntegrity', delta: 10 },
    ];
    expect(() => parseScenario(derivedIntegrity)).toThrow(/derived from bill provisions/i);
  });

  it('rejects patterns outside the two-to-four input boundary', () => {
    const invalid = copy();
    (invalid.patterns as Array<Record<string, unknown>>)[0].slots = [
      { kind: 'staff', quantity: 1 },
    ];
    expect(() => parseScenario(invalid)).toThrow();
  });

  it('upgrades the legacy spike explicitly and preserves its exact pack lists', () => {
    const legacyWithPack = {
      ...spike.scenario,
      weeklyPacks: [{ week: 2, cardDefinitionIds: ['evidence-rent-burden-report'] }],
    };
    const upgraded = upgradeLegacyScenario(legacyWithPack);
    expect(upgraded.schemaVersion).toBe(2);
    expect(upgraded.supportedModes).toEqual(['interaction-spike']);
    expect(upgraded.startingCardDefinitionIds).toEqual(spike.scenario.startingCardDefinitionIds);
    expect(upgraded.weeklyPacks).toEqual(
      legacyWithPack.weeklyPacks.map((pack) => ({
        week: pack.week,
        guaranteedDefinitionIds: pack.cardDefinitionIds,
        pools: [],
      })),
    );
    const resultCard = upgraded.cards.find((card) => card.id === 'coalition-outreach-result');
    if (!resultCard) throw new Error('missing legacy output card');
    expect(computeEffectiveTags(resultCard, 'democratic')).not.toContain('same-party');
  });

  it('rejects a non-simulated legacy coalition card instead of inventing verified facts', () => {
    const legacy = structuredClone(spike.scenario);
    const office = legacy.cards.find((card) => card.id === 'coalition-office-hillcrest');
    if (!office) throw new Error('missing legacy office');
    office.sourceClass = 'official';

    expect(() => upgradeLegacyScenario(legacy)).toThrow(/legacy coalition/i);
  });
});
