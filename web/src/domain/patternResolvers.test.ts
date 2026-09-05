import { describe, expect, it } from 'vitest';

import { DERIVED_RESOLVERS, resolvePatternOutput } from '@/domain/patternResolvers';
import { computeEffectiveTags, matchPattern } from '@/domain/recipes';
import type { MatchInput } from '@/domain/recipes';
import type { DerivedResolverId, Party, RecipePattern } from '@/domain/types';
import { findCardDefinition, testScenario } from '@/test/fixtures/scenario';

const { patterns, tacticExpansions } = testScenario;

const ALL_RESOLVER_IDS: DerivedResolverId[] = [
  'summarize-evidence-v1',
  'draft-provision-v1',
  'answer-office-concern-v1',
  'prepare-evidence-packet-v1',
  'resolve-outreach-v1',
  'strengthen-provision-v1',
];

function input(definitionId: string, instanceId: string, party: Party = 'democratic'): MatchInput {
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

function resolve(definitionIds: string[], activeExpansionIds: string[] = []) {
  const inputs = definitionIds.map((id, index) => input(id, `i-${index}-${id}`));
  const found = matchPattern(inputs, patterns, activeExpansionIds, tacticExpansions);
  if (!found) throw new Error(`No pattern matched ${definitionIds.join(' + ')}`);
  return resolvePatternOutput(found, inputs);
}

describe('DERIVED_RESOLVERS', () => {
  it('covers every allowlisted resolver id and nothing else', () => {
    expect(Object.keys(DERIVED_RESOLVERS).sort()).toEqual([...ALL_RESOLVER_IDS].sort());
  });

  it('holds functions in engine code, never values loaded from content', () => {
    for (const id of ALL_RESOLVER_IDS) {
      expect(typeof DERIVED_RESOLVERS[id]).toBe('function');
    }
  });

  it('is unreachable from scenario JSON, which stores only resolver ids and JSON parameters', () => {
    const serialized = JSON.stringify(testScenario.patterns);

    expect(serialized).not.toContain('function');
    expect(serialized).not.toContain('=>');
    expect(JSON.parse(serialized)).toEqual(JSON.parse(JSON.stringify(testScenario.patterns)));
  });
});

describe('resolvePatternOutput', () => {
  it('returns the named definition for a fixed output', () => {
    const result = resolve(['staff-policy-aide', 'evidence-transit-ridership-study']);

    expect(result.definitionId).toBe('evidence-staff-review-note');
  });

  it('produces the same Evidence Summary card from either housing report', () => {
    const fromReport = resolve(['staff-policy-aide', 'evidence-rent-burden-report']);
    const fromSurvey = resolve(['staff-policy-aide', 'evidence-tenant-survey']);

    expect(fromReport.definitionId).toBe('evidence-housing-summary');
    expect(fromSurvey.definitionId).toBe('evidence-housing-summary');
  });

  it('gives the two housing reports meaningfully different effects', () => {
    const fromOfficialReport = resolve(['staff-policy-aide', 'evidence-rent-burden-report']);
    const fromDerivedSurvey = resolve(['staff-policy-aide', 'evidence-tenant-survey']);

    expect(fromOfficialReport.effects).not.toEqual(fromDerivedSurvey.effects);
    expect(fromOfficialReport.explanationKey).not.toBe(fromDerivedSurvey.explanationKey);
    // The official record carries committee credibility; the survey carries district relevance.
    expect(fromOfficialReport.effects.billMomentum ?? 0).toBeGreaterThan(0);
    expect(fromDerivedSurvey.effects.districtTrust ?? 0).toBeGreaterThan(0);
  });

  it('drafts a provision from a summary and a renter-focused policy', () => {
    const result = resolve(['evidence-housing-summary', 'policy-housing-choice-voucher']);

    expect(result.definitionId).toBe('policy-drafted-provision');
    expect(result.effects.billMomentum ?? 0).toBeGreaterThan(0);
  });

  it('distinguishes same-party support from an opposing-party counteroffer', () => {
    const sameParty = resolve(['policy-working-bill', 'coalition-office-fifth-district']);
    const opposing = resolve(
      ['policy-working-bill', 'coalition-office-fourth-district'],
      ['expansion-bipartisan-outreach'],
    );

    expect(sameParty.definitionId).toBe('coalition-outreach-result');
    expect(opposing.definitionId).toBe('coalition-outreach-result');
    expect(opposing.explanationKey).not.toBe(sameParty.explanationKey);
  });

  it('is deterministic for the same inputs', () => {
    const first = resolve(['staff-policy-aide', 'evidence-rent-burden-report']);
    const second = resolve(['staff-policy-aide', 'evidence-rent-burden-report']);

    expect(second).toEqual(first);
  });

  it('throws when a derived pattern omits its output parameter', () => {
    const broken: RecipePattern = {
      id: 'p-broken',
      slots: [
        { kind: 'staff', quantity: 1 },
        { kind: 'evidence', quantity: 1 },
      ],
      output: { mode: 'derived', resolverId: 'summarize-evidence-v1' },
      durationMs: 1_000,
      resourceCost: {},
      priority: 0,
      discoveryHint: 'Broken on purpose.',
    };
    const inputs = [
      input('staff-policy-aide', 'a'),
      input('evidence-rent-burden-report', 'b'),
    ];
    const found = matchPattern(inputs, [broken], [], tacticExpansions);
    if (!found) throw new Error('fixture pattern should have matched');

    expect(() => resolvePatternOutput(found, inputs)).toThrow(/outputDefinitionId/);
  });
});
