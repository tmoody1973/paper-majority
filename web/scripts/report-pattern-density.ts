/**
 * Pattern-density report for the fun-first interaction gate.
 *
 * Enumerates every unordered two-to-four-card input set the fixture can form,
 * reports which ones the engine actually accepts before and after the Tactic
 * expansion, and exits nonzero unless the gate numbers hold: four base stacks and
 * five expanded ones.
 *
 * This counts DEFINITION sets, not instance sets — two copies of the same card
 * are the same recipe.
 */
import {
  getFixtureScenario,
  getStartingDefinitionIds,
} from '../src/content/fixtures/loadFixture';
import { analyzeCatalog, tacticSubsets } from '../src/content/catalogAnalysis';
import { getCandidateScenario } from '../src/content/loadScenario';
import { computeEffectiveTags, matchPattern } from '../src/domain/recipes';
import type { MatchInput } from '../src/domain/recipes';
import type { CardDefinition, Party } from '../src/domain/types';

const EXPECTED_BASE = 4;
const EXPECTED_EXPANDED = 5;
const PLAYER_PARTY: Party = 'democratic';

if (process.argv.includes('--mode') && process.argv[process.argv.indexOf('--mode') + 1] === 'session') {
  const session = getCandidateScenario();
  console.log('Paper Majority — Session pattern density');
  console.log(`snapshot: ${session.snapshotId}`);
  let failed = false;
  for (const party of ['democratic', 'republican'] as const) {
    const base = analyzeCatalog(session, party, []);
    console.log(`${party}: definition sets=${base.definitionSetCount}; theoretical slot/origin-compatible assignments=${base.formAwareMatchCount}; distinct outcomes=${base.distinctOutcomes.length}`);
    console.log(`  by pattern: ${Object.entries(base.byPattern).map(([id, count]) => `${id}=${count}`).join(', ')}`);
    console.log(`  by family: ${Object.entries(base.byFamilyCombination).map(([id, count]) => `${id}=${count}`).join(', ')}`);
    for (const subset of tacticSubsets(session)) {
      const analysis = analyzeCatalog(session, party, subset);
      if (analysis.collisions.length > 0) failed = true;
    }
    if (base.definitionSetCount < 50) failed = true;
  }
  if (failed) {
    console.error('FAIL: Session density/collision gate failed.');
    process.exit(1);
  }
  console.log(`PASS: all ${tacticSubsets(session).length} tactic subsets for both parties have zero equal-ranked collisions.`);
  process.exit(0);
}

const scenario = getFixtureScenario();
const startingIds = getStartingDefinitionIds();

interface AcceptedStack {
  definitionIds: string[];
  patternId: string;
  outputDefinitionId: string;
}

function toInput(definition: CardDefinition, index: number): MatchInput {
  return {
    instanceId: `probe-${String(index).padStart(3, '0')}`,
    definition,
    effectiveTags: computeEffectiveTags(definition, PLAYER_PARTY),
    effectiveSourceClass: definition.sourceClass,
    form: 'raw',
    provenance: {
      label: 'Pattern-density probe',
      sourceClass: definition.sourceClass,
      sourceDefinitionIds: definition.kind === 'evidence' ? [definition.id] : [],
      policyDefinitionId: definition.kind === 'policy' ? definition.id : undefined,
      precedentIds: definition.kind === 'policy' ? definition.precedentIds : [],
      citations: definition.citations,
    },
  };
}

function describeOutput(patternId: string): string {
  const pattern = scenario.patterns.find((candidate) => candidate.id === patternId);
  if (!pattern) return 'unknown';
  return pattern.output.mode === 'fixed'
    ? pattern.output.definitionId
    : String(pattern.output.parameters?.outputDefinitionId ?? pattern.output.resolverId);
}

/** Every unordered combination of the given size. */
function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...rest] = items;
  return [
    ...combinations(rest, size - 1).map((combo) => [head, ...combo]),
    ...combinations(rest, size),
  ];
}

function enumerate(activeExpansionIds: string[]): AcceptedStack[] {
  const accepted: AcceptedStack[] = [];
  let considered = 0;

  for (let size = 2; size <= 4; size += 1) {
    for (const combo of combinations(scenario.cards, size)) {
      considered += 1;
      const inputs = combo.map(toInput);
      const found = matchPattern(
        inputs,
        scenario.patterns,
        activeExpansionIds,
        scenario.tacticExpansions,
      );
      if (!found) continue;
      accepted.push({
        definitionIds: combo.map((card) => card.id),
        patternId: found.pattern.id,
        outputDefinitionId: describeOutput(found.pattern.id),
      });
    }
  }

  totalConsidered = considered;
  return accepted;
}

let totalConsidered = 0;

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const bucket = grouped.get(key(item)) ?? [];
    bucket.push(item);
    grouped.set(key(item), bucket);
  }
  return grouped;
}

function print(title: string, stacks: AcceptedStack[]): void {
  console.log(`\n${title} — ${stacks.length} valid concrete stack(s)`);

  console.log('  by pattern:');
  for (const [patternId, group] of groupBy(stacks, (stack) => stack.patternId)) {
    console.log(`    ${patternId}: ${group.length}`);
    for (const stack of group) {
      console.log(`      ${stack.definitionIds.join('  +  ')}  ->  ${stack.outputDefinitionId}`);
    }
  }

  console.log('  by distinct output:');
  for (const [output, group] of groupBy(stacks, (stack) => stack.outputDefinitionId)) {
    console.log(`    ${output}: ${group.length}`);
  }

  const families = new Set(
    stacks.flatMap((stack) =>
      stack.definitionIds.map(
        (id) => scenario.cards.find((card) => card.id === id)?.kind ?? 'unknown',
      ),
    ),
  );
  console.log(`  families involved: ${[...families].sort().join(', ')}`);
}

const allExpansionIds = scenario.tacticExpansions.map((expansion) => expansion.id);

const base = enumerate([]);
const consideredCount = totalConsidered;
const expanded = enumerate(allExpansionIds);

console.log('Paper Majority — interaction-spike pattern density');
console.log(`snapshot:  ${scenario.snapshotId}`);
console.log(`player party used for relational tags: ${PLAYER_PARTY}`);
console.log(`starting definitions (pattern-bearing): ${startingIds.length}`);
console.log(`definitions in fixture (starting + produced + pressure): ${scenario.cards.length}`);
console.log(`authored patterns: ${scenario.patterns.length}`);
console.log(`tactic expansions: ${scenario.tacticExpansions.length}`);
console.log(`unordered 2–4 card sets considered: ${consideredCount}`);

print('BASE (no Tactic studied)', base);
print('EXPANDED (Bipartisan Working Group studied)', expanded);

const baseKeys = new Set(base.map((stack) => stack.definitionIds.join('+')));
const newlyValid = expanded.filter((stack) => !baseKeys.has(stack.definitionIds.join('+')));
console.log('\nnewly valid after the Tactic:');
for (const stack of newlyValid) {
  console.log(`  ${stack.definitionIds.join('  +  ')}  ->  ${stack.outputDefinitionId}`);
}

const problems: string[] = [];
if (base.length !== EXPECTED_BASE) {
  problems.push(`expected ${EXPECTED_BASE} base stacks, found ${base.length}`);
}
if (expanded.length !== EXPECTED_EXPANDED) {
  problems.push(`expected ${EXPECTED_EXPANDED} expanded stacks, found ${expanded.length}`);
}
if (scenario.patterns.length !== 3) {
  problems.push(`expected exactly 3 authored patterns, found ${scenario.patterns.length}`);
}
if (startingIds.length !== 8) {
  problems.push(`expected 8 starting definitions, found ${startingIds.length}`);
}

// No pattern may name an exact input card ID; that would be a recipe, not a rule.
const authoredSlots = JSON.stringify(scenario.patterns.map((pattern) => pattern.slots));
for (const card of scenario.cards) {
  if (authoredSlots.includes(`"${card.id}"`)) {
    problems.push(`pattern slots name the exact card id "${card.id}"`);
  }
}

console.log('');
if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL: ${problem}`);
  process.exit(1);
}

console.log(`PASS: ${base.length} base and ${expanded.length} expanded valid concrete stacks.`);
