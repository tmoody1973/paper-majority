import { describe, expect, it } from 'vitest';

import { executeCommand } from '@/domain/engine';
import { createRun } from '@/domain/initialState';
import { inputsForSlot } from '@/domain/patternResolvers';
import { buildMatchInputs, effectiveRule, matchPattern } from '@/domain/recipes';
import type { CardInstance, RecipePattern, TermState } from '@/domain/types';
import { planWork, previewWork } from '@/domain/work';
import { sessionScenario, sessionSetup } from '@/test/fixtures/session';

function opening(): TermState {
  return createRun({ ...sessionSetup, mode: 'session' });
}

function card(state: TermState, definitionId: string) {
  const found = state.cards.find((candidate) => candidate.definitionId === definitionId);
  if (!found) throw new Error(`missing ${definitionId}`);
  return found;
}

function withSummary(state = opening()): TermState {
  const evidence = card(state, 'evidence-rent-burden-report');
  const summary: CardInstance = {
    ...evidence,
    id: 'card-summary',
    stackId: 'stack-card-summary',
    form: 'summary',
    sourceDefinitionIds: [evidence.definitionId],
  };
  return {
    ...state,
    cards: [...state.cards, summary],
    stacks: [...state.stacks, { id: summary.stackId, cardIds: [summary.id] }],
  };
}

describe('Session work reservations', () => {
  it('revalidates atomic 2–4 input work, snapshots effective rules, and resolves exact instances', () => {
    const state = withSummary();
    const counsel = card(state, 'staff-legislative-counsel');
    const summary = state.cards.find((candidate) => candidate.id === 'card-summary')!;
    const policy = card(state, 'policy-housing-choice-voucher');
    const ids = [counsel.id, summary.id, policy.id];

    expect(previewWork(state, sessionScenario, [counsel.id, counsel.id])).toMatchObject({ accepted: false });
    expect(previewWork({ ...state, cards: state.cards.map((c) => c.id === summary.id ? { ...c, location: 'filed' } : c) }, sessionScenario, ids)).toMatchObject({ accepted: false });
    expect(previewWork({ ...state, cards: state.cards.map((c) => c.id === summary.id ? { ...c, status: 'expired' } : c) }, sessionScenario, ids)).toMatchObject({ accepted: false });
    expect(previewWork({ ...state, cards: state.cards.map((c) => c.id === summary.id ? { ...c, status: 'working' } : c) }, sessionScenario, ids)).toMatchObject({ accepted: false });
    expect(previewWork({ ...state, resources: { ...state.resources, staffAttention: 0 } }, sessionScenario, ids)).toMatchObject({ accepted: false });
    const consumingStaffScenario = {
      ...sessionScenario,
      patterns: [{
        ...sessionScenario.patterns[1],
        slots: sessionScenario.patterns[1].slots.map((slot, index) => index === 0 ? { ...slot, consumed: true } : slot),
      }],
    };
    expect(previewWork(state, consumingStaffScenario, ids)).toMatchObject({ accepted: false });

    const before = state.resources.staffAttention;
    const started = executeCommand(state, { type: 'SUBMIT_WORK', cardIds: ids }, { scenario: sessionScenario });
    expect(started.state.activeWork).toHaveLength(1);
    expect(started.state.resources.staffAttention).toBe(before - 1);
    expect(started.state.bill.provisionIds).toEqual([]);
    expect(started.state.activeWork[0]).toMatchObject({
      kind: 'pattern',
      staffCardIds: [counsel.id],
      consumedCardIds: [policy.id, summary.id].sort(),
      returnedCardIds: [counsel.id],
      effectivePattern: { id: 'pattern-draft-policy' },
      paidCost: { staffAttention: 1 },
    });
    expect(previewWork(started.state, sessionScenario, ids)).toMatchObject({ accepted: false });
    const alternateSummary = {
      ...summary, id: 'card-summary-alternate', stackId: 'stack-summary-alternate', status: 'idle' as const,
    };
    const alternatePolicy = {
      ...policy, id: 'card-policy-alternate', stackId: 'stack-policy-alternate', status: 'idle' as const,
    };
    const competingJob = {
      ...started.state,
      cards: [...started.state.cards, alternateSummary, alternatePolicy],
      stacks: [
        ...started.state.stacks,
        { id: alternateSummary.stackId, cardIds: [alternateSummary.id] },
        { id: alternatePolicy.stackId, cardIds: [alternatePolicy.id] },
      ],
    };
    expect(previewWork(
      competingJob,
      sessionScenario,
      [counsel.id, alternateSummary.id, alternatePolicy.id],
    )).toMatchObject({ accepted: false });

    const cancelled = executeCommand(started.state, {
      type: 'SEPARATE_STACK', stackId: counsel.stackId, cardId: counsel.id, x: counsel.x, y: counsel.y,
    }, { scenario: sessionScenario });
    expect(cancelled.state.activeWork).toEqual([]);
    expect(cancelled.state.resources.staffAttention).toBe(before);
    expect(cancelled.state.cards.filter((entry) => ids.includes(entry.id)).every((entry) => entry.status === 'idle')).toBe(true);

    let completed = executeCommand(cancelled.state, { type: 'SUBMIT_WORK', cardIds: ids }, { scenario: sessionScenario }).state;
    completed = { ...completed, paused: false };
    for (let second = 0; second < 40; second += 1) {
      completed = executeCommand(completed, { type: 'TICK', deltaMs: 1_000 }, { scenario: sessionScenario }).state;
    }
    expect(completed.activeWork).toEqual([]);
    expect(completed.resources.staffAttention).toBe(before);
    expect(completed.cards.some((entry) => entry.id === counsel.id && entry.status === 'idle')).toBe(true);
    expect(completed.cards.some((entry) => entry.definitionId === policy.definitionId && entry.form === 'drafted')).toBe(true);
    expect(completed.cards.some((entry) => entry.id === summary.id)).toBe(false);

    const authored: RecipePattern = {
      ...sessionScenario.patterns[1],
      id: 'pattern-effective-snapshot',
      eligibleStages: ['committee'],
      slots: [
        sessionScenario.patterns[1].slots[0],
        { ...sessionScenario.patterns[1].slots[1], anyTags: ['not-yet-eligible'] },
        sessionScenario.patterns[1].slots[2],
      ],
      durationMs: 40_000,
      resourceCost: { staffAttention: 1, politicalCapital: 2 },
      output: {
        mode: 'derived',
        resolverId: 'draft-provision-v1',
        parameters: { preserveInputDefinition: true },
      },
    };
    const expansions = [
      { ...sessionScenario.tacticExpansions[0], id: 'z-cost', targetPatternId: authored.id, effect: { kind: 'resource-cost' as const, resource: 'politicalCapital' as const, delta: -99 } },
      { ...sessionScenario.tacticExpansions[0], id: 'a-duration', targetPatternId: authored.id, effect: { kind: 'duration-multiplier' as const, multiplier: 0.000001 } },
      { ...sessionScenario.tacticExpansions[0], id: 'm-stage', targetPatternId: authored.id, effect: { kind: 'procedure-eligibility' as const, stage: 'draft' as const } },
      { ...sessionScenario.tacticExpansions[0], id: 'b-widen', targetPatternId: authored.id, effect: { kind: 'widen-slot' as const, slotIndex: 1, addAnyTags: ['committee-relevant'] } },
    ];
    const effective = effectiveRule(authored, expansions.map((entry) => entry.id).reverse(), expansions);
    expect(effective.appliedExpansionIds).toEqual(['a-duration', 'b-widen', 'm-stage', 'z-cost']);
    expect(effective.pattern.durationMs).toBe(1);
    expect(effective.pattern.resourceCost.politicalCapital).toBe(0);
    expect(effective.pattern.eligibleStages).toContain('draft');

    const exactPattern: RecipePattern = {
      ...authored,
      id: 'pattern-exact-instances',
      eligibleStages: undefined,
      slots: [
        { requiredTags: ['drafting'], quantity: 1, consumed: false },
        { kind: 'evidence', quantity: 2 },
      ],
      output: { mode: 'fixed', definitionId: policy.definitionId },
      resourceCost: {},
    };
    const sourceB = {
      ...sessionScenario.cards.find((entry) => entry.id === summary.definitionId)!,
      id: 'evidence-source-b',
      title: 'Second rent burden source',
    };
    const exactScenario = { ...sessionScenario, cards: [...sessionScenario.cards, sourceB] };
    const duplicateEvidence = [
      { ...summary, id: 'evidence-a', stackId: 'stack-evidence-a', form: 'raw' as const, sourceDefinitionIds: [summary.definitionId] },
      { ...summary, id: 'evidence-b', stackId: 'stack-evidence-b', form: 'summary' as const, sourceDefinitionIds: [sourceB.id] },
    ];
    const exactInputs = buildMatchInputs([counsel, ...duplicateEvidence], exactScenario, state.player.party);
    const exactMatch = matchPattern(exactInputs, [exactPattern], [], []);
    if (!exactMatch) throw new Error('exact fixture should match');
    const slotInputs = inputsForSlot({ match: exactMatch, inputs: exactInputs, parameters: {} }, 1);
    expect(slotInputs.map((input) => [input.instanceId, input.form, input.provenance.sourceDefinitionIds])).toEqual([
      ['evidence-a', 'raw', [summary.definitionId]],
      ['evidence-b', 'summary', [sourceB.id]],
    ]);
    const exactState = {
      ...state,
      cards: [counsel, ...duplicateEvidence],
      stacks: [counsel, ...duplicateEvidence].map((c) => ({ id: c.stackId, cardIds: [c.id] })),
    };
    const exactPlan = planWork(exactState, { ...exactScenario, patterns: [exactPattern], tacticExpansions: [] }, [counsel.id, 'evidence-a', 'evidence-b']);
    if (!('preview' in exactPlan)) throw new Error('exact work should preview');
    expect(exactPlan.preview.returnedCardIds).toEqual([counsel.id]);
    expect(exactPlan.preview.consumedCardIds).toEqual(['evidence-a', 'evidence-b']);

    const traitScenario = {
      ...sessionScenario,
      staffTraits: [{
        id: 'trait-fast-drafter',
        title: 'Fast drafter',
        eligibleStaffDefinitionIds: [counsel.definitionId],
        effect: { kind: 'duration-multiplier' as const, taskTag: 'drafting', multiplier: 0.5 },
      }],
    };
    const generalistPreview = previewWork(state, traitScenario, ids);
    const assignedPreview = previewWork({
      ...state,
      cards: state.cards.map((entry) => entry.id === counsel.id ? { ...entry, staffTraitId: 'trait-fast-drafter' } : entry),
    }, traitScenario, ids);
    expect(generalistPreview).toMatchObject({ accepted: true, durationMs: 40_000, staffCardIds: [counsel.id] });
    expect(assignedPreview).toMatchObject({ accepted: true, durationMs: 20_000, staffCardIds: [counsel.id] });

    const aide = card(state, 'staff-policy-aide');
    const tacticDefinition = sessionScenario.cards.find((entry) => entry.id === 'tactic-bipartisan-working-group')!;
    const tactic: CardInstance = {
      id: 'card-tactic', definitionId: tacticDefinition.id, stackId: 'stack-card-tactic', x: 600, y: 300,
      remainingMs: 0, status: 'idle', form: 'raw', location: 'desk', sourceDefinitionIds: [],
    };
    const studyState = {
      ...opening(),
      paused: false,
      cards: [...opening().cards, tactic],
      stacks: [...opening().stacks, { id: tactic.stackId, cardIds: [tactic.id] }],
    };
    const studyScenario = structuredClone(sessionScenario);
    studyScenario.tacticExpansions.push({
      ...studyScenario.tacticExpansions[0], id: 'expansion-second-rule', studyDurationMs: 10,
    });
    const studying = executeCommand(studyState, {
      type: 'START_ASSIGNMENT', assignmentKind: 'study-tactic', staffCardId: aide.id, targetCardId: tactic.id,
    }, { scenario: studyScenario });
    expect(studying.state.activeWork[0]).toMatchObject({
      kind: 'study',
      expansionIds: ['expansion-bipartisan-outreach', 'expansion-second-rule'],
      staffCardIds: [aide.id],
    });
    expect(studying.state.cards.find((entry) => entry.id === aide.id)?.remainingMs).toBe(0);
    studyScenario.tacticExpansions = [];
    let studied = studying.state;
    for (let second = 0; second < 20; second += 1) {
      studied = executeCommand(studied, { type: 'TICK', deltaMs: 1_000 }, { scenario: studyScenario }).state;
    }
    expect(studied.activeWork).toEqual([]);
    expect(studied.cards.some((entry) => entry.id === tactic.id)).toBe(false);
    expect(studied.cards.find((entry) => entry.id === aide.id)?.status).toBe('idle');
    expect(studied.unlockedSlotExpansions['pattern-draft-policy']).toEqual([
      'expansion-bipartisan-outreach', 'expansion-second-rule',
    ]);
  });
});
