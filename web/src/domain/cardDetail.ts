import { computeEffectiveTags } from '@/domain/recipes';
import type { CardKind, ScenarioDefinition, SourceClass, TermState } from '@/domain/types';

/**
 * What the inspector is allowed to say about one card.
 *
 * Two rules govern this. Facts and simulation stay apart — anything invented for the
 * run is labelled, and a calculated value says it was calculated. And discovery is
 * never leaked: a card advertises a use only once the player has already completed
 * that rule, so the inspector can never become a recipe book.
 */
export interface CardDetail {
  definitionId: string;
  title: string;
  familyLabel: string;
  sourceLabel: 'Official record' | 'Based on records' | 'Simulated';
  contextualSubtitle?: string;
  plainLanguage?: string;
  /** Present only for simulated content. */
  simulatedNote?: string;
  /** One plain line explaining the information class, whatever it is. */
  sourceExplainer: string;
  workload: number;
  /** Uses the player has already discovered. Never anything they have not. */
  knownUses: string[];
  noUsesYetNote?: string;
}

const FAMILY_LABELS: Record<CardKind, string> = {
  staff: 'Staff',
  policy: 'Policy',
  evidence: 'Evidence',
  coalition: 'Coalition',
  constituency: 'Constituency',
  institution: 'Institution',
  political: 'Political',
  tactic: 'Tactic',
};

const SOURCE_LABELS: Record<SourceClass, CardDetail['sourceLabel']> = {
  official: 'Official record',
  derived: 'Based on records',
  simulated: 'Simulated',
};

/**
 * The label alone is not enough, so never show one without this.
 *
 * The three read as a ladder of distance from the source: the record itself, then
 * something built from it, then something invented for the run.
 */
const SOURCE_EXPLAINERS: Record<SourceClass, string> = {
  official: 'Real public information, from a real source.',
  derived: 'Worked out or summarised from real information. A summary, not a direct quote.',
  simulated: 'Invented for your run. Not a claim about anyone real.',
};

export function describeCard(
  state: TermState,
  scenario: ScenarioDefinition,
  cardId: string,
): CardDetail | undefined {
  const instance = state.cards.find((card) => card.id === cardId);
  if (!instance) return undefined;

  const definition = scenario.cards.find((card) => card.id === instance.definitionId);
  if (!definition) return undefined;

  const effectiveTags = computeEffectiveTags(definition, state.player.party);

  // Which discovered rules can this card actually take part in?
  const knownUses: string[] = [];
  for (const pattern of scenario.patterns) {
    if (!state.discoveredPatternIds.includes(pattern.id)) continue;

    const activeIds = state.unlockedSlotExpansions[pattern.id] ?? [];
    const slots = pattern.slots.map((slot, index) => {
      let widened = { ...slot };
      for (const expansion of scenario.tacticExpansions) {
        if (!activeIds.includes(expansion.id)) continue;
        if (expansion.effect.kind !== 'widen-slot') continue;
        if (expansion.effect.slotIndex !== index) continue;
        widened = {
          ...widened,
          anyTags: Array.from(
            new Set([...(widened.anyTags ?? []), ...(expansion.effect.addAnyTags ?? [])]),
          ),
        };
      }
      return widened;
    });

    const fits = slots.some((slot) => {
      if (slot.kind && slot.kind !== definition.kind) return false;
      if (slot.requiredTags?.some((tag) => !effectiveTags.includes(tag))) return false;
      if (slot.anyTags && !slot.anyTags.some((tag) => effectiveTags.includes(tag))) return false;
      if (slot.sourceClasses && !slot.sourceClasses.includes(definition.sourceClass)) return false;
      return true;
    });
    if (!fits) continue;

    const outputId =
      pattern.output.mode === 'fixed'
        ? pattern.output.definitionId
        : (pattern.output.parameters?.outputDefinitionId as string | undefined);
    const outputTitle = scenario.cards.find((card) => card.id === outputId)?.title ?? 'a new card';

    knownUses.push(`Part of a rule your office knows: it helps make ${outputTitle}.`);
  }

  return {
    definitionId: definition.id,
    title: definition.title,
    familyLabel: FAMILY_LABELS[definition.kind],
    sourceLabel: SOURCE_LABELS[definition.sourceClass],
    contextualSubtitle: definition.contextualSubtitle,
    plainLanguage: definition.plainLanguage,
    simulatedNote:
      definition.sourceClass === 'simulated'
        ? 'In this simulation. This exists only inside your run — it is not a claim about anyone real.'
        : undefined,
    sourceExplainer: SOURCE_EXPLAINERS[definition.sourceClass],
    workload: definition.workload,
    knownUses,
    noUsesYetNote:
      knownUses.length === 0
        ? 'Your office has not found a use for this yet. Try it with something — a combination that does not work costs you nothing.'
        : undefined,
  };
}
