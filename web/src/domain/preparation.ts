import type { GameEvent } from '@/domain/events';
import { matchesPatternOutputReceipt } from '@/domain/patternResolvers';
import type { DemandConditionDefinition, PreparationDelivery, ScenarioDefinition, TermState } from '@/domain/types';

type Completion = Extract<GameEvent, { type: 'PATTERN_COMPLETED' }>;
type Transform = Extract<GameEvent, { type: 'CARD_TRANSFORMED' }>;
const sameIds = (a: readonly string[] = [], b: readonly string[] = []) => {
  const sortedB = [...b].sort();
  return a.length === b.length && [...a].sort().every((id, index) => id === sortedB[index]);
};

/** Validate historical proof, even after the delivered artifact has been consumed. */
export function validPreparationDelivery(
  completion: Completion,
  preceding: readonly GameEvent[],
  scenario: ScenarioDefinition,
): boolean {
  const receipt = completion.delivery;
  if (!receipt) return false;
  const pattern = scenario.patterns.find((entry) => entry.id === completion.patternId);
  if (pattern?.output.mode !== 'derived' || pattern.output.resolverId !== 'resolve-outreach-v1') return false;
  const slotIndex = pattern.output.parameters?.preparationSlot;
  if (typeof slotIndex !== 'number') return false;
  const slot = pattern.slots[slotIndex];
  const demand = scenario.demandDefinitions.find((entry) => entry.id === receipt.demandId);
  if (!slot || !demand || demand.officeDefinitionId !== receipt.officeDefinitionId
    || demand.evidenceConcernId !== receipt.concernId) return false;
  const submittedIndex = preceding.findIndex((event) => event.type === 'WORK_SUBMITTED' && event.workId === completion.workId);
  const submitted = preceding[submittedIndex];
  const accepted = preceding[submittedIndex - 1];
  if (submitted?.type !== 'WORK_SUBMITTED' || accepted?.type !== 'STACK_ACCEPTED'
    || accepted.patternId !== completion.patternId
    || !sameIds(submitted.cardIds, completion.inputCardIds)
    || !sameIds(accepted.cardIds, submitted.cardIds)
    || !sameIds(accepted.definitionIds, completion.inputDefinitionIds)
    || !completion.inputCardIds?.includes(receipt.artifactCardId)
    || !completion.inputDefinitionIds?.includes(receipt.officeDefinitionId)) return false;
  if (preceding.some((event) => event.type === 'PATTERN_COMPLETED' && event.workId === completion.workId)) return false;
  const producer = preceding.slice(0, submittedIndex).find((event): event is Transform =>
    event.type === 'CARD_TRANSFORMED' && event.producedCardIds.includes(receipt.artifactCardId));
  const producerPattern = scenario.patterns.find((entry) => entry.id === producer?.producerPatternId);
  const definition = scenario.cards.find((entry) => entry.id === producer?.outputDefinitionId);
  if (!producer || !producerPattern || !definition || producer.outputForm !== 'prepared'
    || !matchesPatternOutputReceipt(producerPattern, scenario, {
      definitionId: producer.outputDefinitionId, form: producer.outputForm,
      explanationKey: producer.explanationKey, outputSlotIndex: producer.outputSlotIndex,
      outputSourceDefinitionId: producer.outputSourceDefinitionId, outputSourceForm: producer.outputSourceForm,
    }) || slot.kind !== definition.kind || !slot.forms?.includes('prepared')
    || !slot.originExplanationKeys?.includes(producer.explanationKey)) return false;
  if (pattern.output.parameters?.requireMatchingConcern === true
    && (producer.authoredConcernId !== receipt.concernId
      || producer.authoredConcernOfficeDefinitionId !== receipt.officeDefinitionId)) return false;
  const consumptions = preceding.filter((event): event is Transform =>
    event.type === 'CARD_TRANSFORMED' && event.consumedCardIds.includes(receipt.artifactCardId));
  const delivery = consumptions[0];
  if (consumptions.length !== 1 || !delivery || delivery.producedCardIds.length !== 0
    || delivery.explanationKey !== 'result.outreach.offer-presented'
    || !sameIds([...delivery.consumedCardIds, ...delivery.returnedCardIds], completion.inputCardIds)
    || !completion.consumedDefinitionIds?.includes(definition.id)) return false;
  const examinedRevision = preceding.reduce((revision, event) =>
    event.type === 'PROVISION_DOCKETED' || event.type === 'PROVISION_NEGOTIATED'
      ? Math.max(revision, event.revision) : revision, 0);
  return receipt.billRevision === examinedRevision;
}

export function deliveredPreparationSatisfied(
  state: TermState,
  scenario: ScenarioDefinition,
  officeId: string,
  condition: Extract<DemandConditionDefinition, { kind: 'delivered-preparation' }>,
  concernId?: string,
): boolean {
  const delivered = state.eventLog.some((event, index) => {
    if (event.type !== 'PATTERN_COMPLETED' || event.patternId !== condition.patternId || !event.delivery) return false;
    const receipt = event.delivery;
    if (receipt.officeDefinitionId !== officeId || receipt.concernId !== concernId
      || receipt.demandId !== state.relationships.find((relationship) => relationship.memberId === officeId)?.demandProvisionId
      || receipt.billRevision !== state.bill.revision) return false;
    const producer = state.eventLog.slice(0, index).find((entry) => entry.type === 'CARD_TRANSFORMED'
      && entry.producedCardIds.includes(receipt.artifactCardId));
    return producer?.type === 'CARD_TRANSFORMED'
      && scenario.cards.find((card) => card.id === producer.outputDefinitionId)?.tags.includes(condition.tag)
      && validPreparationDelivery(event, state.eventLog.slice(0, index), scenario);
  });
  if (!delivered) return false;
  return !condition.requiresReviewedProvision || state.bill.provisionReceipts.some((receipt) =>
    receipt.origin === 'draft' && state.bill.provisionIds.includes(receipt.provisionId)
    && state.eventLog.some((event) => event.type === 'CARD_TRANSFORMED'
      && event.producedCardIds.includes(receipt.draftedCardId)
      && event.outputDefinitionId === receipt.provisionId && event.outputForm === 'drafted'
      && event.explanationKey === 'result.provision.reviewed'));
}

export function isPreparationDelivery(value: unknown): value is PreparationDelivery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return Object.keys(entry).sort().join('|') === 'artifactCardId|billRevision|concernId|demandId|officeDefinitionId'
    && ['artifactCardId', 'concernId', 'demandId', 'officeDefinitionId'].every((key) => typeof entry[key] === 'string')
    && Number.isInteger(entry.billRevision) && (entry.billRevision as number) >= 0;
}
