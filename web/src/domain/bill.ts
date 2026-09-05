import type {
  GoverningValue,
  PolicyCardDefinition,
  ScenarioDefinition,
  TermState,
} from '@/domain/types';

export interface BillContribution {
  provisionId: string;
  value: GoverningValue;
  delta: number;
}

export interface BillPreview {
  integrity: number;
  contributions: BillContribution[];
}

export type DocketPreview =
  | {
      accepted: true;
      cardId: string;
      provisionId: string;
      sourceDefinitionIds: string[];
      nextRevision: number;
      bill: BillPreview;
    }
  | { accepted: false; reason: 'unknown-card' | 'invalid-card-form' | 'duplicate-provision'; message: string };

function policyFor(
  scenario: ScenarioDefinition,
  provisionId: string,
): PolicyCardDefinition | undefined {
  const definition = scenario.cards.find((card) => card.id === provisionId);
  return definition?.kind === 'policy' ? definition : undefined;
}

function contributionDelta(effect: -1 | 0 | 1 | undefined): number {
  return effect === 1 ? 8 : effect === -1 ? -10 : 0;
}

function calculateBill(
  provisionIds: string[],
  selectedValues: [GoverningValue, GoverningValue],
  scenario: ScenarioDefinition,
): BillPreview {
  const contributions: BillContribution[] = [];

  for (const provisionId of [...new Set(provisionIds)]) {
    const policy = policyFor(scenario, provisionId);
    if (!policy) continue;
    for (const value of selectedValues) {
      const delta = contributionDelta(policy.valueEffects[value]);
      if (delta !== 0) contributions.push({ provisionId, value, delta });
    }
  }

  const integrity = Math.min(
    100,
    Math.max(0, 60 + contributions.reduce((sum, contribution) => sum + contribution.delta, 0)),
  );
  return { integrity, contributions };
}

export function previewBillChange(
  state: TermState,
  scenario: ScenarioDefinition,
  nextProvisionIds: string[],
): BillPreview {
  return calculateBill(nextProvisionIds, state.player.values, scenario);
}

export function computePolicyIntegrity(
  provisionIds: string[],
  selectedValues: [GoverningValue, GoverningValue],
  scenario: ScenarioDefinition,
): number {
  return calculateBill(provisionIds, selectedValues, scenario).integrity;
}

/** Pure command preview shared by the canvas cue, React controls, and engine. */
export function previewDocketProvision(
  state: TermState,
  scenario: ScenarioDefinition,
  cardId: string,
): DocketPreview {
  const card = state.cards.find((candidate) => candidate.id === cardId);
  if (!card || card.location !== 'desk') {
    return { accepted: false, reason: 'unknown-card', message: 'That drafted provision is no longer on the desk.' };
  }
  const provisionId = card.policyDefinitionId ?? card.definitionId;
  const policy = policyFor(scenario, provisionId);
  if (card.form !== 'drafted' || !policy || card.status !== 'idle') {
    return { accepted: false, reason: 'invalid-card-form', message: 'Only a finished drafted provision can be added to the bill.' };
  }
  if (state.bill.provisionIds.includes(provisionId)) {
    return { accepted: false, reason: 'duplicate-provision', message: `${policy.title} is already in the bill. The drafted card was not spent.` };
  }
  const nextProvisionIds = [...state.bill.provisionIds, provisionId];
  return {
    accepted: true,
    cardId,
    provisionId,
    sourceDefinitionIds: [...new Set(card.sourceDefinitionIds)].sort(),
    nextRevision: state.bill.revision + 1,
    bill: previewBillChange(state, scenario, nextProvisionIds),
  };
}
