import type {
  CardKind,
  RecipeSlot,
  ScenarioDefinition,
  TermState,
} from '@/domain/types';

/**
 * Staff Handbook state, derived — never stored.
 *
 * All three states come from fields the pattern architecture already owns:
 * `discoveredPatternIds` and `unlockedSlotExpansions`. There is no unlock flag, no
 * second recipe list and nothing here that the engine does not already enforce.
 */
export type HandbookState = 'teased' | 'discovered' | 'expanded';

export interface HandbookSlotView {
  familyLabel: string;
  /** Player-language phrases for the tags this slot needs. Empty when it takes any card of the family. */
  requirements: string[];
  /** Alternatives added by an activated Tactic, shown separately from the base rule. */
  addedByTactic: string[];
  quantity: number;
}

export interface HandbookExample {
  definitionId: string;
  title: string;
}

export interface HandbookEntry {
  patternId: string;
  state: HandbookState;
  hint: string;
  outputDefinitionId?: string;
  outputTitle?: string;
  slots?: HandbookSlotView[];
  successfulExamples: HandbookExample[][];
  expansions: { id: string; note: string }[];
}

/**
 * A Tactic is not a recipe. Counting the two together made a binder with every
 * recipe found read as finished while a Tactic was still unlearned.
 */
export interface HandbookTacticView {
  id: string;
  title: string;
  learned: boolean;
  targetPatternId: string;
  /** The rule this Tactic widens, named the way the player sees it. */
  ruleLabel: string;
  /** What that rule accepts right now, in plain words. */
  currentlyAccepts: string[];
  /** What studying it would add. Empty once it is learned. */
  wouldAdd: string[];
  /** Who in the office is allowed to study it. */
  eligibleStaff: string[];
}

export interface HandbookView {
  entries: HandbookEntry[];
  discoveredCount: number;
  undiscoveredCount: number;
  totalCount: number;
  tactics: HandbookTacticView[];
  tacticsLearned: number;
  tacticsTotal: number;
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

/**
 * Turn a controlled tag into the phrase a player reads.
 *
 * The Handbook, the card subtitle and the engine constraint must always describe
 * the same rule, so this is the one place a tag becomes prose.
 */
const TAG_PHRASES: Record<string, string> = {
  'policy-focused': 'policy-focused',
  housing: 'about housing',
  'renter-focused': 'renter-focused',
  'working-bill': 'your working bill',
  'evidence-summary': 'already summarised',
  'same-party': 'shares your party',
  'opposing-party': 'from the other party',
  'housing-interest': 'interested in housing',
  'committee-relevant': 'on the committee',
  'rural-housing': 'focused on rural housing',
  'district-concern': 'raised by the district',
};

export function describeTag(tag: string): string {
  return TAG_PHRASES[tag] ?? tag.replace(/-/g, ' ');
}

function describeSlot(base: RecipeSlot, effective: RecipeSlot): HandbookSlotView {
  const requirements = [
    ...(base.requiredTags ?? []).map(describeTag),
    ...(base.anyTags?.length ? [(base.anyTags ?? []).map(describeTag).join(' or ')] : []),
    ...(base.sourceClasses?.length ? [base.sourceClasses.join(' or ')] : []),
  ];

  const addedAnyTags = (effective.anyTags ?? []).filter(
    (tag) => !(base.anyTags ?? []).includes(tag),
  );
  const addedSourceClasses = (effective.sourceClasses ?? []).filter(
    (sourceClass) => !(base.sourceClasses ?? []).includes(sourceClass),
  );

  return {
    familyLabel: base.kind ? FAMILY_LABELS[base.kind] : 'Any card',
    requirements,
    addedByTactic: [...addedAnyTags.map(describeTag), ...addedSourceClasses],
    quantity: base.quantity,
  };
}

/** Successful input combinations the player has actually completed, from the event log. */
function successfulExamples(
  state: TermState,
  scenario: ScenarioDefinition,
  patternId: string,
): HandbookExample[][] {
  const seen = new Set<string>();
  const examples: HandbookExample[][] = [];

  for (const event of state.eventLog) {
    if (event.type !== 'STACK_ACCEPTED' || event.patternId !== patternId) continue;
    const key = event.definitionIds.join('+');
    if (seen.has(key)) continue;
    seen.add(key);
    examples.push(
      event.definitionIds.map((definitionId) => ({
        definitionId,
        title:
          scenario.cards.find((card) => card.id === definitionId)?.title ?? definitionId,
      })),
    );
  }

  return examples;
}

export function buildHandbook(state: TermState, scenario: ScenarioDefinition): HandbookView {
  const entries: HandbookEntry[] = scenario.patterns.map((pattern) => {
    const discovered = state.discoveredPatternIds.includes(pattern.id);
    const activeIds = state.unlockedSlotExpansions[pattern.id] ?? [];
    const expansions = scenario.tacticExpansions
      .filter((expansion) => activeIds.includes(expansion.id))
      .map((expansion) => ({ id: expansion.id, note: expansion.expansionNote }));

    if (!discovered) {
      // Teased: one authored directional hint and nothing else. No exact inputs,
      // no output, and no leak of the other undiscovered rules.
      return {
        patternId: pattern.id,
        state: 'teased',
        hint: pattern.discoveryHint,
        successfulExamples: [],
        expansions: [],
      };
    }

    const effectiveSlots = pattern.slots.map((slot) => {
      let widened = { ...slot };
      for (const expansion of scenario.tacticExpansions) {
        if (!activeIds.includes(expansion.id)) continue;
        if (expansion.effect.kind !== 'widen-slot') continue;
        if (pattern.slots[expansion.effect.slotIndex] !== slot) continue;
        widened = {
          ...widened,
          anyTags: Array.from(
            new Set([...(widened.anyTags ?? []), ...(expansion.effect.addAnyTags ?? [])]),
          ),
          sourceClasses: Array.from(
            new Set([
              ...(widened.sourceClasses ?? []),
              ...(expansion.effect.addSourceClasses ?? []),
            ]),
          ),
        };
      }
      return widened;
    });

    const outputDefinitionId =
      pattern.output.mode === 'fixed'
        ? pattern.output.definitionId
        : (pattern.output.parameters?.outputDefinitionId as string | undefined);

    return {
      patternId: pattern.id,
      state: expansions.length > 0 ? 'expanded' : 'discovered',
      hint: pattern.discoveryHint,
      outputDefinitionId,
      outputTitle: scenario.cards.find((card) => card.id === outputDefinitionId)?.title,
      slots: pattern.slots.map((slot, index) => describeSlot(slot, effectiveSlots[index])),
      successfulExamples: successfulExamples(state, scenario, pattern.id),
      expansions,
    };
  });

  const discoveredCount = entries.filter((entry) => entry.state !== 'teased').length;
  const tactics = buildTactics(state, scenario);

  return {
    entries,
    discoveredCount,
    undiscoveredCount: entries.length - discoveredCount,
    totalCount: entries.length,
    tactics,
    tacticsLearned: tactics.filter((tactic) => tactic.learned).length,
    tacticsTotal: tactics.length,
  };
}

/**
 * What each Tactic changes, and whether it has changed it yet.
 *
 * Read from the same `unlockedSlotExpansions` the engine matches against, so the
 * binder can never claim a rule the desk would refuse.
 */
function buildTactics(state: TermState, scenario: ScenarioDefinition): HandbookTacticView[] {
  return scenario.tacticExpansions.map((expansion) => {
    const learned = (state.unlockedSlotExpansions[expansion.targetPatternId] ?? []).includes(
      expansion.id,
    );
    const pattern = scenario.patterns.find(
      (candidate) => candidate.id === expansion.targetPatternId,
    );
    const slot =
      expansion.effect.kind === 'widen-slot'
        ? pattern?.slots[expansion.effect.slotIndex]
        : undefined;

    const base = [
      ...(slot?.anyTags ?? []).map(describeTag),
      ...(slot?.sourceClasses ?? []),
    ];
    const added =
      expansion.effect.kind === 'widen-slot'
        ? [
            ...(expansion.effect.addAnyTags ?? []).map(describeTag),
            ...(expansion.effect.addSourceClasses ?? []),
          ]
        : [];

    return {
      id: expansion.id,
      title:
        scenario.cards.find((card) => card.id === expansion.tacticDefinitionId)?.title ??
        expansion.tacticDefinitionId,
      learned,
      targetPatternId: expansion.targetPatternId,
      ruleLabel:
        scenario.cards.find(
          (card) =>
            card.id ===
            (pattern?.output.mode === 'fixed'
              ? pattern.output.definitionId
              : (pattern?.output.parameters?.outputDefinitionId as string | undefined)),
        )?.title ?? expansion.targetPatternId,
      currentlyAccepts: learned ? [...base, ...added] : base,
      wouldAdd: learned ? [] : added,
      eligibleStaff: expansion.eligibleStaffTags.map(describeTag),
    };
  });
}
