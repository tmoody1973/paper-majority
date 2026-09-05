import { previewBillChange } from '@/domain/bill';
import {
  applyRelationshipEvaluation,
  evaluateRelationships,
  positiveDecisionResourceEffects,
  relationshipConditionSatisfied,
} from '@/domain/coalition';
import { applyResourceDelta } from '@/domain/resources';
import { obligationOccurrence } from '@/domain/obligations';
import { planWork, type WorkPlan } from '@/domain/work';
import type {
  DecisionChoiceDefinition,
  Obligation,
  RelationshipState,
  Resources,
  ScenarioDefinition,
  TermState,
} from '@/domain/types';

export interface RequiredDecisionWork {
  patternId: string;
  cardIds: string[];
  staffCardIds: string[];
  durationMs: number;
  cost: Partial<Resources>;
  consumedCardIds: string[];
  returnedCardIds: string[];
}

export type DecisionPreview =
  | {
      accepted: false;
      reason: 'unknown-decision' | 'unknown-choice' | 'stale-decision' | 'missing-prerequisites' | 'insufficient-resources' | 'pending-decision';
      message: string;
      expectedBillRevision?: number;
    }
  | {
      accepted: true;
      decisionId: string;
      choiceId: string;
      action: DecisionChoiceDefinition['action'];
      occurrenceId: string;
      expectedBillRevision: number;
      affectedOfficeDefinitionIds: string[];
      nextProvisionIds: string[];
      upfrontCosts: Partial<Resources>;
      resourceDeltas: Partial<Resources>;
      deferredRewards: Partial<Resources>;
      newObligations: Obligation[];
      requiredWork?: RequiredDecisionWork;
      gainedSupport: string[];
      lostSupport: string[];
      incompatiblePromises: string[];
      nextRelationships: RelationshipState[];
    };

function combinations<T>(items: T[], size: number, start = 0, chosen: T[] = []): T[][] {
  if (chosen.length === size) return [chosen];
  const results: T[][] = [];
  for (let index = start; index <= items.length - (size - chosen.length); index += 1) {
    results.push(...combinations(items, size, index + 1, [...chosen, items[index]]));
  }
  return results;
}

function requiredWorkPlan(
  state: TermState,
  scenario: ScenarioDefinition,
  officeDefinitionId: string,
  concernId: string,
  patternId: string,
): { plan: WorkPlan; cardIds: string[] } | undefined {
  const available = state.cards
    .filter((card) => card.location === 'desk' && card.status === 'idle')
    .sort((a, b) => a.id.localeCompare(b.id));
  for (let size = 2; size <= 4; size += 1) {
    for (const cards of combinations(available, size)) {
      if (!cards.some((card) => card.definitionId === officeDefinitionId)) continue;
      const prepared = cards.filter((card) => card.form === 'prepared');
      if (prepared.some((card) =>
        card.origin?.authoredConcern?.recipientOfficeDefinitionId !== officeDefinitionId
          || card.origin.authoredConcern.concernId !== concernId,
      )) continue;
      const cardIds = cards.map((card) => card.id);
      const planned = planWork(state, scenario, cardIds);
      if ('preview' in planned && planned.preview.patternId === patternId) {
        return { plan: planned, cardIds };
      }
    }
  }
  return undefined;
}

export function findRequiredDecisionWorkPlan(
  state: TermState,
  scenario: ScenarioDefinition,
  decisionId: string,
  choiceId: string,
): { plan: WorkPlan; cardIds: string[] } | undefined {
  const pending = state.pendingDecisions.find((decision) => decision.id === decisionId && decision.status === 'pending');
  const choice = scenario.decisionChoices.find((candidate) => candidate.id === choiceId);
  if (!pending || !choice?.requiredWorkPatternId) return undefined;
  return requiredWorkPlan(state, scenario, pending.officeDefinitionId, pending.sourceId, choice.requiredWorkPatternId);
}

function negativeDecisionResourceCosts(choice: DecisionChoiceDefinition): Partial<Resources> {
  const costs: Partial<Resources> = {};
  for (const effect of choice.effects) {
    if (effect.kind === 'resource' && effect.resource !== 'policyIntegrity' && effect.delta < 0) {
      costs[effect.resource] = (costs[effect.resource] ?? 0) + -effect.delta;
    }
  }
  return costs;
}

export type DecisionUpfrontResourcePlan =
  | { accepted: false; costs: Partial<Resources> }
  | {
      accepted: true;
      costs: Partial<Resources>;
      afterWorkResources: Resources;
      resources: Resources;
      workApplied: Partial<Resources>;
      decisionApplied: Partial<Resources>;
    };

/** Apply the exact commit order: reserve work, pay every negative choice effect, then set bill integrity. */
export function planDecisionUpfrontResources(
  resources: Resources,
  choice: DecisionChoiceDefinition,
  workCost: Partial<Resources>,
  policyIntegrity: number,
): DecisionUpfrontResourcePlan {
  const choiceCosts = negativeDecisionResourceCosts(choice);
  const costs: Partial<Resources> = { ...workCost };
  for (const [resource, amount] of Object.entries(choiceCosts) as [keyof Resources, number][]) {
    costs[resource] = (costs[resource] ?? 0) + amount;
  }
  if ((Object.entries(costs) as [keyof Resources, number][]).some(
    ([resource, amount]) => resources[resource] < amount,
  )) {
    return { accepted: false, costs };
  }

  const workRequest = Object.fromEntries(
    (Object.entries(workCost) as [keyof Resources, number][]).map(([resource, amount]) => [resource, -amount]),
  ) as Partial<Resources>;
  const work = applyResourceDelta(resources, workRequest);
  const decisionRequest = Object.fromEntries(
    (Object.entries(choiceCosts) as [keyof Resources, number][]).map(([resource, amount]) => [resource, -amount]),
  ) as Partial<Resources>;
  decisionRequest.policyIntegrity = policyIntegrity - work.resources.policyIntegrity;
  const decision = applyResourceDelta(work.resources, decisionRequest);
  return {
    accepted: true,
    costs,
    afterWorkResources: work.resources,
    resources: decision.resources,
    workApplied: work.applied,
    decisionApplied: decision.applied,
  };
}

function resourceDifferences(before: Resources, after: Resources): Partial<Resources> {
  const differences: Partial<Resources> = {};
  for (const resource of Object.keys(before) as (keyof Resources)[]) {
    const delta = after[resource] - before[resource];
    if (delta !== 0) differences[resource] = delta;
  }
  return differences;
}

function provisionEffects(
  state: TermState,
  choice: DecisionChoiceDefinition,
): string[] {
  const provisions = [...state.bill.provisionIds];
  for (const effect of choice.effects) {
    if (effect.kind === 'bill-remove-provision') {
      const index = provisions.indexOf(effect.provisionId);
      if (index >= 0) provisions.splice(index, 1);
    } else if (effect.kind === 'bill-add-provision' && !provisions.includes(effect.provisionId)) {
      provisions.push(effect.provisionId);
    }
  }
  return provisions;
}

function proposedRelationships(
  state: TermState,
  scenario: ScenarioDefinition,
  choice: DecisionChoiceDefinition,
  occurrenceId: string,
  officeDefinitionId: string,
  demandId: string,
  nextProvisionIds: string[],
): RelationshipState[] {
  const current = evaluateRelationships(state, scenario);
  const demand = scenario.demandDefinitions.find((candidate) =>
    candidate.id === demandId && candidate.officeDefinitionId === officeDefinitionId,
  );
  const explicitSupport = choice.effects.find((effect) => effect.kind === 'relationship-support');
  const promiseConditions = choice.effects
    .filter((effect) => effect.kind === 'promise-condition')
    .map((effect) => effect.condition);
  const conditions = promiseConditions.length > 0
    ? promiseConditions
    : demand ? [demand.condition] : [];
  const amended = current.map((relationship) => {
    if (relationship.memberId !== officeDefinitionId) return relationship;
    if (explicitSupport?.kind === 'relationship-support' && explicitSupport.support === 'refused') {
      return {
        ...relationship,
        support: 'refused' as const,
        demandProvisionId: demand?.id,
        demandOccurrenceId: occurrenceId,
        evaluatedRevision: state.bill.revision,
      };
    }
    return {
      ...relationship,
      support: 'conditional' as const,
      demandProvisionId: demand?.id,
      demandOccurrenceId: occurrenceId,
      promiseOccurrenceIds: Array.from(new Set([...relationship.promiseOccurrenceIds, occurrenceId])).sort(),
      conditions: [...relationship.conditions, ...conditions].filter((condition, index, all) =>
        all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(condition)) === index,
      ),
      evaluatedRevision: state.bill.revision,
    };
  });
  return evaluateRelationships(
    { ...state, bill: { ...state.bill, provisionIds: nextProvisionIds }, relationships: amended },
    scenario,
  );
}

function supportChanges(before: RelationshipState[], after: RelationshipState[]) {
  const prior = new Map(before.map((relationship) => [relationship.memberId, relationship.support]));
  return {
    gainedSupport: after
      .filter((relationship) => relationship.support === 'committed' && prior.get(relationship.memberId) !== 'committed')
      .map((relationship) => relationship.memberId),
    lostSupport: after
      .filter((relationship) => relationship.support !== 'committed' && prior.get(relationship.memberId) === 'committed')
      .map((relationship) => relationship.memberId),
  };
}

export function previewDecision(
  state: TermState,
  scenario: ScenarioDefinition,
  decisionId: string,
  choiceId: string,
): DecisionPreview {
  const pending = state.pendingDecisions.find((decision) => decision.id === decisionId && decision.status === 'pending');
  if (!pending) return { accepted: false, reason: 'unknown-decision', message: 'That offer is no longer pending.' };
  if (pending.expectedBillRevision !== state.bill.revision) {
    return {
      accepted: false,
      reason: 'stale-decision',
      message: `This offer examined revision ${pending.approachedBillRevision}; review the current revision before deciding.`,
      expectedBillRevision: pending.expectedBillRevision,
    };
  }
  if (!pending.choiceIds.includes(choiceId)) {
    return { accepted: false, reason: 'unknown-choice', message: 'That response is not available for this offer.' };
  }
  const choice = scenario.decisionChoices.find((candidate) => candidate.id === choiceId);
  if (!choice) return { accepted: false, reason: 'unknown-choice', message: 'That response is not authored in this scenario.' };
  const changesBill = choice.effects.some((effect) =>
    effect.kind === 'bill-add-provision' || effect.kind === 'bill-remove-provision',
  );
  if (
    changesBill
    && state.pendingDecisions.some((decision) => decision.status === 'pending' && decision.id !== decisionId)
  ) {
    return {
      accepted: false,
      reason: 'pending-decision',
      message: 'Resolve the other pending coalition offers before changing the bill.',
    };
  }
  if (choice.requirements.some((requirement) =>
    !relationshipConditionSatisfied(
      state,
      scenario,
      pending.officeDefinitionId,
      requirement,
      state.bill.provisionIds,
      pending.sourceId,
    ),
  )) {
    return { accepted: false, reason: 'missing-prerequisites', message: 'The required evidence or bill condition is not ready.' };
  }

  const required = choice.requiredWorkPatternId
    ? requiredWorkPlan(state, scenario, pending.officeDefinitionId, pending.sourceId, choice.requiredWorkPatternId)
    : undefined;
  if (choice.requiredWorkPatternId && !required) {
    return { accepted: false, reason: 'missing-prerequisites', message: 'No eligible staff and evidence are ready for this counteroffer.' };
  }

  const nextProvisionIds = provisionEffects(state, choice);
  const billPreview = previewBillChange(state, scenario, nextProvisionIds);
  const resourcePlan = planDecisionUpfrontResources(
    state.resources,
    choice,
    required?.plan.preview.cost ?? {},
    billPreview.integrity,
  );
  if (!resourcePlan.accepted) {
    return { accepted: false, reason: 'insufficient-resources', message: 'The choice and its required work exceed current resources.' };
  }
  const beforeRelationships = evaluateRelationships(state, scenario);
  const relationshipInput = required
    ? {
        ...state,
        cards: state.cards.map((card) => required.cardIds.includes(card.id)
          ? { ...card, status: 'working' as const }
          : card),
        relationships: beforeRelationships,
      }
    : { ...state, relationships: beforeRelationships };
  const nextRelationships = proposedRelationships(
    relationshipInput,
    scenario,
    choice,
    pending.occurrenceId,
    pending.officeDefinitionId,
    pending.sourceId,
    nextProvisionIds,
  );
  const changes = supportChanges(beforeRelationships, nextRelationships);
  const projected = applyRelationshipEvaluation(
    {
      ...relationshipInput,
      resources: resourcePlan.resources,
      bill: { ...state.bill, provisionIds: nextProvisionIds },
      relationships: nextRelationships,
    },
    scenario,
    beforeRelationships,
    [{ type: 'DECISION_RESOLVED', decisionId, choiceId, occurrenceId: pending.occurrenceId }],
  );
  const currentFulfilled = projected.events.some((event) =>
    event.type === 'PROMISE_CHANGED'
      && event.promiseOccurrenceId === pending.occurrenceId
      && event.status === 'fulfilled',
  );
  const currentPromiseOpen = nextRelationships.some((relationship) =>
    relationship.promiseOccurrenceIds.includes(pending.occurrenceId),
  );
  const deferredRewards = !currentPromiseOpen
    || currentFulfilled
    || state.rewardedOccurrenceIds.includes(pending.occurrenceId)
    ? {}
    : positiveDecisionResourceEffects(choice);
  const negativeValues = nextProvisionIds
    .filter((id) => !state.bill.provisionIds.includes(id))
    .flatMap((id) => {
      const definition = scenario.cards.find((card) => card.id === id);
      if (definition?.kind !== 'policy') return [];
      return state.player.values.filter((value) => definition.valueEffects[value] === -1);
    });
  const brokenPromises = changes.lostSupport.flatMap((officeId) =>
    beforeRelationships.find((relationship) => relationship.memberId === officeId)?.promiseOccurrenceIds ?? [],
  );
  const newObligations = choice.effects.flatMap((effect) => {
    if (effect.kind !== 'create-obligation') return [];
    const definition = scenario.obligationDefinitions.find((candidate) => candidate.id === effect.obligationDefinitionId);
    if (!definition) return [];
    return [obligationOccurrence(definition, pending.occurrenceId)];
  });

  return {
    accepted: true,
    decisionId,
    choiceId,
    action: choice.action,
    occurrenceId: pending.occurrenceId,
    expectedBillRevision: pending.expectedBillRevision,
    affectedOfficeDefinitionIds: Array.from(new Set([
      pending.officeDefinitionId,
      ...changes.gainedSupport,
      ...changes.lostSupport,
    ])).sort(),
    nextProvisionIds,
    upfrontCosts: resourcePlan.costs,
    resourceDeltas: resourceDifferences(state.resources, projected.state.resources),
    deferredRewards,
    newObligations,
    requiredWork: required ? {
      patternId: required.plan.preview.patternId,
      cardIds: [...required.cardIds],
      staffCardIds: [...required.plan.preview.staffCardIds],
      durationMs: required.plan.preview.durationMs,
      cost: { ...required.plan.preview.cost },
      consumedCardIds: [...required.plan.preview.consumedCardIds],
      returnedCardIds: [...required.plan.preview.returnedCardIds],
    } : undefined,
    gainedSupport: changes.gainedSupport,
    lostSupport: changes.lostSupport,
    incompatiblePromises: Array.from(new Set([...negativeValues, ...brokenPromises])).sort(),
    nextRelationships,
  };
}
