import { computeEffectiveTags } from '@/domain/recipes';
import type {
  CardKind,
  Resources,
  ScenarioDefinition,
  SourceClass,
  TermState,
} from '@/domain/types';

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
  /**
   * Present when a card claims a real record but ships no citation.
   *
   * The vertical slice has no source manifest yet, so its "official" cards stand
   * in for documents rather than pointing at them. Saying so is the only honest
   * option: inventing a citation to fill the gap is forbidden, and staying silent
   * lets a tester believe the card is sourced.
   */
  practicePlaceholderNote?: string;
  /**
   * What using this card actually costs, from the rules the player has discovered.
   *
   * Cost belongs to the action, not the card. A per-card number could only ever be
   * one guess: member offices carried "workload: 1" and read "Uses 1 staffer",
   * while outreach spends Political Capital and no Staff Attention at all.
   *
   * Empty until a rule is discovered — a cost for a rule the player has not found
   * would give the rule away.
   */
  costs: CardCost[];
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
 * One cost, said twice: short enough for the card face, and long enough on the
 * inspector to answer the question decision 003 left open — a player looking at a
 * cost cannot otherwise tell that Staff Attention comes back and Political
 * Capital does not.
 */
export interface CardCost {
  short: string;
  long: string;
}

const COST_PHRASES: Partial<
  Record<keyof Resources, (amount: number) => CardCost>
> = {
  staffAttention: (amount) => ({
    short: `Ties up ${amount} staffer${amount === 1 ? '' : 's'}`,
    long: `Ties up ${amount} staffer${amount === 1 ? '' : 's'} while the work runs. You get them back when it finishes.`,
  }),
  politicalCapital: (amount) => ({
    short: `Spends ${amount} political capital`,
    long: `Spends ${amount} political capital. That is really spent — it does not come back.`,
  }),
};

function describeCost(cost: Partial<Resources>): CardCost[] {
  return (Object.entries(cost) as [keyof Resources, number][])
    .filter(([, amount]) => amount > 0)
    .map(([resource, amount]) => COST_PHRASES[resource]?.(amount))
    .filter((phrase): phrase is CardCost => phrase !== undefined);
}

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
  const costs: CardCost[] = [];
  const seenCosts = new Set<string>();
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

    for (const cost of describeCost(pattern.resourceCost)) {
      if (seenCosts.has(cost.short)) continue;
      seenCosts.add(cost.short);
      costs.push(cost);
    }
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
    practicePlaceholderNote:
      definition.sourceClass !== 'simulated' && (definition.citations?.length ?? 0) === 0
        ? 'Practice card. It stands in for a real document, and no source is on file for it — nothing here is a citation.'
        : undefined,
    costs,
    knownUses,
    noUsesYetNote:
      knownUses.length === 0
        ? 'Your office has not found a use for this yet. Try it with something — a combination that does not work costs you nothing.'
        : undefined,
  };
}
