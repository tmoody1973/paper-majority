import type { MatchInput, PatternMatch } from '@/domain/recipes';
import type { DerivedResolverId, InstanceForm, Resources } from '@/domain/types';

export interface ResolvedPatternOutput {
  definitionId: string;
  form?: InstanceForm;
  effects: Partial<Resources>;
  explanationKey: string;
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

function outputForSessionForm(
  context: ResolverContext,
  slotIndex: number,
  form: InstanceForm,
): Pick<ResolvedPatternOutput, 'definitionId' | 'form'> {
  if (context.parameters.preserveInputDefinition === true) {
    return { definitionId: inputForSlot(context, slotIndex).definition.id, form };
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
  const office = inputForSlot(context, 2);
  const concern = inputForSlot(context, 3);
  if (
    concern.definition.kind !== 'constituency' ||
    !concern.definition.authoredConcern ||
    concern.definition.authoredConcern.recipientOfficeDefinitionId !== office.definition.id
  ) {
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

export const DERIVED_RESOLVERS: Record<DerivedResolverId, PatternResolver> = {
  'summarize-evidence-v1': summarizeEvidence,
  'draft-provision-v1': draftProvision,
  'answer-office-concern-v1': answerOfficeConcern,
  'prepare-evidence-packet-v1': prepareEvidencePacket,
  'resolve-outreach-v1': resolveOutreach,
  'strengthen-provision-v1': strengthenProvision,
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
