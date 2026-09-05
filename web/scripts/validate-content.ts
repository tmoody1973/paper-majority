import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { analyzeCatalog, tacticSubsets, type CatalogAnalysis } from '../src/content/catalogAnalysis';
import candidate from '../src/content/housing/vertical-slice.candidate.json';
import manifest from '../src/content/housing/manifest.json';
import sourceMap from '../src/content/housing/source-map.json';
import { parseScenario } from '../src/content/schema';
import { canonicalSha256 } from '../src/persistence/canonicalHash';
import type { GoverningValue, Party } from '../src/domain/types';

const failures: string[] = [];
const fail = (message: string) => failures.push(message);
const scenario = parseScenario(candidate);

async function fileSha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

const expectedKinds = {
  staff: 3,
  policy: 5,
  evidence: 5,
  coalition: 4,
  constituency: 4,
  institution: 3,
  political: 2,
  tactic: 4,
} as const;
for (const [kind, expected] of Object.entries(expectedKinds)) {
  const actual = scenario.cards.filter((card) => card.kind === kind).length;
  if (actual !== expected) fail(`${kind}: expected ${expected}, found ${actual}`);
}
const exactKindIds = (kind: 'staff' | 'policy' | 'coalition', expected: string[]) => {
  const actual = scenario.cards.filter((card) => card.kind === kind).map((card) => card.id).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    fail(`${kind} definition IDs do not match the bounded candidate contract.`);
  }
};
exactKindIds('staff', ['staff-policy-aide', 'staff-legislative-counsel', 'staff-district-director']);
exactKindIds('policy', [
  'policy-zoning-incentive',
  'policy-low-income-housing-tax-credit',
  'policy-housing-choice-voucher',
  'policy-rural-rental-preservation',
  'policy-tribal-housing-block-grant',
]);
exactKindIds('coalition', [
  'coalition-office-mike-flood',
  'coalition-office-j-french-hill',
  'coalition-office-maxine-waters',
  'coalition-office-emanuel-cleaver',
]);
if (scenario.cards.length !== 30) fail(`expected 30 playable definitions, found ${scenario.cards.length}`);
if (scenario.patterns.length !== 16) fail(`expected 16 patterns, found ${scenario.patterns.length}`);
if (scenario.tacticExpansions.length !== 4) fail(`expected 4 Tactic expansions, found ${scenario.tacticExpansions.length}`);
if (scenario.storyEvents.length !== 12) fail(`expected 12 Story events, found ${scenario.storyEvents.length}`);
for (const [klass, expected] of Object.entries({ opportunity: 3, pressure: 3, consequence: 3, recovery: 3 })) {
  const actual = scenario.storyEvents.filter((event) => event.class === klass).length;
  if (actual !== expected) fail(`Story ${klass}: expected ${expected}, found ${actual}`);
}
if (scenario.contentStatus?.status !== 'candidate' || scenario.contentStatus.humanReviewPending !== true) {
  fail('The local catalog must remain visibly candidate/human-review-pending.');
}

const governingValues: GoverningValue[] = [
  'Fiscal Stewardship', 'Local Control', 'Market Competition', 'Public Investment',
  'Tenant Stability', 'Housing Supply', 'Environmental Resilience', 'Fair Access',
];
const coveredValues = new Set(scenario.cards.flatMap((card) =>
  card.kind === 'policy' ? Object.keys(card.valueEffects) as GoverningValue[] : [],
));
for (const value of governingValues) if (!coveredValues.has(value)) fail(`Uncovered governing value: ${value}`);
if (scenario.houseModel.curatedMemberSeats !== 5
  || scenario.cards.filter((card) => card.kind === 'coalition').length !== 4
  || scenario.houseModel.anonymousSeats !== 430
  || scenario.houseModel.curatedMemberSeats + scenario.houseModel.anonymousSeats !== 435) {
  fail('House model must count 1 player + 4 curated offices + 430 anonymous seats = 435.');
}

const evidence = scenario.cards.filter((card) => card.kind === 'evidence');
for (const card of evidence) {
  if (!card.roleTags?.length || !card.validForms?.includes('raw') || !card.validForms.includes('summary')
    || !card.transformations?.length || !card.underlyingSourceIds?.length || !card.sinks?.length) {
    fail(`Evidence lineage/forms/sinks are incomplete: ${card.id}`);
  }
}
const threeUseEvidence = evidence.filter((card) =>
  card.sinks?.includes('drafting')
    && card.sinks.includes('office-concern')
    && card.sinks.includes('district-preparation')
    && card.sinks.includes('committee-preparation'),
);
if (threeUseEvidence.length < 3) fail(`expected at least 3 evidence definitions with competing uses, found ${threeUseEvidence.length}`);

const reachable = new Set(scenario.startingCardDefinitionIds);
for (const pack of scenario.weeklyPacks) {
  for (const id of pack.guaranteedDefinitionIds) reachable.add(id);
  for (const pool of pack.pools) {
    for (const option of pool.options) reachable.add(option.definitionId);
    for (const id of pool.fallbackDefinitionIds) reachable.add(id);
    if (new Set(pool.fallbackDefinitionIds).size < pool.drawCount) fail(`Pack fallback cannot satisfy drawCount: ${pool.id}`);
  }
}
for (const card of scenario.cards) if (!reachable.has(card.id)) fail(`Playable definition has no starting/pack path: ${card.id}`);
const earlyTactics = new Set(scenario.weeklyPacks
  .filter((pack) => pack.week <= 3)
  .flatMap((pack) => [
    ...pack.guaranteedDefinitionIds,
    ...pack.pools.flatMap((pool) => pool.options.map((option) => option.definitionId)),
  ])
  .filter((id) => scenario.cards.find((card) => card.id === id)?.kind === 'tactic'));
if (earlyTactics.size < 2) fail(`expected at least 2 Tactic offers by Week 3, found ${earlyTactics.size}`);

const authoredSlots = JSON.stringify(scenario.patterns.map((pattern) => pattern.slots));
for (const card of scenario.cards) if (authoredSlots.includes(`"${card.id}"`)) fail(`Pattern slot names exact definition ID: ${card.id}`);
for (const demand of scenario.demandDefinitions) {
  const demandChoices = demand.choiceIds
    .map((id) => scenario.decisionChoices.find((choice) => choice.id === id))
    .filter((choice) => choice !== undefined);
  const refusal = demandChoices.find((choice) => choice.action === 'reject');
  if (!refusal || refusal.requirements.length > 0) fail(`Demand lacks unconditional refusal: ${demand.id}`);
  for (const choice of demandChoices.filter((entry) => entry.action !== 'reject')) {
    const capital = choice.effects.flatMap((effect) =>
      effect.kind === 'resource' && effect.resource === 'politicalCapital' ? [effect.delta] : [],
    );
    const upfront = capital.filter((delta) => delta < 0).reduce((sum, delta) => sum + delta, 0);
    const deferred = capital.filter((delta) => delta > 0).reduce((sum, delta) => sum + delta, 0);
    if (upfront > -2 || deferred !== 1 || upfront + deferred >= 0) {
      fail(`Promise must cost at least 2 up front and reward exactly 1 once fulfilled: ${choice.id}`);
    }
    if (choice.effects.some((effect) => effect.kind === 'resource'
      && effect.delta > 0
      && effect.resource !== 'politicalCapital')) {
      fail(`Promise has an unsupported positive reward: ${choice.id}`);
    }
  }
}
if (!scenario.storyEvents.some((event) => event.class === 'recovery' && event.conditions.length === 0)) {
  fail('Story catalog lacks an unconditional recovery fallback.');
}
for (const event of scenario.storyEvents) {
  if (event.choices.length < 2 || !event.choices.some((choice) => choice.label.toLowerCase().includes('decline') || choice.label.toLowerCase().includes('accept'))) {
    fail(`Story event lacks an explicit fallback/refusal choice: ${event.id}`);
  }
}

const parties: Party[] = ['democratic', 'republican'];
const subsets = tacticSubsets(scenario);
const baseReports: Array<{ party: Party; analysis: CatalogAnalysis }> = [];
for (const party of parties) {
  for (const subset of subsets) {
    const analysis = analyzeCatalog(scenario, party, subset);
    if (analysis.collisions.length > 0) {
      fail(`${party}/${subset.join(',') || 'base'} has ${analysis.collisions.length} equal-ranked collision(s)`);
    }
    if (subset.length === 0) baseReports.push({ party, analysis });
  }
}
const density = Math.min(...baseReports.map((report) => report.analysis.definitionSetCount));
if (density < 50) fail(`expected at least 50 distinct unordered definition sets, found ${density}`);

const sourceIds = new Set(sourceMap.sources.map((source) => source.id));
const sourceUrls = new Set(sourceMap.sources.flatMap((source) => [
  source.url,
  'metadataUrl' in source ? source.metadataUrl : undefined,
  'humanReadableUrl' in source ? source.humanReadableUrl : undefined,
]).filter(Boolean));
for (const card of scenario.cards) {
  if (card.sourceClass !== 'simulated') {
    for (const citation of card.citations) if (!sourceUrls.has(citation.url)) fail(`Unmapped card citation: ${card.id} -> ${citation.url}`);
  }
  if (card.kind === 'policy') for (const id of card.precedentIds) if (!sourceIds.has(id)) fail(`Unmapped policy precedent: ${card.id} -> ${id}`);
  if (card.kind === 'evidence') for (const id of card.underlyingSourceIds ?? []) if (!sourceIds.has(id)) fail(`Unmapped evidence source: ${card.id} -> ${id}`);
}
const acs = sourceMap.sources.find((source) => source.id === 'acs-b25070-2024');
const acsGeographyIds = acs && 'geographyIds' in acs ? acs.geographyIds : undefined;
if (!acsGeographyIds || acsGeographyIds.length !== 6) fail('ACS source map must contain exactly six frozen district geography IDs.');
if (sourceMap.congressGovResources.length !== 0 || sourceMap.houseClerkRollCalls.length !== 0) {
  fail('This candidate makes no Congress.gov history or House roll-call claim; those maps must remain empty until reviewed records exist.');
}

async function finishValidation(): Promise<void> {
const stagedRoot = resolve(process.cwd(), '.ingest-staging/housing-2026-09-04-research-inputs');
const rawManifest = JSON.parse(await readFile(resolve(stagedRoot, 'research-input-manifest.json'), 'utf8')) as {
  files: Array<{ path: string; sha256: string }>;
};
const rawByName = new Map(rawManifest.files.map((entry) => [entry.path.replace(/^source-data\//, ''), entry]));
for (const source of sourceMap.sources) {
  for (const file of source.stagingFiles) {
    const raw = rawByName.get(file);
    if (!raw) {
      fail(`Mapped staged source is absent from the frozen manifest: ${file}`);
      continue;
    }
    const actual = await fileSha256(resolve(stagedRoot, 'source-data', file));
    if (actual !== raw.sha256) fail(`Frozen source checksum mismatch: ${file}`);
  }
}

const scenarioHash = canonicalSha256(scenario);
const sourceMapHash = canonicalSha256(sourceMap);
if (manifest.scenarioSha256 !== scenarioHash) fail(`Scenario manifest checksum mismatch: expected ${scenarioHash}`);
if (manifest.sourceMapSha256 !== sourceMapHash) fail(`Source-map manifest checksum mismatch: expected ${sourceMapHash}`);
if (!manifest.candidate || !manifest.humanReviewPending) fail('Manifest must retain candidate/human-review-pending status.');

console.log(`snapshot: ${scenario.snapshotId}`);
console.log(`status: ${scenario.contentStatus?.status}; humanReviewPending=${scenario.contentStatus?.humanReviewPending}`);
console.log(`definitions: ${scenario.cards.length}; patterns: ${scenario.patterns.length}; tactics: ${scenario.tacticExpansions.length}; events: ${scenario.storyEvents.length}`);
console.log(`definition sets: ${density}; form-aware matches: ${baseReports[0]?.analysis.formAwareMatchCount ?? 0}; distinct outcomes: ${baseReports[0]?.analysis.distinctOutcomes.length ?? 0}`);
console.log(`parties: ${parties.length}; tactic subsets: ${subsets.length}; collision states checked: ${parties.length * subsets.length}`);
console.log(`evidence with all four sinks: ${threeUseEvidence.length}; raw source checksums verified: ${rawByName.size}`);
console.log(`House accounting: 1 player + ${scenario.cards.filter((card) => card.kind === 'coalition').length} offices + ${scenario.houseModel.anonymousSeats} anonymous = ${scenario.houseModel.totalSeats}`);
console.log(`Congress.gov history sources mapped: ${sourceMap.congressGovResources.length}; House roll calls mapped: ${sourceMap.houseClerkRollCalls.length}`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: candidate catalog references, counts, reachability, collisions, source checksums, and manifest checksums are valid.');
}

finishValidation().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
