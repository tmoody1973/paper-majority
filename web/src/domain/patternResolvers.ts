import type { MatchInput, PatternMatch } from '@/domain/recipes';
import type { DerivedResolverId, Resources } from '@/domain/types';

export interface ResolvedPatternOutput {
  definitionId: string;
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

function inputForSlot(context: ResolverContext, slotIndex: number): MatchInput {
  const assignment = context.match.assignments.find((a) => a.slotIndex === slotIndex);
  const definitionId = assignment?.cardDefinitionIds[0];
  const found = context.inputs.find((input) => input.definition.id === definitionId);
  if (!found) throw new Error(`Resolver could not find the card assigned to slot ${slotIndex}`);
  return found;
}

const summarizeEvidence: PatternResolver = (context) => {
  const evidence = inputForSlot(context, 1);

  // The card chosen still matters. An official record buys committee credibility;
  // a derived local survey buys district relevance.
  return evidence.definition.sourceClass === 'official'
    ? {
        definitionId: requireOutputId(context.parameters),
        effects: { billMomentum: 3 },
        explanationKey: 'result.summary.committee-credibility',
      }
    : {
        definitionId: requireOutputId(context.parameters),
        effects: { districtTrust: 3 },
        explanationKey: 'result.summary.district-relevance',
      };
};

const draftProvision: PatternResolver = (context) => ({
  definitionId: requireOutputId(context.parameters),
  effects: { billMomentum: 2 },
  explanationKey: 'result.provision.drafted',
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
