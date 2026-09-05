import { describe, expect, it } from 'vitest';

import { buildMatchInputs, computeEffectiveTags, matchPattern } from '@/domain/recipes';
import type { MatchInput } from '@/domain/recipes';
import type { CardInstance, Party, RecipePattern } from '@/domain/types';
import { findCardDefinition, testScenario } from '@/test/fixtures/scenario';

const { patterns, tacticExpansions } = testScenario;

function input(definitionId: string, instanceId = `i-${definitionId}`, party: Party = 'democratic'): MatchInput {
  const definition = findCardDefinition(definitionId);
  return {
    instanceId,
    definition,
    effectiveTags: computeEffectiveTags(definition, party),
    effectiveSourceClass: definition.sourceClass,
    form: 'raw',
    provenance: {
      label: 'Test input',
      sourceClass: definition.sourceClass,
      sourceDefinitionIds: definition.kind === 'evidence' ? [definition.id] : [],
      policyDefinitionId: definition.kind === 'policy' ? definition.id : undefined,
      precedentIds: definition.kind === 'policy' ? definition.precedentIds : [],
      citations: definition.citations,
    },
  };
}

function match(definitionIds: string[], activeExpansionIds: string[] = []) {
  const inputs = definitionIds.map((id, index) => input(id, `i-${index}-${id}`));
  return matchPattern(inputs, patterns, activeExpansionIds, tacticExpansions);
}

describe('computeEffectiveTags', () => {
  it('adds same-party for an office that shares the player party', () => {
    const tags = computeEffectiveTags(findCardDefinition('coalition-office-fifth-district'), 'democratic');

    expect(tags).toContain('same-party');
    expect(tags).not.toContain('opposing-party');
  });

  it('adds opposing-party for an office of the other party', () => {
    const tags = computeEffectiveTags(findCardDefinition('coalition-office-fourth-district'), 'democratic');

    expect(tags).toContain('opposing-party');
    expect(tags).not.toContain('same-party');
  });

  it('flips with the player party rather than being stored on the card', () => {
    const office = findCardDefinition('coalition-office-fourth-district');

    expect(computeEffectiveTags(office, 'republican')).toContain('same-party');
    expect(office.tags).not.toContain('same-party');
    expect(office.tags).not.toContain('opposing-party');
  });

  it('leaves cards without an office party untouched', () => {
    const aide = findCardDefinition('staff-policy-aide');

    expect(computeEffectiveTags(aide, 'democratic')).toEqual(aide.tags);
  });
});

describe('buildMatchInputs', () => {
  it('resolves instances against the scenario and the player party', () => {
    const instances: CardInstance[] = [
      {
        id: 'card-9',
        definitionId: 'coalition-office-fourth-district',
        stackId: 'stack-9',
        x: 0,
        y: 0,
        remainingMs: 0,
        status: 'idle',
        form: 'raw',
        location: 'desk',
        sourceDefinitionIds: [],
      },
    ];

    const [built] = buildMatchInputs(instances, testScenario, 'democratic');

    expect(built.instanceId).toBe('card-9');
    expect(built.definition.id).toBe('coalition-office-fourth-district');
    expect(built.effectiveTags).toContain('opposing-party');
  });
});

describe('matchPattern', () => {
  it('accepts two different housing Evidence cards through one pattern', () => {
    const withReport = match(['staff-policy-aide', 'evidence-rent-burden-report']);
    const withSurvey = match(['staff-policy-aide', 'evidence-tenant-survey']);

    expect(withReport?.pattern.id).toBe('pattern-evidence-summary');
    expect(withSurvey?.pattern.id).toBe('pattern-evidence-summary');
  });

  it('names no exact input card ID in any authored pattern', () => {
    const cardIds = new Set(testScenario.cards.map((card) => card.id));
    const authored = JSON.stringify(testScenario.patterns.map((pattern) => pattern.slots));

    for (const cardId of cardIds) {
      expect(authored).not.toContain(cardId);
    }
  });

  it('ignores stack order', () => {
    const forward = match(['staff-policy-aide', 'evidence-rent-burden-report']);
    const reversed = match(['evidence-rent-burden-report', 'staff-policy-aide']);

    expect(reversed?.pattern.id).toBe(forward?.pattern.id);
  });

  it('rejects evidence that lacks the required housing tag', () => {
    const result = match(['staff-policy-aide', 'evidence-transit-ridership-study']);

    // The broad staff-review pattern still applies; the housing pattern must not.
    expect(result?.pattern.id).toBe('pattern-staff-review-note');
  });

  it('lets a family + tag pattern outrank a family-only pattern declared earlier', () => {
    const familyOnlyIndex = patterns.findIndex((p) => p.id === 'pattern-staff-review-note');
    const familyAndTagIndex = patterns.findIndex((p) => p.id === 'pattern-evidence-summary');
    expect(familyOnlyIndex).toBeLessThan(familyAndTagIndex);

    const result = match(['staff-policy-aide', 'evidence-rent-burden-report']);

    expect(result?.pattern.id).toBe('pattern-evidence-summary');
  });

  it('does not raise specificity when an anyTags list gains an alternative', () => {
    const narrow: RecipePattern = {
      ...patterns[3],
      id: 'p-narrow',
      slots: [
        { kind: 'policy', requiredTags: ['working-bill'], quantity: 1 },
        { kind: 'coalition', anyTags: ['same-party'], quantity: 1 },
      ],
    };
    const widened: RecipePattern = {
      ...narrow,
      id: 'p-widened',
      slots: [
        { kind: 'policy', requiredTags: ['working-bill'], quantity: 1 },
        { kind: 'coalition', anyTags: ['same-party', 'opposing-party', 'caucus'], quantity: 1 },
      ],
    };

    const inputs = [input('policy-working-bill', 'a'), input('coalition-office-fifth-district', 'b')];
    const narrowMatch = matchPattern(inputs, [narrow], [], tacticExpansions);
    const widenedMatch = matchPattern(inputs, [widened], [], tacticExpansions);

    // Both must actually match, or this compares undefined to undefined and proves
    // nothing.
    expect(narrowMatch).toBeDefined();
    expect(widenedMatch).toBeDefined();
    expect(widenedMatch?.specificity).toBe(narrowMatch?.specificity);
  });

  it('is stable across repeated calls', () => {
    const first = match(['staff-policy-aide', 'evidence-rent-burden-report']);
    const second = match(['staff-policy-aide', 'evidence-rent-burden-report']);

    expect(second?.pattern.id).toBe(first?.pattern.id);
    expect(second?.assignments).toEqual(first?.assignments);
  });

  it('requires every input to be consumed by a slot', () => {
    const result = match([
      'staff-policy-aide',
      'evidence-rent-burden-report',
      'evidence-tenant-survey',
    ]);

    expect(result).toBeUndefined();
  });

  it('respects slot quantity', () => {
    const twoEvidence: RecipePattern = {
      id: 'p-two-evidence',
      slots: [
        { kind: 'staff', quantity: 1 },
        { kind: 'evidence', requiredTags: ['housing'], quantity: 2 },
      ],
      output: { mode: 'fixed', definitionId: 'evidence-staff-review-note' },
      durationMs: 1_000,
      resourceCost: {},
      priority: 0,
      discoveryHint: 'Two reports at once.',
    };

    const both = matchPattern(
      [
        input('staff-policy-aide', 'a'),
        input('evidence-rent-burden-report', 'b'),
        input('evidence-tenant-survey', 'c'),
      ],
      [twoEvidence],
      [],
      tacticExpansions,
    );
    const onlyOne = matchPattern(
      [input('staff-policy-aide', 'a'), input('evidence-rent-burden-report', 'b')],
      [twoEvidence],
      [],
      tacticExpansions,
    );

    expect(both?.pattern.id).toBe('p-two-evidence');
    expect(both?.assignments.find((a) => a.slotIndex === 1)?.cardDefinitionIds).toHaveLength(2);
    expect(onlyOne).toBeUndefined();
  });

  it('rejects an opposing-party office before the Tactic and accepts it after', () => {
    const stack = ['policy-working-bill', 'coalition-office-fourth-district'];

    expect(match(stack)).toBeUndefined();
    expect(match(stack, ['expansion-bipartisan-outreach'])?.pattern.id).toBe(
      'pattern-coalition-outreach',
    );
  });

  it('keeps the same-party base rule working after the expansion', () => {
    const stack = ['policy-working-bill', 'coalition-office-fifth-district'];

    expect(match(stack)?.pattern.id).toBe('pattern-coalition-outreach');
    expect(match(stack, ['expansion-bipartisan-outreach'])?.pattern.id).toBe(
      'pattern-coalition-outreach',
    );
  });

  it('reports the active expansion ids that applied to the winning pattern', () => {
    const result = match(
      ['policy-working-bill', 'coalition-office-fourth-district'],
      ['expansion-bipartisan-outreach'],
    );

    expect(result?.activeExpansionIds).toEqual(['expansion-bipartisan-outreach']);
  });

  it('returns undefined for a stack that matches nothing', () => {
    expect(match(['policy-housing-choice-voucher', 'coalition-office-fifth-district'])).toBeUndefined();
  });

  it('returns undefined for fewer than two inputs', () => {
    expect(match(['staff-policy-aide'])).toBeUndefined();
  });
});
