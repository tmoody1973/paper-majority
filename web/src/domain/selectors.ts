import type {
  CardKind,
  Obligation,
  RecipeSlot,
  ScenarioDefinition,
  TermState,
} from '@/domain/types';
import { effectiveRule } from '@/domain/recipes';

/** Stable pending order for modal presentation and replay screenshots. */
export function nextPendingDecision(state: TermState) {
  return state.pendingDecisions
    .filter((decision) => decision.status === 'pending')
    .sort((a, b) => a.id.localeCompare(b.id))[0];
}

/** Stable, canonical order shared by the weekly review and filing cabinet. */
export function openObligations(state: TermState, mandatoryOnly = false): Obligation[] {
  return state.obligations
    .filter((obligation) => obligation.status === 'open')
    .filter((obligation) => !mandatoryOnly || obligation.mandatory)
    .sort((a, b) =>
      a.due.week - b.due.week
      || a.due.offsetMs - b.due.offsetMs
      || a.id.localeCompare(b.id),
    );
}

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
 * Whether a chosen pair of cards is a Tactic study the office can actually begin,
 * and if not, what to tell the player.
 *
 * The desk can only bounce a card. The keyboard panel can explain, so it does —
 * but both must agree with the engine, which is why the eligibility rules here
 * read the same `eligibleStaffTags` and `unlockedSlotExpansions` the engine
 * checks.
 */
export interface StudyOption {
  /** Is the chosen target a Tactic at all? */
  isTactic: boolean;
  canStudy: boolean;
  /** Plain-English reason the study cannot begin. Absent when it can. */
  blockedReason?: string;
}

export function describeStudyOption(
  state: TermState,
  scenario: ScenarioDefinition,
  staffCardId: string,
  tacticCardId: string,
): StudyOption {
  const staff = state.cards.find((card) => card.id === staffCardId);
  const tactic = state.cards.find((card) => card.id === tacticCardId);
  if (!staff || !tactic) return { isTactic: false, canStudy: false };

  const authoredExpansions = scenario.tacticExpansions.filter(
    (candidate) => candidate.tacticDefinitionId === tactic.definitionId,
  ).sort((a, b) => a.id.localeCompare(b.id));
  if (authoredExpansions.length === 0) return { isTactic: false, canStudy: false };

  const expansions = authoredExpansions.filter((expansion) =>
    !(state.unlockedSlotExpansions[expansion.targetPatternId] ?? []).includes(expansion.id));
  if (expansions.length === 0) {
    return { isTactic: true, canStudy: false, blockedReason: 'Your office has already learned this.' };
  }

  if (tactic.status !== 'idle') {
    return { isTactic: true, canStudy: false, blockedReason: 'That Tactic is already being studied.' };
  }

  const eligibleTags = Array.from(new Set(expansions.flatMap((expansion) => expansion.eligibleStaffTags)));
  const wanted = eligibleTags.map(describeTag).join(' or ');
  const onTheDesk = state.cards
    .filter((card) => {
      if (card.status !== 'idle') return false;
      const definition = scenario.cards.find((entry) => entry.id === card.definitionId);
      return (
        definition?.kind === 'staff' &&
        expansions.every((expansion) =>
          expansion.eligibleStaffTags.some((tag) => definition.tags.includes(tag)),
        )
      );
    })
    .map(
      (card) => scenario.cards.find((entry) => entry.id === card.definitionId)?.title ?? card.id,
    );
  const availability =
    onTheDesk.length > 0
      ? ` Free right now: ${Array.from(new Set(onTheDesk)).join(', ')}.`
      : ' Nobody in the office is free to take it on right now.';

  const staffDefinition = scenario.cards.find((entry) => entry.id === staff.definitionId);
  if (staffDefinition?.kind !== 'staff') {
    return {
      isTactic: true,
      canStudy: false,
      blockedReason: `A Tactic is studied by a staff card. This one needs a ${wanted} staffer.${availability}`,
    };
  }

  if (staff.status !== 'idle') {
    return {
      isTactic: true,
      canStudy: false,
      blockedReason: `That staffer is already working.${availability}`,
    };
  }

  if (!expansions.every((expansion) =>
    expansion.eligibleStaffTags.some((tag) => staffDefinition.tags.includes(tag)),
  )) {
    return {
      isTactic: true,
      canStudy: false,
      blockedReason: `This Tactic needs a ${wanted} staffer.${availability}`,
    };
  }

  if (state.resources.staffAttention < Math.max(...expansions.map((expansion) => expansion.studyCost))) {
    return {
      isTactic: true,
      canStudy: false,
      blockedReason: 'No staff attention is free for that right now.',
    };
  }

  return { isTactic: true, canStudy: true };
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

    const effective = effectiveRule(pattern, activeIds, scenario.tacticExpansions);
    const effectiveSlots = effective.pattern.slots;

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
