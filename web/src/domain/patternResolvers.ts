import type { MatchInput, PatternMatch } from '@/domain/recipes';
import type { DerivedResolverId, InstanceForm, Resources, ScenarioDefinition } from '@/domain/types';

export interface ResolvedPatternOutput {
  definitionId: string;
  form?: InstanceForm;
  effects: Partial<Resources>;
  explanationKey: string;
  /** Exact matched slot whose instance identity is preserved by this output. */
  outputSlotIndex?: number;
}

const RESOLVER_RECEIPTS: Record<DerivedResolverId, { form: InstanceForm; explanations: string[]; defaultOutputSlot?: number }> = {
  'summarize-evidence-v1': { form: 'summary', explanations: ['result.summary.committee-credibility', 'result.summary.district-relevance'], defaultOutputSlot: 1 },
  'draft-provision-v1': { form: 'drafted', explanations: ['result.provision.drafted'], defaultOutputSlot: 2 },
  'answer-office-concern-v1': { form: 'prepared', explanations: ['result.evidence.office-concern-answered'], defaultOutputSlot: 1 },
  'prepare-evidence-packet-v1': { form: 'prepared', explanations: ['result.evidence.district-packet-prepared'], defaultOutputSlot: 1 },
  'resolve-outreach-v1': { form: 'raw', explanations: ['result.outreach.counteroffer', 'result.outreach.support'] },
  'strengthen-provision-v1': { form: 'raw', explanations: ['result.provision.strengthened'] },
  'prepare-district-response-v1': { form: 'prepared', explanations: ['result.constituency.response-prepared'], defaultOutputSlot: 1 },
  'prepare-committee-packet-v1': { form: 'prepared', explanations: ['result.institution.committee-packet-prepared'], defaultOutputSlot: 1 },
  'prepare-district-endorsement-v1': { form: 'prepared', explanations: ['result.constituency.endorsement-earned'], defaultOutputSlot: 1 },
  'prepare-political-asset-v1': { form: 'prepared', explanations: ['result.political.asset-prepared'], defaultOutputSlot: 1 },
  'review-provision-v1': { form: 'drafted', explanations: ['result.provision.reviewed'], defaultOutputSlot: 1 },
};

/** Authenticate a persisted producer claim against the authored resolver contract. */
export function matchesPatternOutputReceipt(
  pattern: PatternMatch['pattern'],
  scenario: ScenarioDefinition,
  claim: {
    definitionId: string;
    form: InstanceForm;
    explanationKey: string;
    outputSlotIndex?: number;
    outputSourceDefinitionId?: string;
    outputSourceForm?: InstanceForm;
  },
): boolean {
  if (pattern.output.mode === 'fixed') {
    return claim.definitionId === pattern.output.definitionId
      && claim.form === 'raw'
      && claim.explanationKey === `result.fixed.${pattern.output.definitionId}`
      && claim.outputSlotIndex === undefined
      && claim.outputSourceDefinitionId === undefined
      && claim.outputSourceForm === undefined;
  }
  const receipt = RESOLVER_RECEIPTS[pattern.output.resolverId];
  if (!receipt.explanations.includes(claim.explanationKey)) return false;
  const preservesInput = pattern.output.parameters?.preserveInputDefinition === true;
  if (preservesInput) {
    const authoredSlot = pattern.output.parameters?.outputSlot;
    const outputSlotIndex = typeof authoredSlot === 'number' ? authoredSlot : receipt.defaultOutputSlot;
    const slot = outputSlotIndex === undefined ? undefined : pattern.slots[outputSlotIndex];
    const source = scenario.cards.find((card) => card.id === claim.outputSourceDefinitionId);
    return claim.form === receipt.form
      && claim.outputSlotIndex === outputSlotIndex
      && claim.definitionId === claim.outputSourceDefinitionId
      && source !== undefined
      && slot !== undefined
      && (slot.kind === undefined || source.kind === slot.kind)
      && (slot.requiredTags === undefined || slot.requiredTags.every((tag) => source.tags.includes(tag)))
      && (slot.anyTags === undefined || slot.anyTags.some((tag) => source.tags.includes(tag)))
      && (slot.sourceClasses === undefined || slot.sourceClasses.includes(source.sourceClass))
      && (slot.forms === undefined || claim.outputSourceForm !== undefined && slot.forms.includes(claim.outputSourceForm));
  }
  const authoredOutputId = pattern.output.parameters?.outputDefinitionId;
  return claim.form === 'raw'
    && typeof authoredOutputId === 'string'
    && claim.definitionId === authoredOutputId
    && claim.outputSlotIndex === undefined
    && claim.outputSourceDefinitionId === undefined
    && claim.outputSourceForm === undefined;
}

export interface ResolverContext {
  match: PatternMatch;
  inputs: MatchInput[];
  parameters: Record<string, string | number | boolean>;
}

export type PatternResolver = (context: ResolverContext) => ResolvedPatternOutput;

/**
 * Content never carries code. A derived pattern names one of these allowlisted
 * resolver IDs plus JSON parameters; the behaviour lives here, in the engine, where
 * it is versioned, testable and impossible to smuggle in through a scenario file.
 */

function requireOutputId(parameters: Record<string, string | number | boolean>): string {
  const value = parameters.outputDefinitionId;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Derived pattern output requires a string `outputDefinitionId` parameter');
  }
  return value;
}

export function inputsForSlot(context: ResolverContext, slotIndex: number): MatchInput[] {
  const assignment = context.match.assignments.find((a) => a.slotIndex === slotIndex);
  if (!assignment) throw new Error(`Resolver could not find slot ${slotIndex}`);

  return assignment.cardInstanceIds.map((instanceId) => {
    const found = context.inputs.find((input) => input.instanceId === instanceId);
    if (!found) throw new Error(`Resolver could not find instance "${instanceId}" assigned to slot ${slotIndex}`);
    return found;
  });
}

function inputForSlot(context: ResolverContext, slotIndex: number): MatchInput {
  const [found] = inputsForSlot(context, slotIndex);
  if (!found) throw new Error(`Resolver found an empty slot ${slotIndex}`);
  return found;
}

function parameterSlot(context: ResolverContext, fallback: number): number {
  const value = context.parameters.outputSlot;
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
}

function officeConcernHasExpectedRecipient(context: ResolverContext): boolean {
  const office = inputForSlot(context, 2);
  const concern = inputForSlot(context, 3);
  return concern.definition.kind === 'constituency'
    && concern.definition.authoredConcern !== undefined
    && concern.definition.authoredConcern.recipientOfficeDefinitionId === office.definition.id;
}

/**
 * Validate relationships between matched inputs that cannot be expressed by
 * recipe slot tags alone. Work preview and command submission both call this
 * before reserving cards or charging resources; resolvers repeat it defensively.
 */
export function validatePatternPreflight(
  match: PatternMatch,
  inputs: MatchInput[],
): string | undefined {
  const output = match.effectivePattern.output;
  if (output.mode !== 'derived' || output.resolverId !== 'answer-office-concern-v1') {
    return undefined;
  }
  const context = { match, inputs, parameters: output.parameters ?? {} };
  return officeConcernHasExpectedRecipient(context)
    ? undefined
    : 'That authored concern belongs to a different recipient office.';
}

function outputForSessionForm(
  context: ResolverContext,
  slotIndex: number,
  form: InstanceForm,
): Pick<ResolvedPatternOutput, 'definitionId' | 'form' | 'outputSlotIndex'> {
  if (context.parameters.preserveInputDefinition === true) {
    return { definitionId: inputForSlot(context, slotIndex).definition.id, form, outputSlotIndex: slotIndex };
  }
  return { definitionId: requireOutputId(context.parameters) };
}

const summarizeEvidence: PatternResolver = (context) => {
  const evidence = inputForSlot(context, 1);

  // The card chosen still matters. An official record buys committee credibility;
  // a derived local survey buys district relevance.
  return evidence.definition.sourceClass === 'official'
    ? {
        ...outputForSessionForm(context, 1, 'summary'),
        effects: { billMomentum: 3 },
        explanationKey: 'result.summary.committee-credibility',
      }
    : {
        ...outputForSessionForm(context, 1, 'summary'),
        effects: { districtTrust: 3 },
        explanationKey: 'result.summary.district-relevance',
      };
};

const draftProvision: PatternResolver = (context) => ({
  ...outputForSessionForm(context, 2, 'drafted'),
  effects: { billMomentum: 2 },
  explanationKey: 'result.provision.drafted',
});

const answerOfficeConcern: PatternResolver = (context) => {
  if (validatePatternPreflight(context.match, context.inputs)) {
    throw new Error('Office-concern work requires the authored concern for that recipient office');
  }
  return {
    ...outputForSessionForm(context, 1, 'prepared'),
    effects: { billMomentum: 1 },
    explanationKey: 'result.evidence.office-concern-answered',
  };
};

const prepareEvidencePacket: PatternResolver = (context) => ({
  ...outputForSessionForm(context, 1, 'prepared'),
  effects: { districtTrust: 2 },
  explanationKey: 'result.evidence.district-packet-prepared',
});

const resolveOutreach: PatternResolver = (context) => {
  const office = inputForSlot(context, 1);
  const opposing = office.effectiveTags.includes('opposing-party');

  return opposing
    ? {
        definitionId: requireOutputId(context.parameters),
        effects: { billMomentum: 1, policyIntegrity: -1 },
        explanationKey: 'result.outreach.counteroffer',
      }
    : {
        definitionId: requireOutputId(context.parameters),
        effects: { billMomentum: 2 },
        explanationKey: 'result.outreach.support',
      };
};

const strengthenProvision: PatternResolver = (context) => ({
  definitionId: requireOutputId(context.parameters),
  effects: { policyIntegrity: 2 },
  explanationKey: 'result.provision.strengthened',
});

const prepareDistrictResponse: PatternResolver = (context) => ({
  ...outputForSessionForm(context, parameterSlot(context, 1), 'prepared'),
  effects: { districtTrust: 2 },
  explanationKey: 'result.constituency.response-prepared',
});

const prepareCommitteePacket: PatternResolver = (context) => ({
  ...outputForSessionForm(context, parameterSlot(context, 1), 'prepared'),
  effects: { billMomentum: 2 },
  explanationKey: 'result.institution.committee-packet-prepared',
});

const prepareDistrictEndorsement: PatternResolver = (context) => ({
  ...outputForSessionForm(context, parameterSlot(context, 1), 'prepared'),
  effects: { districtTrust: 3, billMomentum: 1 },
  explanationKey: 'result.constituency.endorsement-earned',
});

const preparePoliticalAsset: PatternResolver = (context) => ({
  ...outputForSessionForm(context, parameterSlot(context, 1), 'prepared'),
  effects: { billMomentum: 1 },
  explanationKey: 'result.political.asset-prepared',
});

const reviewProvision: PatternResolver = (context) => ({
  ...outputForSessionForm(context, parameterSlot(context, 1), 'drafted'),
  effects: { billMomentum: 2 },
  explanationKey: 'result.provision.reviewed',
});

export const DERIVED_RESOLVERS: Record<DerivedResolverId, PatternResolver> = {
  'summarize-evidence-v1': summarizeEvidence,
  'draft-provision-v1': draftProvision,
  'answer-office-concern-v1': answerOfficeConcern,
  'prepare-evidence-packet-v1': prepareEvidencePacket,
  'resolve-outreach-v1': resolveOutreach,
  'strengthen-provision-v1': strengthenProvision,
  'prepare-district-response-v1': prepareDistrictResponse,
  'prepare-committee-packet-v1': prepareCommitteePacket,
  'prepare-district-endorsement-v1': prepareDistrictEndorsement,
  'prepare-political-asset-v1': preparePoliticalAsset,
  'review-provision-v1': reviewProvision,
};

export function resolvePatternOutput(
  match: PatternMatch,
  inputs: MatchInput[],
): ResolvedPatternOutput {
  const output = match.pattern.output;

  if (output.mode === 'fixed') {
    return {
      definitionId: output.definitionId,
      effects: {},
      explanationKey: `result.fixed.${output.definitionId}`,
    };
  }

  const resolver = DERIVED_RESOLVERS[output.resolverId];
  if (!resolver) {
    // Unreachable under the TypeScript contract; runtime schema validation rejects
    // an unknown resolver ID before a scenario is ever published.
    throw new Error(`Unknown derived resolver "${output.resolverId}"`);
  }

  return resolver({ match, inputs, parameters: output.parameters ?? {} });
}
