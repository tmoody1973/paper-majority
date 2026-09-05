import { describe, expect, it } from 'vitest';

import { effectiveCard } from '@/domain/instanceForms';
import { describeCard } from '@/domain/cardDetail';
import { buildMatchInputs, matchPattern } from '@/domain/recipes';
import { createRun } from '@/domain/initialState';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';
import { getCandidateScenario } from '@/content/loadScenario';

describe('effectiveCard', () => {
  it('keeps summary source IDs and makes repeat summarization impossible', () => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const raw = state.cards.find(
      (card) => card.definitionId === 'evidence-rent-burden-report',
    );
    if (!raw) throw new Error('missing fixture evidence');
    const summary = {
      ...raw,
      id: 'card-summary-1',
      form: 'summary' as const,
      sourceDefinitionIds: [raw.definitionId],
    };

    const effective = effectiveCard(summary, sessionScenario);
    expect(effective.form).toBe('summary');
    expect(effective.effectiveSourceClass).toBe('derived');
    expect(effective.provenance.sourceDefinitionIds).toEqual([
      'evidence-rent-burden-report',
    ]);
    expect(effective.provenance.citations).toEqual(
      sessionScenario.cards.find((card) => card.id === raw.definitionId)?.citations,
    );

    const inputs = buildMatchInputs(
      [state.cards.find((card) => card.definitionId === 'staff-policy-aide')!, summary],
      sessionScenario,
      state.player.party,
    );
    expect(
      matchPattern(inputs, sessionScenario.patterns, [], sessionScenario.tacticExpansions)?.pattern.id,
    ).not.toBe('pattern-summarize-evidence');
  });

  it('marks drafted language simulated and identifies its policy precedent', () => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const policy = state.cards.find(
      (card) => card.definitionId === 'policy-housing-choice-voucher',
    );
    if (!policy) throw new Error('missing fixture policy');

    const drafted = effectiveCard(
      {
        ...policy,
        form: 'drafted',
        policyDefinitionId: policy.definitionId,
        sourceDefinitionIds: ['evidence-rent-burden-report'],
      },
      sessionScenario,
    );

    expect(drafted.effectiveSourceClass).toBe('simulated');
    expect(drafted.provenance.policyDefinitionId).toBe('policy-housing-choice-voucher');
    expect(drafted.provenance.precedentIds).toEqual(['precedent-housing-choice-voucher']);
    expect(drafted.provenance.citations.map((citation) => citation.url).sort()).toEqual([
      'https://www.census.gov/programs-surveys/acs',
      'https://www.hud.gov/housing-choice-vouchers',
    ]);
    expect(drafted.definition).toBe(
      sessionScenario.cards.find((card) => card.id === policy.definitionId),
    );
  });

  it('does not mutate the public definition when computing a form', () => {
    const state = createRun({ ...sessionSetup, mode: 'session' });
    const evidence = state.cards.find((card) => card.definitionId.startsWith('evidence-'))!;
    const before = structuredClone(sessionScenario.cards);
    effectiveCard({ ...evidence, form: 'summary' }, sessionScenario);
    expect(sessionScenario.cards).toEqual(before);
  });

  it('keeps simulated prepared support distinct from evidence-derived records', () => {
    const candidate = getCandidateScenario();
    const state = createRun({ ...sessionSetup, scenario: candidate, mode: 'session' });
    const definitionId = 'constituency-urgent-renter-concern';
    const base = state.cards[0];
    const prepared = {
      ...base,
      id: 'prepared-support',
      definitionId,
      form: 'prepared' as const,
      sourceDefinitionIds: [],
      origin: {
        explanationKey: 'result.constituency.endorsement-earned',
        inputDefinitionIds: [definitionId],
        consumedDefinitionIds: [definitionId],
      },
    };
    const effective = effectiveCard(prepared, candidate);
    expect(effective.effectiveSourceClass).toBe('simulated');
    expect(effective.provenance.label).toMatch(/Simulated/);
    expect(effective.provenance.explanationKey).toBe('result.constituency.endorsement-earned');
    const detail = describeCard({ ...state, cards: [...state.cards, prepared] }, candidate, prepared.id);
    expect(detail?.sourceLabel).toBe('Simulated');
    expect(detail?.sourceExplainer).toMatch(/Invented for your run/);
  });
});
