import { computeEffectiveTags, effectiveRule } from '@/domain/recipes';
import type {
  CardDefinition,
  InstanceForm,
  Party,
  RecipePattern,
  RecipeSlot,
  ScenarioDefinition,
} from '@/domain/types';

interface ConcreteInput {
  definition: CardDefinition;
  form: InstanceForm;
}

export interface CatalogCollision {
  inputKey: string;
  patternIds: string[];
  priority: number;
  specificity: string;
}

export interface CatalogAnalysis {
  definitionSetCount: number;
  formAwareMatchCount: number;
  distinctOutcomes: string[];
  byPattern: Record<string, number>;
  byFamilyCombination: Record<string, number>;
  collisions: CatalogCollision[];
}

function formsFor(definition: CardDefinition): InstanceForm[] {
  if (definition.kind === 'evidence') return definition.validForms ?? ['raw', 'summary', 'prepared'];
  if (definition.kind === 'policy') return ['raw', 'drafted', 'prepared'];
  if (definition.kind === 'constituency' || definition.kind === 'institution' || definition.kind === 'political') {
    return ['raw', 'prepared'];
  }
  return ['raw'];
}

function slotAccepts(slot: RecipeSlot, input: ConcreteInput, party: Party): boolean {
  const tags = computeEffectiveTags(input.definition, party);
  if (slot.kind && slot.kind !== input.definition.kind) return false;
  if (slot.requiredTags?.some((tag) => !tags.includes(tag))) return false;
  if (slot.anyTags && !slot.anyTags.some((tag) => tags.includes(tag))) return false;
  if (slot.sourceClasses && !slot.sourceClasses.includes(input.definition.sourceClass)) return false;
  if (slot.forms && !slot.forms.includes(input.form)) return false;
  return true;
}

function units(slots: RecipeSlot[]): RecipeSlot[] {
  return slots.flatMap((slot) => Array.from({ length: slot.quantity }, () => slot));
}

function specificity(pattern: RecipePattern): [number, number, number] {
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

function outputKey(pattern: RecipePattern): string {
  if (pattern.output.mode === 'fixed') return pattern.output.definitionId;
  const preserved = pattern.output.parameters?.preserveInputDefinition === true ? ':preserved-input' : '';
  return `${pattern.output.resolverId}${preserved}`;
}

function enumeratePattern(
  pattern: RecipePattern,
  slots: RecipeSlot[],
  cards: CardDefinition[],
  party: Party,
): Array<{ inputKey: string; definitionKey: string; familyKey: string }> {
  const possible = cards.flatMap((definition) =>
    formsFor(definition).map((form) => ({ definition, form })),
  );
  const slotUnits = units(slots);
  const results: Array<{ inputKey: string; definitionKey: string; familyKey: string }> = [];

  function semanticValid(chosen: ConcreteInput[]): boolean {
    if (pattern.output.mode !== 'derived' || pattern.output.resolverId !== 'answer-office-concern-v1') return true;
    const office = chosen.find((entry) => entry.definition.kind === 'coalition')?.definition;
    const concern = chosen.find((entry) => entry.definition.kind === 'constituency')?.definition;
    return concern?.kind === 'constituency'
      && concern.authoredConcern?.recipientOfficeDefinitionId === office?.id;
  }

  function visit(index: number, chosen: ConcreteInput[]): void {
    if (index === slotUnits.length) {
      if (!semanticValid(chosen)) return;
      const ordered = [...chosen].sort((a, b) => a.definition.id.localeCompare(b.definition.id));
      results.push({
        inputKey: ordered.map((entry) => `${entry.definition.id}@${entry.form}`).join('+'),
        definitionKey: ordered.map((entry) => entry.definition.id).join('+'),
        familyKey: ordered.map((entry) => entry.definition.kind).sort().join('+'),
      });
      return;
    }
    for (const input of possible) {
      if (chosen.some((entry) => entry.definition.id === input.definition.id)) continue;
      if (!slotAccepts(slotUnits[index], input, party)) continue;
      visit(index + 1, [...chosen, input]);
    }
  }
  visit(0, []);
  return Array.from(new Map(results.map((entry) => [entry.inputKey, entry])).values());
}

export function analyzeCatalog(
  scenario: ScenarioDefinition,
  party: Party,
  activeExpansionIds: string[],
): CatalogAnalysis {
  const matches = new Map<string, Array<{ pattern: RecipePattern; definitionKey: string; familyKey: string }>>();
  const byPattern: Record<string, number> = {};
  const outcomes = new Set<string>();
  for (const pattern of scenario.patterns) {
    const effective = effectiveRule(pattern, activeExpansionIds, scenario.tacticExpansions).pattern;
    const concrete = enumeratePattern(pattern, effective.slots, scenario.cards, party);
    byPattern[pattern.id] = new Set(concrete.map((entry) => entry.definitionKey)).size;
    if (concrete.length > 0) outcomes.add(outputKey(pattern));
    for (const entry of concrete) {
      const list = matches.get(entry.inputKey) ?? [];
      list.push({ pattern, definitionKey: entry.definitionKey, familyKey: entry.familyKey });
      matches.set(entry.inputKey, list);
    }
  }

  const collisions: CatalogCollision[] = [];
  for (const [inputKey, entries] of matches) {
    for (let left = 0; left < entries.length; left += 1) {
      for (let right = left + 1; right < entries.length; right += 1) {
        const a = entries[left].pattern;
        const b = entries[right].pattern;
        if (a.priority !== b.priority) continue;
        const aSpecificity = specificity(a);
        const bSpecificity = specificity(b);
        if (aSpecificity.some((value, index) => value !== bSpecificity[index])) continue;
        collisions.push({
          inputKey,
          patternIds: [a.id, b.id].sort(),
          priority: a.priority,
          specificity: aSpecificity.join('/'),
        });
      }
    }
  }
  const definitionSets = new Set<string>();
  const familyCounts = new Map<string, Set<string>>();
  for (const entries of matches.values()) {
    for (const entry of entries) {
      definitionSets.add(entry.definitionKey);
      const set = familyCounts.get(entry.familyKey) ?? new Set<string>();
      set.add(entry.definitionKey);
      familyCounts.set(entry.familyKey, set);
    }
  }
  return {
    definitionSetCount: definitionSets.size,
    formAwareMatchCount: matches.size,
    distinctOutcomes: [...outcomes].sort(),
    byPattern,
    byFamilyCombination: Object.fromEntries([...familyCounts].sort().map(([key, value]) => [key, value.size])),
    collisions,
  };
}

export function tacticSubsets(scenario: ScenarioDefinition): string[][] {
  const ids = scenario.tacticExpansions.map((entry) => entry.id).sort();
  return Array.from({ length: 2 ** ids.length }, (_, mask) =>
    ids.filter((_, index) => (mask & (1 << index)) !== 0),
  );
}
