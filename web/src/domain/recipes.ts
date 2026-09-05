import type {
  CardDefinition,
  CardInstance,
  Party,
  RecipePattern,
  RecipeSlot,
  ProcedureStage,
  ScenarioDefinition,
  TacticExpansionDefinition,
  InstanceForm,
  SourceClass,
  Citation,
} from '@/domain/types';
import { effectiveCard } from '@/domain/instanceForms';

export interface MatchInput {
  instanceId: string;
  definition: CardDefinition;
  effectiveTags: string[];
  effectiveSourceClass: SourceClass;
  form: InstanceForm;
  provenance: {
    label: string;
    sourceClass: SourceClass;
    sourceDefinitionIds: string[];
    policyDefinitionId?: string;
    precedentIds: string[];
    citations: Citation[];
  };
}

export interface PatternSlotAssignment {
  slotIndex: number;
  cardDefinitionIds: string[];
  /** The exact cards that filled this slot, so the engine knows what survives. */
  cardInstanceIds: string[];
}

export interface PatternMatch {
  pattern: RecipePattern;
  /** Fully resolved rule snapshot used by preview, start, and completion. */
  effectivePattern: RecipePattern;
  assignments: PatternSlotAssignment[];
  specificity: number;
  activeExpansionIds: string[];
  /** The slots actually used for matching, after any active widen-slot expansion. */
  effectiveSlots: RecipeSlot[];
}

/**
 * Relational tags are computed, never authored.
 *
 * `same-party` / `opposing-party` describe the relationship between the player's
 * simulated affiliation and a member office's official public-record party. They
 * are derived on every match so the same card behaves correctly for either player
 * party, and so no published card ever stores a claim about a relationship.
 */
export function computeEffectiveTags(definition: CardDefinition, playerParty: Party): string[] {
  if (definition.kind !== 'coalition') return [...definition.tags];
  if (!definition.officialRecord.party) return [...definition.tags];
  const relation = definition.officialRecord.party === playerParty ? 'same-party' : 'opposing-party';
  return [...definition.tags, relation];
}

export function buildMatchInputs(
  instances: CardInstance[],
  scenario: ScenarioDefinition,
  playerParty: Party,
): MatchInput[] {
  return instances
    .map((instance) => {
      const input = effectiveCard(instance, scenario);
      return {
        ...input,
        effectiveTags: Array.from(
          new Set([...input.effectiveTags, ...computeEffectiveTags(input.definition, playerParty)]),
        ),
      };
    })
    // Stable instance-id ordering keeps assignment (and therefore replay) deterministic.
    .sort((a, b) => (a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0));
}

function slotAccepts(slot: RecipeSlot, input: MatchInput): boolean {
  if (slot.kind && input.definition.kind !== slot.kind) return false;
  if (slot.requiredTags?.some((tag) => !input.effectiveTags.includes(tag))) return false;
  if (slot.anyTags && !slot.anyTags.some((tag) => input.effectiveTags.includes(tag))) return false;
  if (slot.sourceClasses && !slot.sourceClasses.includes(input.effectiveSourceClass)) return false;
  if (slot.forms && !slot.forms.includes(input.form)) return false;
  return true;
}

/**
 * Apply every active `widen-slot` expansion that targets this pattern.
 *
 * Widening may only ever append accepted alternatives. There is no code path that
 * deletes a `kind`, a `requiredTags` entry or an existing alternative.
 */
export function effectiveRule(
  pattern: RecipePattern,
  activeExpansionIds: string[],
  expansions: TacticExpansionDefinition[],
): { pattern: RecipePattern; appliedExpansionIds: string[] } {
  const applicable = expansions.filter(
    (expansion) =>
      expansion.targetPatternId === pattern.id &&
      activeExpansionIds.includes(expansion.id),
  ).sort((a, b) => a.id.localeCompare(b.id));

  const slots = pattern.slots.map((slot) => ({ ...slot }));
  const applied: string[] = [];
  const resourceCost = { ...pattern.resourceCost };
  let duration = pattern.durationMs;
  let eligibleStages = pattern.eligibleStages ? [...pattern.eligibleStages] : undefined;

  for (const expansion of applicable) {
    const effect = expansion.effect;
    if (effect.kind === 'widen-slot') {
      const slot = slots[effect.slotIndex];
      if (!slot) continue;
      if (effect.addAnyTags?.length) {
        slot.anyTags = Array.from(new Set([...(slot.anyTags ?? []), ...effect.addAnyTags]));
      }
      if (effect.addSourceClasses?.length) {
        slot.sourceClasses = Array.from(
          new Set([...(slot.sourceClasses ?? []), ...effect.addSourceClasses]),
        );
      }
    } else if (effect.kind === 'resource-cost') {
      resourceCost[effect.resource] = Math.max(0, (resourceCost[effect.resource] ?? 0) + effect.delta);
    } else if (effect.kind === 'duration-multiplier') {
      duration *= effect.multiplier;
    } else if (effect.kind === 'procedure-eligibility') {
      // An unrestricted authored rule is already eligible everywhere. Validation
      // rejects that no-op; this guard keeps hand-built fixtures honest too.
      if (!eligibleStages) continue;
      if (eligibleStages.includes(effect.stage)) continue;
      eligibleStages = Array.from(new Set([...eligibleStages, effect.stage]));
    } else {
      // Session validation rejects output-strength. The legacy spike retains the
      // authored expansion but it has no resolver meaning here.
      continue;
    }
    applied.push(expansion.id);
  }

  return {
    pattern: {
      ...pattern,
      slots,
      eligibleStages,
      resourceCost,
      durationMs: Math.max(1, Math.round(duration)),
    },
    appliedExpansionIds: applied,
  };
}

/** Backwards-compatible slot view for existing callers. */
export function applyExpansions(
  pattern: RecipePattern,
  activeExpansionIds: string[],
  expansions: TacticExpansionDefinition[],
): { slots: RecipeSlot[]; appliedExpansionIds: string[] } {
  const effective = effectiveRule(pattern, activeExpansionIds, expansions);
  return { slots: effective.pattern.slots, appliedExpansionIds: effective.appliedExpansionIds };
}

/**
 * Specificity is read off the AUTHORED slots, never the widened ones, and never the
 * inputs. Adding another accepted alternative to an `anyTags` or `sourceClasses`
 * list widens a rule, so it must not make that rule win more often.
 */
function specificityTuple(pattern: RecipePattern): [number, number, number] {
  let families = 0;
  let tags = 0;
  let sourceClasses = 0;

  for (const slot of pattern.slots) {
    if (slot.kind) families += 1;
    tags += slot.requiredTags?.length ?? 0;
    if (slot.anyTags?.length) tags += 1;
    if (slot.sourceClasses?.length) sourceClasses += 1;
  }

  return [families, tags, sourceClasses];
}

/**
 * Assign inputs to slot units.
 *
 * A pattern declares two to four total inputs, so an exhaustive bounded search is
 * both correct and cheap. Each card fills at most one unit, `quantity` consumes
 * that many distinct cards, and every input must be consumed — a stack matches a
 * pattern exactly or not at all.
 */
function assign(slots: RecipeSlot[], inputs: MatchInput[]): PatternSlotAssignment[] | undefined {
  const units: number[] = [];
  slots.forEach((slot, slotIndex) => {
    for (let n = 0; n < slot.quantity; n += 1) units.push(slotIndex);
  });

  if (units.length !== inputs.length) return undefined;

  const used = new Array<boolean>(inputs.length).fill(false);
  const chosen = new Array<number>(units.length).fill(-1);

  function place(unitIndex: number): boolean {
    if (unitIndex === units.length) return true;
    const slot = slots[units[unitIndex]];

    for (let i = 0; i < inputs.length; i += 1) {
      if (used[i]) continue;
      if (!slotAccepts(slot, inputs[i])) continue;
      used[i] = true;
      chosen[unitIndex] = i;
      if (place(unitIndex + 1)) return true;
      used[i] = false;
      chosen[unitIndex] = -1;
    }
    return false;
  }

  if (!place(0)) return undefined;

  return slots.map((_, slotIndex) => {
    const filled = units
      .map((owner, unitIndex) => (owner === slotIndex ? inputs[chosen[unitIndex]] : undefined))
      .filter((input): input is MatchInput => input !== undefined);
    return {
      slotIndex,
      cardDefinitionIds: filled.map((input) => input.definition.id),
      cardInstanceIds: filled.map((input) => input.instanceId),
    };
  });
}

/**
 * The pure matcher. No randomness, no clock, no I/O.
 *
 * Candidates are ranked by authored specificity, then authored priority, then
 * stable pattern ID. The ID tie-break exists so a run never becomes nondeterministic;
 * it is not permission to publish an ambiguous catalog, which content validation
 * rejects.
 */
export function matchPattern(
  inputs: MatchInput[],
  patterns: RecipePattern[],
  activeExpansionIds: string[],
  expansions: TacticExpansionDefinition[],
  stage?: ProcedureStage,
): PatternMatch | undefined {
  if (inputs.length < 2 || inputs.length > 4) return undefined;

  const ordered = [...inputs].sort((a, b) =>
    a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0,
  );

  const candidates: PatternMatch[] = [];

  for (const pattern of patterns) {
    const effective = effectiveRule(pattern, activeExpansionIds, expansions);
    if (stage && effective.pattern.eligibleStages && !effective.pattern.eligibleStages.includes(stage)) {
      continue;
    }
    const assignments = assign(effective.pattern.slots, ordered);
    if (!assignments) continue;

    const [families, tags, sourceClasses] = specificityTuple(pattern);
    candidates.push({
      pattern,
      effectivePattern: effective.pattern,
      assignments,
      specificity: families + tags + sourceClasses,
      activeExpansionIds: effective.appliedExpansionIds,
      effectiveSlots: effective.pattern.slots,
    });
  }

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => {
    const left = specificityTuple(a.pattern);
    const right = specificityTuple(b.pattern);
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return right[i] - left[i];
    }
    if (a.pattern.priority !== b.pattern.priority) return b.pattern.priority - a.pattern.priority;
    return a.pattern.id < b.pattern.id ? -1 : a.pattern.id > b.pattern.id ? 1 : 0;
  });

  return candidates[0];
}
