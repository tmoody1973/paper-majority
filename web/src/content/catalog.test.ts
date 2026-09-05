import { describe, expect, it } from 'vitest';

import { analyzeCatalog, tacticSubsets } from '@/content/catalogAnalysis';
import { getCandidateScenario } from '@/content/loadScenario';

describe('housing Session candidate catalog', () => {
  const scenario = getCandidateScenario();

  it('preserves the reviewed category budget while remaining visibly candidate', () => {
    expect(scenario.contentStatus).toMatchObject({ status: 'candidate', humanReviewPending: true });
    expect(scenario.cards).toHaveLength(30);
    expect(Object.fromEntries([
      'staff', 'policy', 'evidence', 'coalition', 'constituency', 'institution', 'political', 'tactic',
    ].map((kind) => [kind, scenario.cards.filter((card) => card.kind === kind).length]))).toEqual({
      staff: 3, policy: 5, evidence: 5, coalition: 4,
      constituency: 4, institution: 3, political: 2, tactic: 4,
    });
    expect(scenario.patterns).toHaveLength(16);
    expect(scenario.tacticExpansions).toHaveLength(4);
    expect(scenario.storyEvents).toHaveLength(12);
    expect(scenario.houseModel).toMatchObject({ curatedMemberSeats: 5, anonymousSeats: 430 });
  });

  it('gives at least three finite evidence definitions all four competing sinks', () => {
    const evidence = scenario.cards.filter((card) => card.kind === 'evidence');
    expect(evidence.filter((card) => [
      'drafting', 'office-concern', 'district-preparation', 'committee-preparation',
    ].every((sink) => card.sinks?.includes(sink as never)))).toHaveLength(3);
    for (const card of evidence) {
      expect(card.underlyingSourceIds?.length).toBeGreaterThan(0);
      expect(card.validForms).toContain('raw');
      expect(card.transformations?.length).toBeGreaterThan(0);
    }
  });

  it('keeps simulated office interests separate and makes fulfilled promises net costly', () => {
    for (const office of scenario.cards.filter((card) => card.kind === 'coalition')) {
      expect(office.tags).not.toContain('housing-interest');
      expect(office.tags).not.toContain('shared-interest');
      expect(office.simulation?.interestTags).toHaveLength(1);
    }
    for (const choice of scenario.decisionChoices.filter((entry) => entry.action !== 'reject')) {
      const capital = choice.effects.flatMap((effect) =>
        effect.kind === 'resource' && effect.resource === 'politicalCapital' ? [effect.delta] : [],
      );
      expect(capital.filter((delta) => delta < 0).reduce((sum, delta) => sum + delta, 0)).toBeLessThanOrEqual(-2);
      expect(capital.filter((delta) => delta > 0).reduce((sum, delta) => sum + delta, 0)).toBe(1);
    }
  });

  it('enumerates distinct definition sets once and rejects no equal-ranked state', () => {
    for (const party of ['democratic', 'republican'] as const) {
      for (const subset of tacticSubsets(scenario)) {
        const report = analyzeCatalog(scenario, party, subset);
        expect(report.collisions, `${party}/${subset.join(',') || 'base'}`).toEqual([]);
        expect(report.definitionSetCount).toBeGreaterThanOrEqual(50);
        expect(report.formAwareMatchCount).toBeGreaterThanOrEqual(report.definitionSetCount);
      }
    }
  });
});
