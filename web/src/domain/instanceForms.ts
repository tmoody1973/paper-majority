import type { MatchInput } from '@/domain/recipes';
import type { CardInstance, Citation, PolicyCardDefinition, ScenarioDefinition } from '@/domain/types';

function uniqueCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.url}|${citation.retrievedAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Resolve an instance's playable form without changing its public catalog record.
 * Source lineage lives on the instance, so two summaries of one definition can
 * retain different evidence histories while still sharing the same definition.
 */
export function effectiveCard(
  instance: CardInstance,
  scenario: ScenarioDefinition,
): MatchInput {
  const definition = scenario.cards.find((card) => card.id === instance.definitionId);
  if (!definition) throw new Error(`Scenario has no card definition "${instance.definitionId}"`);

  if (instance.form === 'summary' && definition.kind !== 'evidence') {
    throw new Error('Only Evidence instances can be summaries');
  }
  if (instance.form === 'drafted' && definition.kind !== 'policy') {
    throw new Error('Only Policy instances can be drafted');
  }
  if (instance.form === 'prepared' && !['evidence', 'constituency', 'institution', 'political'].includes(definition.kind)) {
    throw new Error('Only Evidence, Constituency, Institution, or Political instances can be prepared');
  }

  const sourceDefinitionIds = instance.sourceDefinitionIds.length > 0
    ? [...instance.sourceDefinitionIds]
    : definition.kind === 'evidence'
      ? [definition.id]
      : [];
  const sourceDefinitions = sourceDefinitionIds.map((id) => {
    const source = scenario.cards.find((card) => card.id === id);
    if (!source) throw new Error(`Scenario has no source definition "${id}"`);
    return source;
  });

  const policyDefinitionId = instance.policyDefinitionId ??
    (definition.kind === 'policy' ? definition.id : undefined);
  let policyDefinition: PolicyCardDefinition | undefined;
  if (policyDefinitionId) {
    const candidate = scenario.cards.find((card) => card.id === policyDefinitionId);
    if (!candidate || candidate.kind !== 'policy') {
      throw new Error(`Scenario has no policy definition "${policyDefinitionId}"`);
    }
    policyDefinition = candidate;
  }

  const formTags: string[] = instance.form === 'raw' ? [] : [instance.form];
  if (instance.form === 'summary') formTags.push('evidence-summary');

  const effectiveSourceClass = instance.form === 'drafted'
    ? 'simulated'
    : instance.form === 'summary' || (instance.form === 'prepared' && definition.kind === 'evidence')
      ? 'derived'
      : instance.form === 'prepared'
        ? 'simulated'
      : definition.sourceClass;
  const provenanceDefinitions = policyDefinition
    ? [...sourceDefinitions, policyDefinition]
    : sourceDefinitions.length > 0
      ? sourceDefinitions
      : [definition];
  const citations = uniqueCitations(
    provenanceDefinitions.flatMap((source) => source.citations),
  );
  const precedentIds = policyDefinition ? [...policyDefinition.precedentIds] : [];
  const label = instance.form === 'drafted'
    ? `Simulated proposed bill language based on ${policyDefinition?.title ?? definition.title}`
    : instance.form === 'summary'
      ? `Derived summary of ${sourceDefinitions.map((source) => source.title).join(', ')}`
      : instance.form === 'prepared' && definition.kind === 'evidence'
        ? `Prepared from ${sourceDefinitions.map((source) => source.title).join(', ') || definition.title}`
        : instance.form === 'prepared'
          ? 'Simulated support or strategy artifact prepared during this run'
        : definition.sourceClass === 'simulated'
          ? 'Simulated scenario content'
          : 'Published source material';

  return {
    instanceId: instance.id,
    definition,
    effectiveTags: Array.from(new Set([...definition.tags, ...formTags])),
    effectiveSourceClass,
    form: instance.form,
    provenance: {
      label,
      sourceClass: effectiveSourceClass,
      sourceDefinitionIds,
      policyDefinitionId,
      explanationKey: instance.origin?.explanationKey,
      precedentIds,
      citations,
    },
  };
}
