import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { getCandidateScenario } from '@/content/loadScenario';
import { DEFAULT_RUN_SETTINGS } from '@/domain/initialState';
import type { GoverningValue, Party, RunSettings, ScenarioDefinition } from '@/domain/types';
import { scenarioSnapshotHash } from '@/persistence/sessionIdentity';
import { POLICY_IDS, type PolicyId } from '@/../scripts/balance/policies';
import {
  RESOURCE_KEYS,
  runPolicy,
  type BalanceCommandExecutor,
  type BalanceRun,
  type BalanceSetup,
} from '@/../scripts/balance/metrics';

const VALUE_PAIRS: readonly (readonly [GoverningValue, GoverningValue])[] = [
  ['Tenant Stability', 'Housing Supply'],
  ['Fair Access', 'Local Control'],
  ['Public Investment', 'Fiscal Stewardship'],
  ['Housing Supply', 'Market Competition'],
  ['Environmental Resilience', 'Tenant Stability'],
  ['Local Control', 'Market Competition'],
];

interface CliOptions {
  mode: 'session';
  seeds: number;
  parties: readonly Party[];
  pace: RunSettings['pace'];
}

export interface BalanceCliDependencies {
  scenario?: ScenarioDefinition;
  outputDir?: string;
  commandExecutor?: BalanceCommandExecutor;
  log?: (message: string) => void;
}

type RunSummary = Omit<BalanceRun, 'commandTrace'>;

function parsePositiveInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function parseArgs(argv: string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith('--')) throw new Error(`Unexpected argument ${flag}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    values.set(flag, value);
    index += 1;
  }
  const mode = values.get('--mode') ?? 'session';
  if (mode !== 'session') throw new Error('Only --mode session is supported');
  const partyFlag = values.get('--parties') ?? 'both';
  const parties: readonly Party[] = partyFlag === 'both'
    ? ['democratic', 'republican']
    : partyFlag === 'democratic' || partyFlag === 'republican'
      ? [partyFlag]
      : (() => { throw new Error('--parties must be both, democratic, or republican'); })();
  const pace = values.get('--pace') ?? 'standard';
  if (pace !== 'relaxed' && pace !== 'standard' && pace !== 'brisk') {
    throw new Error('--pace must be relaxed, standard, or brisk');
  }
  return { mode, seeds: parsePositiveInteger(values.get('--seeds') ?? '1000', '--seeds'), parties, pace };
}

export function balanceSetup(
  seed: number,
  party: Party,
  pace: RunSettings['pace'],
  districtIds: readonly string[],
): BalanceSetup {
  const rotation = (seed - 1) % Math.min(districtIds.length, VALUE_PAIRS.length);
  return {
    seed,
    districtId: districtIds[rotation],
    party,
    values: [...VALUE_PAIRS[rotation]] as [GoverningValue, GoverningValue],
    settings: { ...DEFAULT_RUN_SETTINGS, pace },
  };
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function frequencies(values: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)));
}

function aggregate(runs: readonly RunSummary[]) {
  return {
    runs: runs.length,
    complete: runs.filter((run) => run.termination === 'complete').length,
    ready: runs.filter((run) => run.outcome === 'ready').length,
    notReady: runs.filter((run) => run.outcome === 'not-ready').length,
    failures: runs.filter((run) => run.termination !== 'complete').length,
    averageCommands: average(runs.map((run) => run.commandCount)),
    averageSpentPoliticalCapital: average(runs.map((run) => run.spentPoliticalCapital)),
    averageEarnedPoliticalCapital: average(runs.map((run) => run.earnedPoliticalCapital)),
    averageIdleSimulationMs: average(runs.map((run) => run.idleSimulationMs)),
    missedMandatoryOccurrences: runs.reduce((sum, run) => sum + run.missedObligationIds.length, 0),
    minimumResources: Object.fromEntries(RESOURCE_KEYS.map((key) => [
      key,
      Math.min(...runs.map((run) => run.resourceMinima[key])),
    ])),
    averageFinalResources: Object.fromEntries(RESOURCE_KEYS.map((key) => [
      key,
      average(runs.map((run) => run.finalResources[key])),
    ])),
    uniqueTraceHashes: new Set(runs.map((run) => run.commandTraceHash)).size,
    commandFrequencies: frequencies(runs.flatMap((run) => Object.entries(run.commandTypeCounts)
      .flatMap(([type, count]) => Array.from({ length: count }, () => type)))),
    completedPatternFrequencies: frequencies(runs.flatMap((run) => run.completedPatternIds)),
    activatedTacticFrequencies: frequencies(runs.flatMap((run) => run.activatedTacticIds)),
    tacticFrequencies: frequencies(runs.flatMap((run) => run.usedTacticIds)),
    fulfilledObligationFrequencies: frequencies(runs.flatMap((run) => run.fulfilledObligationIds)),
    missedObligationFrequencies: frequencies(runs.flatMap((run) => run.missedObligationIds)),
    acceptedChoiceFrequencies: frequencies(runs.flatMap((run) => run.acceptedChoices)),
    rejectedChoiceFrequencies: frequencies(runs.flatMap((run) => run.rejectedChoices)),
  };
}

function setupKey(run: RunSummary): string {
  return `${run.setup.districtId} | ${run.setup.party} | ${run.setup.values.join(' + ')} | ${run.setup.settings.pace}`;
}

interface DominanceResult {
  baselinePolicyId: 'greedy-same-party' | 'district-reward';
  comparedPolicyId: 'district-advocate' | 'committee-specialist' | 'coalition-broker';
  dominated: boolean;
  baselineReady: number;
  comparedReady: number;
  reason: string;
}

function setupRunKey(run: RunSummary): string {
  return `${run.setup.seed}|${run.setup.party}`;
}

function pairedDisadvantages(baseline: RunSummary, compared: RunSummary): string[] {
  const disadvantages: string[] = [];
  if (baseline.termination !== 'complete') disadvantages.push(`termination ${baseline.termination}`);
  if (compared.outcome === 'ready' && baseline.outcome !== 'ready') disadvantages.push('ready outcome lost');
  if (baseline.readinessGaps.provisionGap > compared.readinessGaps.provisionGap) disadvantages.push('provision gap');
  if (baseline.readinessGaps.supportGap > compared.readinessGaps.supportGap) disadvantages.push('support gap');
  if (baseline.readinessGaps.overdueMandatoryIds.length > compared.readinessGaps.overdueMandatoryIds.length) disadvantages.push('overdue mandatory work');
  if (baseline.spentPoliticalCapital > compared.spentPoliticalCapital) disadvantages.push('Political Capital spent');
  if (baseline.missedObligationIds.length > compared.missedObligationIds.length) disadvantages.push('missed obligations');
  if (baseline.idleSimulationMs > compared.idleSimulationMs) disadvantages.push('idle simulation');
  for (const key of RESOURCE_KEYS) {
    if (baseline.finalResources[key] < compared.finalResources[key]) disadvantages.push(`final ${key}`);
    if (baseline.resourceMinima[key] < compared.resourceMinima[key]) disadvantages.push(`minimum ${key}`);
  }
  return disadvantages;
}

function dominanceChecks(runs: readonly RunSummary[]): DominanceResult[] {
  const baselineIds = ['greedy-same-party', 'district-reward'] as const;
  const comparedIds = ['district-advocate', 'committee-specialist', 'coalition-broker'] as const;
  return baselineIds.flatMap((baselinePolicyId) => {
    const baselineRuns = runs.filter((run) => run.policyId === baselinePolicyId);
    const baselineBySetup = new Map(baselineRuns.map((run) => [setupRunKey(run), run]));
    return comparedIds.map((comparedPolicyId) => {
      const comparedRuns = runs.filter((run) => run.policyId === comparedPolicyId);
      const baselineReady = baselineRuns.filter((run) => run.outcome === 'ready').length;
      const comparedReady = comparedRuns.filter((run) => run.outcome === 'ready').length;
      let counterexample: { baseline: RunSummary; compared: RunSummary; disadvantages: string[] } | undefined;
      for (const compared of comparedRuns) {
        const baseline = baselineBySetup.get(setupRunKey(compared));
        const disadvantages = baseline ? pairedDisadvantages(baseline, compared) : ['missing paired run'];
        if (disadvantages.length > 0) {
          counterexample = baseline ? { baseline, compared, disadvantages } : undefined;
          break;
        }
      }
      const winsMoreSetups = baselineReady > comparedReady;
      const dominated = winsMoreSetups && !counterexample;
      let reason: string;
      if (counterexample) {
        const { baseline, compared, disadvantages } = counterexample;
        reason = `Counterexample seed ${compared.setup.seed}/${compared.setup.party}: ${disadvantages.join(', ')}; final PC ${baseline.finalResources.politicalCapital} vs ${compared.finalResources.politicalCapital}, spent ${baseline.spentPoliticalCapital} vs ${compared.spentPoliticalCapital}, idle ${(baseline.idleSimulationMs / 1000).toFixed(1)}s vs ${(compared.idleSimulationMs / 1000).toFixed(1)}s; traces ${baseline.commandTraceHash.slice(0, 12)} vs ${compared.commandTraceHash.slice(0, 12)}.`;
      } else if (!winsMoreSetups) {
        reason = `No paired disadvantage, but readiness wins were not greater (${baselineReady}/${baselineRuns.length} vs ${comparedReady}/${comparedRuns.length}).`;
      } else {
        reason = `Won more ready outcomes (${baselineReady}/${baselineRuns.length} vs ${comparedReady}/${comparedRuns.length}) with no paired disadvantage in readiness gaps, capital spend, missed obligations, idle time, or final/minimum resources.`;
      }
      return { baselinePolicyId, comparedPolicyId, dominated, baselineReady, comparedReady, reason };
    });
  });
}

function markdownReport(report: {
  generatedAt: string;
  scenario: { snapshotId: string; snapshotHash: string };
  options: CliOptions;
  totalRuns: number;
  byPolicy: Record<PolicyId, ReturnType<typeof aggregate>>;
  dominance: ReturnType<typeof dominanceChecks>;
  failures: Array<RunSummary & { commandTrace: BalanceRun['commandTrace'] }>;
}): string {
  const descriptions: Record<PolicyId, string> = {
    'district-advocate': 'resolves mandatory district priorities and delivers their earned endorsements to the authored recipients after drafting; no Tactic study is needed',
    'committee-specialist': 'reserves evidence for two early committee packets and mandatory district endorsements, uses one packet to review a provision and delivers the other, and drafts with finite political assets',
    'coalition-broker': 'protects Political Capital, drafts compatible language, prepares finite communication assets, and applies bipartisan widening to shared-interest office commitments',
    'greedy-same-party': 'prefers same-party offices, minimizes optional Story cost, completes visible mandatory work, and does not study a Tactic',
    'district-reward': 'uses district-focused Story choices and staff order, meets visible deadlines, and studies negotiated cost sharing',
  };
  const lines = [
    '# Session balance report',
    '',
    `Generated: ${report.generatedAt}`,
    `Snapshot: \`${report.scenario.snapshotId}\` / \`${report.scenario.snapshotHash}\``,
    `Manifest: seeds 1–${report.options.seeds}, parties ${report.options.parties.join(' + ')}, pace ${report.options.pace}, five policies, ${report.totalRuns} total runs.`,
    '',
    '| Policy | Complete | Ready | Not ready | Harness failures | Avg commands | Avg PC spent | Avg idle seconds |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...POLICY_IDS.map((id) => {
      const row = report.byPolicy[id];
      return `| ${id} | ${row.complete}/${row.runs} | ${row.ready}/${row.runs} | ${row.notReady}/${row.runs} | ${row.failures}/${row.runs} | ${row.averageCommands.toFixed(2)} | ${row.averageSpentPoliticalCapital.toFixed(2)} | ${(row.averageIdleSimulationMs / 1000).toFixed(2)} |`;
    }),
    '',
    '## Distinct action paths',
    '',
    ...POLICY_IDS.map((id) => {
      const row = report.byPolicy[id];
      const patterns = Object.entries(row.completedPatternFrequencies).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6)
        .map(([pattern, count]) => `${pattern} ${count}`).join(', ');
      const activatedTactics = Object.entries(row.activatedTacticFrequencies).map(([tactic, count]) => `${tactic} ${count}`).join(', ') || 'none';
      const usedTactics = Object.entries(row.tacticFrequencies).map(([tactic, count]) => `${tactic} ${count}`).join(', ') || 'none observed';
      const choices = Object.entries(row.acceptedChoiceFrequencies).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5)
        .map(([choice, count]) => `${choice} ${count}`).join(', ');
      const actions = ['SUBMIT_WORK', 'START_ASSIGNMENT', 'RESOLVE_DECISION', 'RESOLVE_STORY', 'FAST_FORWARD']
        .map((action) => `${action} ${row.commandFrequencies[action] ?? 0}`).join(', ');
      return `- ${id}: ${descriptions[id]}; ${row.uniqueTraceHashes} unique command traces; actions ${actions}; learned Tactics ${activatedTactics}; Tactics applied to completed work ${usedTactics}; leading choices ${choices || 'none'}; leading completed paths ${patterns || 'none'}.`;
    }),
    '',
    '## Baseline dominance checks',
    '',
    ...report.dominance.map((entry) => `- ${entry.baselinePolicyId} vs ${entry.comparedPolicyId}: ${entry.dominated ? 'DOMINATES' : 'does not dominate'} — ${entry.reason}`),
    '',
    'Dominance requires paired completion, every ready outcome, equal-or-smaller readiness gaps, Political Capital spend and idle time, no additional missed obligations, and no lower final or minimum resource. Incomparable outcomes are reported as non-dominance. Bot outcomes do not show that people find the game fun.',
    '',
    '## Harness failures',
    '',
    report.failures.length === 0
      ? 'None. Not-ready completed Sessions remain outcomes in the denominator and are not harness failures.'
      : report.failures.map((failure) => `- ${failure.policyId}, seed ${failure.setup.seed}, ${failure.setup.party}: ${failure.termination}; ${failure.firstViolatedInvariant}; trace ${failure.commandTraceHash}`).join('\n'),
    '',
  ];
  return lines.join('\n');
}

export async function runBalanceCli(
  argv: string[],
  dependencies: BalanceCliDependencies = {},
): Promise<number> {
  const options = parseArgs(argv);
  const scenario = dependencies.scenario ?? getCandidateScenario();
  const districtIds = scenario.districts.map((district) => district.id);
  const outputDir = dependencies.outputDir ?? resolve(process.cwd(), 'reports/session-balance');
  const log = dependencies.log ?? console.log;
  const startedAt = Date.now();
  const allRuns: RunSummary[] = [];
  const failures: Array<RunSummary & { commandTrace: BalanceRun['commandTrace'] }> = [];
  const manifestSetups: Array<{ setupId: string; setup: BalanceSetup }> = [];

  for (const seed of Array.from({ length: options.seeds }, (_, index) => index + 1)) {
    for (const party of options.parties) {
      const setup = balanceSetup(seed, party, options.pace, districtIds);
      manifestSetups.push({ setupId: `${seed}:${party}`, setup });
      for (const policyId of POLICY_IDS) {
        const run = runPolicy(policyId, setup, scenario, dependencies.commandExecutor);
        const { commandTrace, ...summary } = run;
        allRuns.push(summary);
        if (run.termination !== 'complete') failures.push({ ...summary, commandTrace });
      }
    }
  }

  const byPolicy = Object.fromEntries(POLICY_IDS.map((id) => [id, aggregate(allRuns.filter((run) => run.policyId === id))])) as Record<PolicyId, ReturnType<typeof aggregate>>;
  const strata = Object.fromEntries(POLICY_IDS.map((id) => {
    const policyRuns = allRuns.filter((run) => run.policyId === id);
    return [id, Object.fromEntries(Array.from(new Set(policyRuns.map(setupKey))).sort().map((key) => [
      key,
      aggregate(policyRuns.filter((run) => setupKey(run) === key)),
    ]))];
  }));
  const generatedAt = new Date().toISOString();
  const report = {
    generatedAt,
    elapsedMs: Date.now() - startedAt,
    scenario: { snapshotId: scenario.snapshotId, snapshotHash: scenarioSnapshotHash(scenario) },
    options,
    totalRuns: allRuns.length,
    observationModel: 'Visible cards/forms/tags, relationships, revealed packs, pending choices, obligations/deadlines, resources, and authored public rules. No runVariation, rngCursor, unopened packs, or future Story draws.',
    idleDefinition: 'Simulation milliseconds advanced by FAST_FORWARD while no work reservation was active at command start.',
    byPolicy,
    strata,
    baselineDominance: dominanceChecks(allRuns),
    failures,
    traceIndexFile: 'trace-index.json',
  };
  const manifest = {
    generatedAt,
    scenario: report.scenario,
    commandBound: 10_000,
    rotation: { districtIds, valuePairs: VALUE_PAIRS, formula: '(seed - 1) modulo 6' },
    options,
    policies: POLICY_IDS,
    setupCount: manifestSetups.length,
    totalRuns: manifestSetups.length * POLICY_IDS.length,
    setups: manifestSetups,
  };
  const traceIndex = allRuns.map((run) => ({
    setupId: `${run.setup.seed}:${run.setup.party}`,
    policyId: run.policyId,
    termination: run.termination,
    outcome: run.outcome,
    commandCount: run.commandCount,
    commandTraceHash: run.commandTraceHash,
    firstViolatedInvariant: run.firstViolatedInvariant,
  }));
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(resolve(outputDir, 'results.json'), `${JSON.stringify(report, null, 2)}\n`),
    writeFile(resolve(outputDir, 'trace-index.json'), `${JSON.stringify(traceIndex, null, 2)}\n`),
    writeFile(resolve(outputDir, 'report.md'), markdownReport({
      generatedAt,
      scenario: report.scenario,
      options,
      totalRuns: allRuns.length,
      byPolicy,
      dominance: report.baselineDominance,
      failures,
    })),
  ]);
  log(`Session balance: ${allRuns.length} runs in ${report.elapsedMs}ms; ${failures.length} harness failures.`);
  for (const id of POLICY_IDS) {
    const row = byPolicy[id];
    log(`${id}: ${row.ready}/${row.runs} ready, ${row.notReady}/${row.runs} not-ready, ${row.failures} failures.`);
  }
  log(`Reports: ${dirname(resolve(outputDir, 'report.md'))}`);
  return failures.length > 0 ? 1 : 0;
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (entryPath === import.meta.url) {
  void runBalanceCli(process.argv.slice(2)).then((exitCode) => { process.exitCode = exitCode; });
}
