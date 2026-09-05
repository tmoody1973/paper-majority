# Paper Majority Vertical Slice Implementation Plan

> **Execution update — 2026-09-04:** Tarik authorized execution of the replayable Session plan. For the six-week implementation, apply `docs/superpowers/specs/2026-09-04-replayable-session-design.md` and its paired plan where they explicitly revise this document. Human playtest, factual-content and art acceptance remain pending; no historical result is asserted.

**Revision:** August 24, 2026 — Added a fun-first interaction spike, staged 30-to-77 content expansion, visible-pressure validation, portrait-free member-office cards and replayability/recognition gates. Replaced exact-ID recipes with deterministic pattern matching, declarative Tactic expansions, discovered-pattern state, a Staff Handbook and recipe-density gates. Added the Teased → Discovered → Expanded onboarding sequence and a transparent simulated election with a Week 1 opponent reveal, narrowing outlook, auditable line items and no hidden final roll.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop-first, 45–60 minute web vertical slice of **Paper Majority: A Congressional Strategy Game**, in which a player uses Stacklands-like card interactions to guide a housing-affordability bill through one 24-week fictional congressional term, while every factual claim remains sourceable and visibly distinct from simulation.

**Architecture:** A Next.js/React application owns menus, inspectors, accessibility controls, the Staff Handbook, Election Outlook and Sourcebook. Phaser 4 owns the interactive desk and card animation. Both are thin clients over a deterministic, pure TypeScript domain engine. The engine matches stacks against declarative family/tag/source-class patterns, applies bounded Tactic expansions, resolves derived outputs through versioned resolver IDs and calculates a visible simulated election ledger. The game reads a checked-in scenario snapshot and never calls a government API or an LLM during play. Local saves record the snapshot ID, seed, discoveries, rule expansions, revealed opponent, election effects, command-derived state and a recoverable weekly checkpoint.

**Tech Stack:** Node.js 20+, Next.js App Router, React, TypeScript, Phaser 4.1.0, Zod, Vitest, Testing Library, Playwright, and optional Phaser Game Agent MCP during development only.

**Spec:** `docs/superpowers/specs/2026-08-23-paper-majority-design.md`, `docs/superpowers/specs/2026-08-23-paper-majority-art-design.md`, and the explanatory example `docs/examples/pattern-gameplay-walkthrough.md`

## Global Constraints

- Use test-driven development: add one failing test, observe the expected failure, implement only enough to pass, then refactor while green.
- Execute one task at a time and commit after its verification command succeeds.
- Do not cross a checkpoint until the user has reviewed the running game and approved continuation.
- Keep all rules, random selection, deadlines, and outcomes in pure TypeScript. Phaser and React may dispatch commands and render emitted events; neither may mutate authoritative state directly.
- Pin exact dependency resolutions in `web/package-lock.json`. Node.js 20 or later is required.
- Use Phaser Game Agent MCP only for bounded scene, input, animation, temporary-asset, or screenshot experiments. Review all generated output and commit accepted source/assets. Do not call MCP at game runtime.
- Do not add a runtime LLM. Story Director choices must be deterministic for the same snapshot, seed, and command sequence.
- Do not call live government APIs during a run. Only checked-in, validated snapshots may be loaded by the game.
- Keep official record, derived context, and simulated content separate in types, stored data, interface labels, and prose.
- The fictional player replaces the real officeholder only inside the simulation. Never model a 436th voting House member.
- Do not publish unreviewed factual copy, model-generated policy copy, or predictions of how a real lawmaker will vote.
- Preserve unlimited pause, card movement while paused, keyboard equivalents for every drag action, reduced motion, and accessible Sourcebook content outside the canvas.
- Implement the approved Illustrated Civic Desk visual system: sparse 180×252 cards, eight color/icon/text families, independent official/derived/simulated badges, and grounded illustrations with restrained wit.
- Use AI only for prototype composition and asset assistance. Human cleanup, representation review, alt text, and manifest metadata are required before production approval.
- Use portrait-free member-office cards for every real lawmaker in the vertical slice. Do not acquire, generate, alter or ship a real lawmaker likeness during this plan.
- Do not build the 30-definition six-week catalog until the fun-first interaction spike passes Checkpoint 1.
- Do not expand from 30 to 77 playable definitions until the six-week loop and eight-card art pilot pass Checkpoint 2.
- Do not produce the complete art library until the eight-card pilot has been reviewed at Checkpoint 2.
- Do not author gameplay recipes as exact card-ID pairs. Match controlled family/tag/source-class slots and reserve fixed definition IDs for outputs only.
- Do not embed executable functions in scenario JSON. Derived transformations name an allowlisted, versioned resolver ID implemented in the pure engine.
- Reject ambiguous pattern catalogs, unknown tags, invalid expansion targets and invalid resolver IDs during content validation.
- Keep failed stacking free: no resource deduction, elapsed-time charge or discovery mutation occurs on `STACK_REJECTED`.
- Keep the existing `RecipePattern` and `TacticExpansionDefinition` architecture. Do not add exact-ID recipes, `requiresUnlock`, executable templates or a parallel hidden-combo engine.
- Reveal the seeded opponent in Week 1, label every election surface simulated and never perform a new random draw when resolving reelection.
- Do not use demographic fields in election calculations. Do not separately score staff morale, coalition count or unanswered concerns when their effects are already represented through District Trust, bill outcome or an explicit authored election effect.

## Claude Code Execution Protocol

1. Open the approved design spec and this plan before changing code.
2. Confirm the repository path and Node version with `pwd` and `node --version`. If the repository layout differs, update the file map in this plan before implementing; do not silently improvise paths.
3. Mark only the active checkbox in progress. Keep later tasks untouched.
4. For every behavior step, run the named test once while it fails and record the expected failure in the task log or commit notes.
5. Run the task-level verification before each task commit.
6. At each checkpoint, run the full command set, start the game, complete the manual checks, and present the evidence to the user.
7. Stop at a failed check. Diagnose and fix the failure in the current task; do not hide it by weakening an assertion.
8. Stop after each checkpoint until the user explicitly approves the next phase.

## Target File Map

```text
.
├── README.md
├── docs/
│   ├── examples/pattern-gameplay-walkthrough.md
│   └── superpowers/
│       ├── specs/2026-08-23-paper-majority-design.md
│       ├── specs/2026-08-23-paper-majority-art-design.md
│       └── plans/2026-08-23-paper-majority-vertical-slice.md
├── art/
│   ├── manifests/art-assets.json
│   ├── masters/{cards,member-offices,textures}/
│   ├── masters/modular-kit/civic-illustration-kit/
│   │   ├── svg/{families,provenance,resources,statuses,institutions,issues}/
│   │   ├── {build_kit.py,build_sheet.py,validate_kit.py}
│   │   ├── {manifest.json,kit-sheet.svg,README.md,PROVENANCE.md}
│   ├── references/{districts,institutions,member-offices}/
│   └── reviews/{pilot-review.json,card-library-contact-sheet.png}
└── web/
    ├── e2e/
    │   ├── accessibility.spec.ts
    │   ├── core-loop.spec.ts
    │   ├── desk-foundation.spec.ts
    │   ├── interaction-spike.spec.ts
    │   └── full-term.spec.ts
    ├── public/assets/
    │   ├── cards/{fallback-card.svg,pilot/}
    │   ├── icons/{families,resources,sources}/
    │   └── member-offices/
    ├── scripts/
    │   ├── ingest/
    │   │   ├── fetch-census.ts
    │   │   ├── fetch-congress.ts
    │   │   ├── fetch-house-votes.ts
    │   │   └── normalize-housing-snapshot.ts
    │   ├── build-art-contact-sheet.ts
    │   ├── run-balance.ts
    │   ├── validate-art.ts
    │   └── validate-content.ts
    ├── src/
    │   ├── app/{globals.css,layout.tsx,page.tsx}
    │   ├── components/
    │   │   ├── AccessibleCardControls.tsx
    │   │   ├── CardInspector.tsx
    │   │   ├── DecisionModal.tsx
    │   │   ├── ElectionOutlook.tsx
    │   │   ├── GameShell.tsx
    │   │   ├── Hud.tsx
    │   │   ├── SetupForm.tsx
    │   │   ├── StaffHandbook.tsx
    │   │   ├── Sourcebook.tsx
    │   │   └── TermRecord.tsx
    │   ├── art/{cardPresentation.ts,loadArtManifest.ts,schema.ts,tokens.ts,types.ts}
    │   ├── content/
    │   │   ├── fixtures/interaction-spike.json
    │   │   ├── housing/vertical-slice.json
    │   │   ├── i18n/{en.ts,es.ts}
    │   │   ├── loadScenario.ts
    │   │   └── schema.ts
    │   ├── domain/
    │   │   ├── bill.ts
    │   │   ├── coalition.ts
    │   │   ├── commands.ts
    │   │   ├── engine.ts
    │   │   ├── election.ts
    │   │   ├── events.ts
    │   │   ├── initialState.ts
    │   │   ├── objectives.ts
    │   │   ├── patternResolvers.ts
    │   │   ├── recipes.ts
    │   │   ├── rng.ts
    │   │   ├── selectors.ts
    │   │   ├── storyDirector.ts
    │   │   ├── termRecord.ts
    │   │   ├── types.ts
    │   │   ├── votes.ts
    │   │   └── week.ts
    │   ├── game/
    │   │   ├── GameCanvas.tsx
    │   │   ├── createGame.ts
    │   │   ├── gameEventBus.ts
    │   │   ├── session.ts
    │   │   ├── input/dropResolver.ts
    │   │   ├── objects/{CardView.ts,StackView.ts}
    │   │   └── scenes/
    │   │       ├── BootScene.ts
    │   │       ├── DecisionScene.ts
    │   │       ├── DeskScene.ts
    │   │       ├── PreloadScene.ts
    │   │       ├── TermRecordScene.ts
    │   │       └── VoteScene.ts
    │   ├── persistence/{playerProfile.ts,saveMigrations.ts,saveRepository.ts}
    │   └── test/{fixtures/scenario.ts,setup.ts}
    ├── package.json
    ├── playwright.config.ts
    ├── tsconfig.json
    └── vitest.config.ts
```

Test files live beside the module they cover as `*.test.ts` or `*.test.tsx`. Create a file only in the task that first uses it.

## Phase 1 — Deterministic Desk Foundation

### Task 1: Bootstrap the application and test harness

**Files:**

- Create: `.gitignore`
- Create: `README.md`
- Create: `web/` through `create-next-app`
- Modify: `web/package.json`
- Create: `web/vitest.config.ts`
- Create: `web/playwright.config.ts`
- Create: `web/src/test/setup.ts`
- Test: `web/src/test/environment.test.ts`

**Interfaces:**

- Consumes: Node.js 20+ and an empty repository root containing the approved documentation.
- Produces: a Next.js/TypeScript application, pinned npm dependency tree and the `lint`, `typecheck`, `test:run`, `test:coverage`, `test:e2e`, `validate:content`, and `balance` script entry points used by later tasks.

- [x] **Step 1: Record toolchain prerequisites**

Run:

```bash
node --version
npm --version
```

Expected: Node reports `v20` or later. Stop and install a supported Node version if it does not.

- [x] **Step 2: Initialize the repository and scaffold the Next.js app**

Run from the repository root:

```bash
git init
npx create-next-app@latest web --typescript --eslint --app --src-dir --use-npm --import-alias "@/*" --no-tailwind --yes --disable-git
cd web
npm install phaser@4.1.0 zod
npm install --save-dev vitest @vitest/coverage-v8 jsdom vite-tsconfig-paths tsx @playwright/test @testing-library/react @testing-library/jest-dom @axe-core/playwright
npx playwright install chromium
```

Expected: `web/package-lock.json` is created and pins the resolved dependency tree.

- [x] **Step 3: Add a failing browser-environment test**

Create `web/src/test/environment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('test environment', () => {
  it('provides browser storage', () => {
    expect(window.localStorage).toBeDefined();
  });
});
```

Run:

```bash
npm --prefix web exec vitest run src/test/environment.test.ts
```

Expected: FAIL with `window is not defined` before the jsdom configuration exists.

- [x] **Step 4: Configure Vitest and common scripts**

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
});
```

Create `web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add these scripts to `web/package.json` without removing the generated scripts:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "validate:content": "tsx scripts/validate-content.ts",
    "balance": "tsx scripts/run-balance.ts"
  }
}
```

Create `web/playwright.config.ts` with Chromium, `baseURL: 'http://127.0.0.1:3000'`, and a web server command of `npm run dev -- --hostname 127.0.0.1`.

- [x] **Step 5: Verify the harness**

Run:

```bash
npm --prefix web run test:run -- src/test/environment.test.ts
npm --prefix web run lint
npm --prefix web run typecheck
```

Expected: all three commands pass.

- [x] **Step 6: Document local development and commit**

In `README.md`, document Node 20+, `npm --prefix web install`, `npm --prefix web run dev`, and the six verification scripts.

```bash
git add .gitignore README.md web docs
git commit -m "chore: bootstrap congressional game web app"
```

### Task 2: Define authoritative state, commands, events, and deterministic setup

**Files:**

- Create: `web/src/domain/types.ts`
- Create: `web/src/domain/commands.ts`
- Create: `web/src/domain/events.ts`
- Create: `web/src/domain/rng.ts`
- Create: `web/src/domain/initialState.ts`
- Create: `web/src/test/fixtures/scenario.ts`
- Test: `web/src/domain/initialState.test.ts`
- Test: `web/src/domain/rng.test.ts`

**Interfaces:**

- Consumes: the Task 1 TypeScript and Vitest harness.
- Produces: canonical domain types, `createRng(seed: number): () => number`, `createInitialState(input: InitialStateInput): TermState`, `GameCommand`, and `GameEvent` for every later domain/UI task.

- [x] **Step 1: Write failing state and determinism tests**

Test these contracts:

```ts
const first = createInitialState({ scenario, seed: 412, districtId: 'GA-05', party: 'democratic', values: ['Tenant Stability', 'Fair Access'] });
const second = createInitialState({ scenario, seed: 412, districtId: 'GA-05', party: 'democratic', values: ['Tenant Stability', 'Fair Access'] });

expect(first).toEqual(second);
expect(first.week).toBe(1);
expect(first.paused).toBe(true);
expect(first.resources.staffAttention).toBe(3);
expect(first.player.districtId).toBe('GA-05');
expect(first.player.election.opponentStrength).toBe(second.player.election.opponentStrength);
expect(first.player.election.revealedWeek).toBe(1);
expect(first.cards).toHaveLength(3);
expect(first.discoveredPatternIds).toEqual([]);
expect(first.unlockedSlotExpansions).toEqual({});
expect(first.electionEffects).toEqual([]);
```

Also assert that ten calls from two `createRng(412)` instances return identical arrays and that `createRng(413)` differs.

Run:

```bash
npm --prefix web run test:run -- src/domain/initialState.test.ts src/domain/rng.test.ts
```

Expected: FAIL because the modules do not exist.

- [x] **Step 2: Add the canonical domain contracts**

Define these unions and interfaces in `types.ts`; reuse them everywhere rather than duplicating shapes:

```ts
export type CardKind = 'staff' | 'policy' | 'evidence' | 'coalition' | 'constituency' | 'institution' | 'political' | 'tactic';
export type SourceClass = 'official' | 'derived' | 'simulated';
export type Party = 'democratic' | 'republican';
export type GoverningValue =
  | 'Fiscal Stewardship' | 'Local Control' | 'Market Competition' | 'Public Investment'
  | 'Tenant Stability' | 'Housing Supply' | 'Environmental Resilience' | 'Fair Access';
export type ProcedureStage = 'draft' | 'committee' | 'house' | 'senate' | 'resolution' | 'election' | 'complete';
export type SupportState = 'interested' | 'conditional' | 'committed';
export type LegislativeOutcome = 'active' | 'enacted' | 'failed-committee' | 'failed-house' | 'failed-senate' | 'absorbed-into-package';
export type OpponentStrength = 'weak' | 'moderate' | 'strong';

export interface ElectionEnvironment {
  opponentStrength: OpponentStrength;
  revealedWeek: 1;
}

export interface ElectionEffectEntry {
  id: string;
  week: number;
  label: string;
  contribution: number;
  explanation: string;
  sourceClass: 'simulated';
}

export interface ElectionLineItem {
  id: string;
  label: string;
  contribution: number;
  runningTotal: number;
  explanation: string;
  sourceClass: 'simulated';
}

export interface ElectionForecast {
  low: number;
  high: number;
  status: 'favored' | 'toss-up' | 'trailing';
  breakdown: ElectionLineItem[];
  label: 'Simulated outlook — not polling';
}

export interface ReelectionResult {
  simulatedVoteShare: number;
  outcome: 'won' | 'lost';
  breakdown: ElectionLineItem[];
}

export interface RunSettings {
  pace: 'relaxed' | 'standard' | 'brisk';
  guidance: 'guided' | 'standard' | 'expert';
  termStyle: 'regular-order' | 'district-pulse' | 'breaking-cycle';
  voteInformation: 'broad' | 'detailed';
  policyComplexity: 'essential' | 'advanced';
  locale: 'en' | 'es';
  reducedMotion: boolean;
}

export interface Citation {
  title: string;
  url: string;
  retrievedAt: string;
  publishedAt?: string;
}

export interface CardDefinition {
  id: string;
  title: string;
  kind: CardKind;
  tags: string[];
  sourceClass: SourceClass;
  citations: Citation[];
  workload: number;
}

export interface CardInstance {
  id: string;
  definitionId: string;
  stackId: string;
  x: number;
  y: number;
  remainingMs: number;
  status: 'idle' | 'working' | 'resolved' | 'expired';
}

export interface StackState {
  id: string;
  cardIds: string[];
  activeActionId?: string;
}

export interface Resources {
  staffAttention: number;
  politicalCapital: number;
  districtTrust: number;
  billMomentum: number;
  policyIntegrity: number;
  staffMorale: number;
}

export interface BillState {
  issueId: 'housing-affordability';
  title: string;
  provisionIds: string[];
  stage: ProcedureStage;
  outcome: LegislativeOutcome;
}

export interface RelationshipState {
  memberId: string;
  support: SupportState;
  demandProvisionId?: string;
}

export interface TermState {
  schemaVersion: 1;
  snapshotId: string;
  seed: number;
  rngCursor: number;
  week: number;
  elapsedMs: number;
  weekLengthMs: number;
  paused: boolean;
  settings: RunSettings;
  player: { districtId: string; party: Party; values: [GoverningValue, GoverningValue]; election: ElectionEnvironment };
  cards: CardInstance[];
  stacks: StackState[];
  resources: Resources;
  bill: BillState;
  relationships: RelationshipState[];
  discoveredPatternIds: string[];
  unlockedSlotExpansions: Record<string, string[]>;
  electionEffects: ElectionEffectEntry[];
  storyHistory: string[];
  objectives: string[];
  eventLog: GameEvent[];
}
```

Import `GameEvent` into `types.ts` with `import type` to avoid a runtime cycle.

Define the scenario contracts in the same file so the engine never imports the runtime Zod parser:

```ts
export interface RecipeSlot {
  kind?: CardKind;
  requiredTags?: string[];
  anyTags?: string[];
  sourceClasses?: SourceClass[];
  quantity: 1 | 2 | 3;
}

export type DerivedResolverId =
  | 'summarize-evidence-v1'
  | 'draft-provision-v1'
  | 'resolve-outreach-v1'
  | 'strengthen-provision-v1';

export type RecipeOutput =
  | { mode: 'fixed'; definitionId: string }
  | { mode: 'derived'; resolverId: DerivedResolverId; parameters?: Record<string, string | number | boolean> };

export interface RecipePattern {
  id: string;
  slots: RecipeSlot[];
  output: RecipeOutput;
  durationMs: number;
  resourceCost: Partial<Resources>;
  priority: number;
  discoveryHint: string;
}

export type TacticExpansionEffect =
  | { kind: 'widen-slot'; slotIndex: number; addAnyTags?: string[]; addSourceClasses?: SourceClass[] }
  | { kind: 'resource-cost'; resource: keyof Resources; delta: number }
  | { kind: 'duration-multiplier'; multiplier: number }
  | { kind: 'output-strength'; delta: number }
  | { kind: 'procedure-eligibility'; stage: ProcedureStage };

export interface TacticExpansionDefinition {
  id: string;
  tacticDefinitionId: string;
  targetPatternId: string;
  effect: TacticExpansionEffect;
}

export interface PlayerProfile {
  schemaVersion: 1;
  lifetimeDiscoveredPatternIds: string[];
}

export type StoryCondition =
  | { kind: 'metric'; metric: keyof Resources; op: 'lt' | 'lte' | 'gte' | 'gt'; value: number }
  | { kind: 'week'; min: number; max: number }
  | { kind: 'stage'; anyOf: ProcedureStage[] }
  | { kind: 'hasProvision'; provisionId: string }
  | { kind: 'relationshipCount'; support: SupportState; op: 'gte' | 'lt'; value: number };

export interface StoryChoiceDefinition {
  id: string;
  label: string;
  effects: Partial<Resources>;
  electionEffect?: number;
  electionEffectExplanation?: string;
}

export interface StoryEventDefinition {
  id: string;
  class: 'opportunity' | 'pressure' | 'consequence' | 'recovery';
  pressureCategory?: 'district' | 'staff' | 'media' | 'coalition' | 'procedure';
  minWeek: number;
  maxWeek: number;
  cooldownWeeks: number;
  weight: number;
  conditions: StoryCondition[];
  choices: StoryChoiceDefinition[];
  whyRules: string[];
}

export interface DistrictDefinition {
  id: string;
  title: string;
  role: string;
  sourceYear: number;
  uncertaintyNote: string;
  citations: Citation[];
}

export interface HouseModelDefinition {
  totalSeats: 435;
  curatedMemberSeats: number;
  anonymousSeats: number;
  sourceClass: 'simulated';
  baseline: { committed: number; conditional: number; undecided: number; opposed: number };
}

export interface WeeklyPackDefinition {
  week: number;
  cardDefinitionIds: string[];
}

export interface ScenarioDefinition {
  schemaVersion: 1;
  snapshotId: string;
  frozenAt: string;
  issue: { id: 'housing-affordability'; title: string };
  districts: DistrictDefinition[];
  cards: CardDefinition[];
  startingCardDefinitionIds: [string, string, string];
  tagTaxonomy: string[];
  patterns: RecipePattern[];
  tacticExpansions: TacticExpansionDefinition[];
  storyEvents: StoryEventDefinition[];
  houseModel: HouseModelDefinition;
  weeklyPacks: WeeklyPackDefinition[];
}
```

- [x] **Step 3: Define the command and event boundaries**

In `commands.ts`, define a discriminated `GameCommand` union with exact payloads for:

```ts
STACK_CARD, SEPARATE_STACK, MOVE_CARD, START_ASSIGNMENT, ACTIVATE_TACTIC, TICK,
SET_PAUSED, FILE_CARD, ARCHIVE_CARD, ACCEPT_AMENDMENT,
REJECT_AMENDMENT, ADVANCE_WEEK, RESOLVE_VOTE
```

`START_ASSIGNMENT` must include `{ assignmentKind: 'card-work' | 'study-tactic'; staffCardId: string; targetCardId: string }`. For `study-tactic`, `targetCardId` is the Tactic instance. `ACTIVATE_TACTIC` remains the single engine activation boundary used after timed study completes and by deterministic tests; the interface must not expose a player button that bypasses the Staff assignment.

In `events.ts`, define a discriminated `GameEvent` union for:

```ts
STACK_ACCEPTED, STACK_REJECTED, CARD_MOVED, ACTION_STARTED,
CARD_TRANSFORMED, PATTERN_DISCOVERED, TACTIC_EXPANSION_ACTIVATED,
RESOURCE_CHANGED, ELECTION_EFFECT_ADDED, ELECTION_OUTLOOK_UPDATED,
PAUSE_CHANGED, EVENT_TRIGGERED, WEEK_RESOLVED, VOTE_RESOLVED,
REELECTION_RESOLVED, COMMAND_REJECTED
```

Every rejected command must include a stable machine-readable `reason` and a concise player-facing `message`.

- [x] **Step 4: Implement seeded setup**

Implement `createRng(seed: number): () => number` with a small documented PRNG such as Mulberry32. Implement `drawOpponentStrength(roll: number): OpponentStrength` with `roll < 0.25` as Weak, `roll < 0.75` as Moderate and all remaining values as Strong. Implement:

```ts
export interface InitialStateInput {
  scenario: ScenarioDefinition;
  seed: number;
  districtId: string;
  party: Party;
  values: [GoverningValue, GoverningValue];
  settings?: Partial<RunSettings>;
}

export function createInitialState(input: InitialStateInput): TermState;
```

Reject an unknown district and duplicate governing values. Start with the three definitions in `startingCardDefinitionIds`, one stack per card, the game paused, empty `discoveredPatternIds`, `unlockedSlotExpansions` and `electionEffects`, standard settings, and resources `{ staffAttention: 3, politicalCapital: 3, districtTrust: 60, billMomentum: 10, policyIntegrity: 60, staffMorale: 70 }`. Draw the opponent once from the seeded stream during setup, store it at `player.election`, advance `rngCursor` exactly once and reveal it in the Week 1 interface. `PlayerProfile` is stored outside `TermState`; lifetime discoveries never change matching, randomness or outcomes inside a term. No demographic field may be read during opponent selection.

- [x] **Step 5: Verify and commit**

```bash
npm --prefix web run test:run -- src/domain/initialState.test.ts src/domain/rng.test.ts
npm --prefix web run typecheck
git add web/src/domain web/src/test
git commit -m "feat: define deterministic term state"
```

### Task 3: Implement deterministic pattern matching, Tactic expansions, and stack commands

**Files:**

- Create: `web/src/domain/engine.ts`
- Create: `web/src/domain/recipes.ts`
- Create: `web/src/domain/patternResolvers.ts`
- Test: `web/src/domain/engine.test.ts`
- Test: `web/src/domain/recipes.test.ts`
- Test: `web/src/domain/patternResolvers.test.ts`

**Interfaces:**

- Consumes: `TermState`, `CardDefinition`, `GameCommand`, `GameEvent`, `ScenarioDefinition`, `RecipePattern`, `TacticExpansionDefinition`, and resource types from Task 2.
- Produces: `matchPattern(inputs, patterns, activeExpansionIds): PatternMatch | undefined`, `resolvePatternOutput(match, inputs): ResolvedPatternOutput`, and `executeCommand(state, command, services): EngineResult`.

- [x] **Step 1: Write failing pattern, resolver, and engine tests**

Use two different housing Evidence definitions with the same `housing` tag and prove that one Staff + Evidence pattern accepts both without naming either evidence ID. Cover all of these cases:

- Matching ignores stack order and respects slot quantity.
- `Policy Aide + Rent Burden Report` and `Policy Aide + Tenant Survey` both match `pattern-evidence-summary`.
- A Staff + Evidence pattern requiring `housing` rejects evidence without that tag.
- A family + tag pattern outranks a family-only pattern regardless of declaration order.
- If specificity and priority remain equal, stable pattern ID ordering makes repeated calls identical; Task 5 validation will reject the catalog before publication.
- A fixed output returns its definition ID and a derived output calls only an allowlisted resolver ID.
- An unknown resolver ID is impossible under the TypeScript contract and rejected by runtime schema validation in Task 5.
- Before activation, an opposing-party office fails the restricted Coalition slot; after `ACTIVATE_TACTIC`, the declared expansion makes it valid for the rest of the term.
- `START_ASSIGNMENT` with `assignmentKind: 'study-tactic'`, one eligible Staff instance and one unstudied Tactic instance spends the declared Staff Attention, begins a timed action and activates the same declared expansion only when the action completes.
- Studying a Tactic consumes or files only the Tactic as authored, returns the Staff card to idle and does not add a fourth `RecipePattern` or any `requiresUnlock` field.
- The first accepted use adds the pattern ID and emits `PATTERN_DISCOVERED`; later uses do not duplicate the ID or event.
- `STACK_REJECTED` changes no resources, elapsed time, discovery state or expansion state and leaves the original state deeply equal.
- A valid stack emits `STACK_ACCEPTED`; a timed pattern also emits `ACTION_STARTED`.

Run:

```bash
npm --prefix web run test:run -- src/domain/recipes.test.ts src/domain/patternResolvers.test.ts src/domain/engine.test.ts
```

Expected: FAIL because pattern matching, resolvers and the engine do not exist.

- [x] **Step 2: Define the pure matching and resolver boundaries**

```ts
export interface PatternSlotAssignment {
  slotIndex: number;
  cardDefinitionIds: string[];
}

export interface MatchInput {
  instanceId: string;
  definition: CardDefinition;
  effectiveTags: string[];
}

export interface PatternMatch {
  pattern: RecipePattern;
  assignments: PatternSlotAssignment[];
  specificity: number;
  activeExpansionIds: string[];
}

export interface ResolvedPatternOutput {
  definitionId: string;
  effects: Partial<Resources>;
  explanationKey: string;
}

export function matchPattern(
  inputs: MatchInput[],
  patterns: RecipePattern[],
  activeExpansionIds: string[],
  expansions: TacticExpansionDefinition[],
): PatternMatch | undefined;

export function resolvePatternOutput(
  match: PatternMatch,
  inputs: MatchInput[],
): ResolvedPatternOutput;
```

Implement derived resolvers in an exhaustive `Record<DerivedResolverId, PatternResolver>` map. Scenario JSON stores only `resolverId` and JSON parameters; never evaluate code or import a function path from content.

- [x] **Step 3: Implement bounded deterministic slot assignment and ranking**

Build `MatchInput` values through a pure selector. Copy authored card tags and deterministically add relational tags such as `same-party` or `opposing-party` from `TermState.player.party` and the Coalition card's official party field. Sort inputs by stable instance ID before mapping them to two-to-four pattern slots. Use a bounded backtracking assignment because the interaction stack contains at most four recipe inputs. A card may satisfy one slot only; `quantity` consumes that many distinct inputs. `requiredTags` are all required; at least one `anyTags` value is required when the list is present.

Compute specificity from authored constraints, not input order: family constraint count, number of required tags plus one point for the presence of an `anyTags` constraint, source-class constraint presence, then `priority`. Adding another accepted alternative to an existing `anyTags` or `sourceClasses` list widens the rule and must not increase specificity. Sort successful candidates by that tuple descending and stable pattern ID ascending. Return the first result. Do not use randomness.

- [x] **Step 4: Implement immutable stack and Tactic commands**

For `STACK_CARD`, validate that every card exists, no input is expired, the target stack exists, and the combined definitions match an active pattern or an allowed organizational stack. Emit `STACK_REJECTED` for a physical but invalid attempt and `COMMAND_REJECTED` for malformed commands. Neither rejection may deduct resources, add elapsed time or change discoveries.

For `ACTIVATE_TACTIC`, verify that the Tactic card exists, the expansion references that definition, its target pattern exists and the expansion is not already active. A `widen-slot` effect may append alternatives to `anyTags` or `sourceClasses`; it may not remove a required constraint. Record the expansion ID under `unlockedSlotExpansions[targetPatternId]`, consume or resolve the Tactic as authored, and emit `TACTIC_EXPANSION_ACTIVATED`. The expansion is permanent for the term but does not enter the lifetime profile.

For the player-facing path, accept `START_ASSIGNMENT` with `assignmentKind: 'study-tactic'`, `staffCardId` and `tacticCardId`. Validate Staff eligibility and cost, mark both cards working and store the expansion ID in the action payload. When `TICK` completes the assignment, call the same pure activation helper used by `ACTIVATE_TACTIC`. This is an assignment interaction layered over the existing expansion architecture, not another pattern matcher.

For `SEPARATE_STACK` and `MOVE_CARD`, preserve card IDs and update only stack membership or coordinates. Assert after every accepted command that each card belongs to exactly one stack.

- [x] **Step 5: Implement timed pattern starts and discovery**

On an accepted pattern, deduct only validated costs, store the pattern ID as `activeActionId`, set participating cards to `working`, and add the pattern ID to `discoveredPatternIds` exactly once. Emit `PATTERN_DISCOVERED` only on first use. Do not complete transformations in this task; Task 4 adds the minimal deterministic `TICK` completion and Task 7 adds the complete weekly clock.

- [x] **Step 6: Verify and commit**

```bash
npm --prefix web run test:run -- src/domain/recipes.test.ts src/domain/patternResolvers.test.ts src/domain/engine.test.ts
npm --prefix web run typecheck
git add web/src/domain
git commit -m "feat: add deterministic pattern recipe engine"
```

### Task 4: Build the React–Phaser boundary and tactile desk interaction

**Files:**

- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/globals.css`
- Create: `web/src/components/GameShell.tsx`
- Create: `web/src/components/Hud.tsx`
- Create: `web/src/components/StaffHandbook.tsx`
- Create: `web/src/game/GameCanvas.tsx`
- Create: `web/src/game/createGame.ts`
- Create: `web/src/game/gameEventBus.ts`
- Create: `web/src/game/session.ts`
- Create: `web/src/game/input/dropResolver.ts`
- Create: `web/src/game/objects/CardView.ts`
- Create: `web/src/game/objects/StackView.ts`
- Create: `web/src/game/scenes/BootScene.ts`
- Create: `web/src/game/scenes/PreloadScene.ts`
- Create: `web/src/game/scenes/DeskScene.ts`
- Create: `web/src/content/fixtures/interaction-spike.json`
- Create: `web/public/assets/cards/fallback-card.svg`
- Create: `docs/playtests/interaction-spike-results.md`
- Create: `web/scripts/report-pattern-density.ts`
- Modify: `web/package.json`
- Modify: `web/src/domain/engine.ts`
- Modify: `web/src/domain/engine.test.ts`
- Test: `web/src/game/input/dropResolver.test.ts`
- Test: `web/src/components/GameShell.test.tsx`
- Test: `web/src/components/StaffHandbook.test.tsx`
- Test: `web/e2e/desk-foundation.spec.ts`
- Test: `web/e2e/interaction-spike.spec.ts`

**Interfaces:**

- Consumes: `executeCommand`, `EngineResult`, `GameCommand`, `TermState`, and the Task 2 fixture scenario.
- Produces: `GameSession`, `resolveDropTarget`, the React/Phaser mounting boundary, Boot/Preload/Desk scenes, a minimal Staff Handbook, a 10-minute pattern-density interaction fixture, deterministic short transformations, `report:patterns`, and the development-only `window.__congressGameTestApi` used by E2E tests.

- [x] **Step 1: Write failing drop and shell tests**

Specify a pure drop resolver:

```ts
export interface DropTarget {
  stackId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
}

export function resolveDropTarget(
  pointer: { x: number; y: number },
  targets: DropTarget[],
): string | undefined;
```

Test that the highest-z overlapping target wins and that an out-of-bounds pointer returns `undefined`. In `GameShell.test.tsx`, assert that the HUD and a labeled game-canvas region render without importing Phaser on the server. In `StaffHandbook.test.tsx`, assert the exact derived states: an undiscovered entry renders **Teased** with an authored silhouette hint, a discovered entry renders **Discovered** with general slots plus successful examples and an activated Tactic expansion renders **Expanded** while preserving the base rule. Extend `engine.test.ts` to assert that a `TICK` crossing a short pattern's duration emits one `CARD_TRANSFORMED` event, removes only consumed inputs, resolves the declared output and records discovery once. Also test that a completed `study-tactic` assignment activates the same expansion as `ACTIVATE_TACTIC` without adding a new pattern.

Run:

```bash
npm --prefix web run test:run -- src/game/input/dropResolver.test.ts src/components/GameShell.test.tsx src/components/StaffHandbook.test.tsx
```

Expected: FAIL because the components, resolver and timed transformation behavior do not exist.

- [x] **Step 2: Implement a single session controller**

Create `GameSession` in `session.ts` with:

```ts
export interface GameSession {
  getState(): TermState;
  dispatch(command: GameCommand): EngineResult;
  subscribe(listener: (result: EngineResult) => void): () => void;
}
```

The controller is the only object allowed to replace authoritative state. React and Phaser must share the same session instance.

- [x] **Step 3: Mount Phaser safely inside Next.js**

Make `GameCanvas.tsx` a client component. Create the Phaser game inside `useEffect`, destroy it on unmount, and render it into a `<div data-testid="game-canvas" aria-label="Congressional desk">`. Use `dynamic(..., { ssr: false })` from `GameShell.tsx`. Configure Boot, Preload, and Desk scenes; load `fallback-card.svg` when a referenced asset is unavailable.

- [x] **Step 4: Implement drag, snap, reject, pan, zoom, and pause**

In `DeskScene`:

- Render the cards from state.
- Dispatch `MOVE_CARD` during a free drop and `STACK_CARD` when a card overlaps a stack target.
- Animate `STACK_ACCEPTED` into a snapped stack.
- Animate `STACK_REJECTED` back to the pre-drag position with a short nonverbal cue; do not open a dialog.
- Permit drag and stack commands while paused.
- Pan empty desk space and zoom within an explicitly clamped range of `0.65` to `1.5`.
- Skip bounce/slide tweening when reduced motion is active.
- Render an expiring district concern with a restrained deadline stamp, an overloaded assignment as a visibly attached stack and a coalition request as a slip attached to the bill. These cues must be visible without reading a HUD meter.
- Start pickup or valid-hover feedback within 100 milliseconds. Complete result animation and the one-line result phrase within one second after the engine emits `CARD_TRANSFORMED`.

Phaser Game Agent MCP may be used for this isolated input prototype. Copy only reviewed source/assets into the repository and verify that no MCP endpoint or token appears in the browser bundle.

- [x] **Step 5: Add a production-safe test adapter and E2E test**

Expose `window.__congressGameTestApi` only when `process.env.NODE_ENV !== 'production'`. It may read state, return card screen rectangles, and dispatch commands through `GameSession`; it must not provide a second mutation path. Keep `?fixture=desk-foundation` for low-level drag tests.

When the URL contains `?fixture=interaction-spike`, load `interaction-spike.json`. It must contain eight distinct starting definitions represented by 12–16 card instances, placeholder art, no lawmaker portrait and exactly these three learnable patterns:

```text
Policy-focused Staff + any housing Evidence → Evidence Summary
Evidence Summary + any renter-focused housing Policy → Drafted Provision
Working Bill + eligible Member Office → Support or Counteroffer
```

Use two different housing Evidence definitions, one eligible same-party Member Office, one initially ineligible opposing-party Member Office and `tactic-bipartisan-working-group`. Before the Tactic, the eight starting definitions must produce four intended valid concrete stacks; after activation, the opposing-party office creates a fifth. Do not add exact input IDs to the three patterns.

The fixture also contains one expiring district concern, one staff-capacity conflict and one visible amendment request. Basic success and failure must be understandable from transformation, motion and a one-line result phrase. The factual Sourcebook is unavailable, the inspector is optional and the Staff Handbook is available as the discovery surface. The Handbook must follow a condensed onboarding arc: coalition outreach begins Teased, a successful same-party outreach makes it Discovered, and stacking eligible Staff with Bipartisan Working Group starts Study Tactic; completion makes the same entry Expanded. The study interaction invokes the existing Tactic expansion mechanism and does not count as a fourth recipe pattern.

Implement `report-pattern-density.ts` to enumerate all two-to-four-card unordered input sets for the fixture, report accepted sets before and after the Tactic expansion, group them by pattern and output, and fail unless the base count is four and expanded count is five. Add `"report:patterns": "tsx scripts/report-pattern-density.ts"` to `package.json`.

In `desk-foundation.spec.ts`, verify:

- The canvas and HUD load without console errors.
- A pointer drag changes a card's coordinates.
- A valid test stack snaps.
- An invalid stack emits rejection and preserves state.
- Pausing stops elapsed time but still permits moving a card.
- Wheel zoom remains within the clamp.

In `interaction-spike.spec.ts`, verify:

- All 12–16 instances load and the Sourcebook is not required or opened.
- Two different Evidence cards satisfy the same Staff + housing Evidence pattern.
- Each of the three patterns transforms into the authored or resolved result.
- The Staff Handbook begins with a Teased silhouette, becomes Discovered after first use, does not duplicate discovery after reuse and becomes Expanded after study completes.
- The opposing-party office is rejected before the Tactic; the player physically studies Bipartisan Working Group with Staff; it is accepted afterward and the Handbook explains the widened rule.
- The visible deadline, overload and amendment-request cues render before their corresponding resource consequence.
- An invalid stack separates without changing state.
- Restarting with the same seed reproduces the same fixture and event order.
- The three-pattern path and Tactic expansion can be completed in under ten minutes of standard active time.
- `npm --prefix web run report:patterns` reports exactly four base and five expanded valid concrete stacks for the eight starting definitions.

Create `docs/playtests/interaction-spike-results.md` with fields for tester ID, first-time status, three predicted valid stacks, patterns discovered without the Handbook, whether the tester could explain the Tactic expansion, family/provenance recognition, whether the tester opened the inspector, whether the tester could name the cause of a setback, replay choice and qualitative notes. Do not invent results; Checkpoint 1 is where the user records them.

- [x] **Step 6: Verify and commit**

```bash
npm --prefix web run test:run -- src/game/input/dropResolver.test.ts src/components/GameShell.test.tsx src/components/StaffHandbook.test.tsx
npm --prefix web run test:run -- src/domain/engine.test.ts
npm --prefix web run test:e2e -- --grep "desk foundation|interaction spike"
npm --prefix web run report:patterns
npm --prefix web run lint
npm --prefix web run typecheck
git add web
git commit -m "feat: add pattern-dense tactile interaction spike"
```

## Verification Checkpoint 1 — Fun-First Interaction Gate

Claude Code must stop here and present the evidence before Phase 2.

Automated verification:

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test:run
npm --prefix web run test:e2e -- --grep "desk foundation|interaction spike"
npm --prefix web run report:patterns
```

Manual verification:

- [ ] Start `npm --prefix web run dev` and open the displayed network-safe URL, not a stale localhost link from a prior process.
- [ ] Drag all three staff cards and confirm that they track the pointer without visible jitter.
- [ ] Make one valid stack and see a snap; make one invalid stack and see a bounce/separation without a dialog.
- [ ] Pause, move and separate cards, then unpause.
- [ ] Pan and zoom the desk and confirm zoom stays between 0.65 and 1.5.
- [ ] Enable reduced motion and confirm the interaction remains understandable without bounce tweens.
- [ ] Confirm the browser console contains no uncaught error and the production build contains no MCP URL or credential.
- [ ] Complete the interaction spike without opening the Sourcebook; confirm all three pattern transformations are understandable from the card result and one-line feedback.
- [ ] Confirm two different Evidence cards work with the same Staff pattern without any exact evidence ID appearing in the pattern definition.
- [ ] Open the Staff Handbook before discovery and see the **Teased** label plus directional silhouettes; use a pattern and confirm the entry becomes **Discovered** without revealing other undiscovered patterns.
- [ ] Try the opposing-party Member Office before activating `Bipartisan Working Group` and see a free rejection; stack eligible Staff with the Tactic, let Study Tactic complete, confirm the same Handbook entry becomes **Expanded**, then retry and see the newly valid stack.
- [ ] Confirm the district deadline, staff overload and amendment request are visible on the desk before any related meter changes.
- [ ] Confirm pickup/hover feedback begins within 100 milliseconds and each completed transformation communicates its result within one second.
- [ ] Run the ten-person first-time playtest recorded in `docs/playtests/interaction-spike-results.md`: at least 8 of 10 predict three valid stacks after one demonstration, at least 7 of 10 discover two patterns without the Handbook, at least 8 of 10 explain what the Tactic changed, at least 9 of 10 identify family and information class without the inspector, and at least 7 of 10 choose to begin another short run.
- [ ] Ask every tester what caused the visible setback; at least 8 of 10 must identify the relevant card, deadline or unfinished obligation rather than only naming a meter.

Approval question: **Does the 10-minute loop make family/tag experimentation, discovery and the Tactic rule change satisfying and immediately legible enough to justify building the 30-definition six-week civic scenario?** Continue only after the playtest evidence and explicit approval.

## Phase 2 — Six-Week Playable Core

### Task 5: Create the validated housing scenario schema and card catalog

**Files:**

- Create: `web/src/content/schema.ts`
- Create: `web/src/content/loadScenario.ts`
- Create: `web/src/content/housing/source-map.json`
- Create: `web/src/content/housing/vertical-slice.json`
- Modify: `web/src/test/fixtures/scenario.ts`
- Modify: `web/package.json`
- Modify: `.gitignore`
- Create: `web/scripts/ingest/fetch-congress.ts`
- Create: `web/scripts/ingest/fetch-house-votes.ts`
- Create: `web/scripts/ingest/fetch-census.ts`
- Create: `web/scripts/ingest/normalize-housing-snapshot.ts`
- Create: `web/scripts/validate-content.ts`
- Test: `web/src/content/schema.test.ts`
- Test: `web/src/content/catalog.test.ts`

**Interfaces:**

- Consumes: canonical `ScenarioDefinition`, `CardDefinition`, `RecipePattern`, `TacticExpansionDefinition`, controlled tag taxonomy and Story Director content types from Task 2.
- Produces: `parseScenario(input: unknown): ScenarioDefinition`, `loadScenario(): Promise<ScenarioDefinition>`, the frozen six-week housing snapshot, stable IDs for exactly 30 playable definitions, 16 pattern definitions, four Tactic expansions, source manifests and the `validate:content` command.

- [ ] **Step 1: Write failing schema and catalog tests**

Require one snapshot with exactly:

| Definition group | Count |
| --- | ---: |
| Staff | 3 |
| Policy provisions | 5 |
| Evidence | 5 |
| Coalition member offices | 4 |
| Constituency | 4 |
| Institution | 3 |
| Political | 2 |
| Legislative Tactics | 4 |
| **Playable definitions** | **30** |
| Story Director events, stored separately | 12 |
| Authored card patterns, stored separately | 16 |
| Tactic expansion definitions | 4 |
| Minimum valid concrete stacks | 50 |

Also test that IDs are unique, every referenced definition exists, official and derived records have at least one HTTPS citation and a retrieval date, all eight governing values appear, and each real-lawmaker record keeps official fields separate from simulated relationship state. Reject unknown card tags, pattern tags absent from `tagTaxonomy`, patterns with fewer than two or more than four total inputs, unknown fixed outputs, unknown derived resolver IDs, invalid Tactic/target references and two patterns that accept the same concrete stack with equal specificity and priority. Reserve `same-party` and `opposing-party` as computed tags and reject them when authored directly on published card definitions. A Story choice may declare one integer `electionEffect` from `-3` through `+3` only when it also declares `electionEffectExplanation`; reject an explanation without an effect, an effect without an explanation and any demographic field referenced by an election rule.

Run:

```bash
npm --prefix web run test:run -- src/content/schema.test.ts src/content/catalog.test.ts
```

Expected: FAIL because the schema and reviewed six-week catalog do not exist.

- [ ] **Step 2: Define a strict Zod parser for the canonical domain contract**

Extend `CardDefinition` with content-only fields through discriminated Zod schemas rather than optional fields on every card. `scenarioSchema.parse` must produce a value assignable to the `ScenarioDefinition` already declared in `domain/types.ts`; do not declare a second scenario interface. Export this boundary:

```ts
export function parseScenario(input: unknown): ScenarioDefinition {
  return scenarioSchema.parse(input);
}
```

Declare `scenarioSchema` as `z.ZodType<ScenarioDefinition>` and make every object strict so unknown fields fail validation.

For policy cards require `plainLanguage`, `valueEffects: Partial<Record<GoverningValue, -1 | 0 | 1>>`, `committeeJurisdiction`, `precedentIds`, and `editorialReviewDate`. For coalition cards require an `officialRecord` object and forbid support, interest, or demand fields in published content; those belong only in `RelationshipState`.

- [ ] **Step 3: Build the development-only source ingestion path**

Each fetcher is a developer command, never imported by `src/`. It writes raw responses under a dated, gitignored `web/.ingest-staging/<snapshot-id>/` directory, records the request URL and retrieval time, and refuses to overwrite an existing frozen snapshot. `CONGRESS_API_KEY` may be read only by `fetch-congress.ts` and must never be written to disk or logged.

`source-map.json` must list every reviewed Congress.gov resource path, House Clerk roll-call page, and Census ACS table/variable used by the slice, along with a plain-language purpose. `fetch-census.ts` may request only entries in that map. `normalize-housing-snapshot.ts` reads staged records, selects only mapped fields, emits stable IDs, calculates SHA-256 checksums, and writes `vertical-slice.candidate.json` plus a manifest. It must never promote the candidate to `vertical-slice.json`; promotion is an explicit reviewed file replacement.

Run the fetch/normalize commands once for the dated snapshot. If an API credential is unavailable, obtain the same official record through an official downloadable file and record that file URL and checksum in the manifest; do not substitute a secondary source.

Add `.ingest-staging/` to `.gitignore`, and add these scripts to `web/package.json`:

```json
{
  "scripts": {
    "ingest:congress": "tsx scripts/ingest/fetch-congress.ts",
    "ingest:house-votes": "tsx scripts/ingest/fetch-house-votes.ts",
    "ingest:census": "tsx scripts/ingest/fetch-census.ts",
    "ingest:normalize": "tsx scripts/ingest/normalize-housing-snapshot.ts"
  }
}
```

Run:

```bash
npm --prefix web run ingest:congress -- --snapshot housing-2026-08-23
npm --prefix web run ingest:house-votes -- --snapshot housing-2026-08-23
npm --prefix web run ingest:census -- --snapshot housing-2026-08-23
npm --prefix web run ingest:normalize -- --snapshot housing-2026-08-23
```

Expected: a candidate snapshot and checksum manifest appear under the ignored staging directory; no production content changes until the reviewed promotion in Step 5.

- [ ] **Step 4: Freeze the six-district vertical-slice set**

Use these district identifiers in the first snapshot:

| District | Slice role |
| --- | --- |
| GA-05 | Urban majority-Black district |
| CA-22 | Latino community under housing pressure |
| IA-04 | Rural agricultural district |
| WI-04 | Post-industrial mixed district |
| TX-24 | Fast-growing suburban district |
| NM-03 | Large tribal/frontier district |

Store the source year, citations, uncertainty note, and short editorial rationale for each role. Treat the labels as scenario-selection rationale, never as a rule that determines political behavior. The set is three Democratic- and three Republican-held seats in the source snapshot; the player's selected party is a simulation choice and need not match the actual officeholder.

- [ ] **Step 5: Author the exact catalog**

Use stable kebab-case IDs. The five six-week policy IDs are:

```text
policy-zoning-incentive
policy-low-income-housing-tax-credit
policy-housing-choice-voucher
policy-rural-rental-preservation
policy-tribal-housing-block-grant
```

The staff IDs are `staff-policy-aide`, `staff-legislative-counsel`, and `staff-district-director`. Reserve the exact pilot IDs `evidence-rent-burden-report`, `constituency-urgent-renter-concern`, `institution-committee-hearing`, `political-media-attention`, and `tactic-bipartisan-working-group`. Name the remaining definitions by their real source or mechanical role, not by sequence numbers.

Author exactly 16 declarative patterns for the six-week loop: four universal Staff-action patterns, five cross-family patterns, three chained provision/procedure patterns and four patterns affected by Tactics. Author one expansion record for each of the four Tactic cards. Patterns may name fixed output IDs or derived resolver IDs, but they may not list exact input IDs. The catalog must enumerate at least 50 valid unordered concrete stacks across the 30 definitions and report counts grouped by pattern, family combination and distinct output. Keep the 12 Story Director definitions outside the playable-card count.

The four Coalition cards identify real member offices from the frozen snapshot, balance party and committee relevance, cite official profiles or records, and describe only official public-record facts. Their resting faces use portrait-free office treatments. A human content review must approve the identities and copy before Checkpoint 2.

Only the housing issue is exported into `web/public` or exposed in navigation. Future issue icons in the Civic Illustration Kit remain source-only and must not create empty menus, routes or placeholder modules.

- [ ] **Step 6: Add a command-line validator**

`scripts/validate-content.ts` must load `vertical-slice.json` through the Zod parser, print snapshot ID, definition counts, pattern counts, Tactic expansion counts, concrete-stack density and distinct-output counts. Enumerate matching with both possible player parties so computed `same-party` and `opposing-party` tags are exercised. Check the base rules and every authored single-Tactic expansion state for collisions; later full-catalog validation also checks reachable multi-Tactic states that target the same pattern. It exits nonzero on schema failure, broken references, unknown tags, unknown resolver IDs, an ambiguous pattern collision in any tested party/expansion configuration, fewer than 50 valid concrete stacks, non-HTTPS citations, missing dates, duplicate IDs, an incorrect count, a six-week House baseline whose four curated office seats plus 430 anonymous seats do not total 435, or a manifest checksum mismatch.

- [ ] **Step 7: Verify and commit**

```bash
npm --prefix web run validate:content
npm --prefix web run test:run -- src/content/schema.test.ts src/content/catalog.test.ts
npm --prefix web run typecheck
git add web/src/content web/src/test/fixtures web/scripts
git commit -m "feat: add validated housing scenario snapshot"
```

### Task 6: Build the Illustrated Civic Desk system and eight-card art pilot

**Files:**

- Create: `art/manifests/art-assets.json`
- Create: `art/masters/cards/`
- Create: `art/masters/member-offices/`
- Use and modify only as needed: `art/masters/modular-kit/civic-illustration-kit/`
- Use: `art/masters/modular-kit/civic-illustration-kit/manifest.json`
- Use: `art/masters/modular-kit/civic-illustration-kit/svg/`
- Use: `art/masters/modular-kit/civic-illustration-kit/{build_kit.py,build_sheet.py,validate_kit.py}`
- Create: `art/references/member-offices/`
- Create: `art/reviews/humor-samples.md`
- Create: `web/src/art/types.ts`
- Create: `web/src/art/schema.ts`
- Create: `web/src/art/tokens.ts`
- Create: `web/src/art/loadArtManifest.ts`
- Create: `web/src/art/cardPresentation.ts`
- Create: `web/src/app/dev/art-review/page.tsx`
- Create: `web/public/assets/icons/families/`
- Create: `web/public/assets/icons/sources/`
- Create: `web/public/assets/icons/resources/`
- Create: `web/public/assets/cards/pilot/`
- Create: `web/public/assets/member-offices/`
- Create: `web/scripts/validate-art.ts`
- Modify: `web/package.json`
- Modify: `web/src/game/objects/CardView.ts`
- Modify: `web/src/components/CardInspector.tsx`
- Test: `web/src/art/schema.test.ts`
- Test: `web/src/art/cardPresentation.test.ts`
- Test: `web/e2e/art-pilot.spec.ts`

**Interfaces:**

- Consumes: `CardDefinition`, `CardKind`, `SourceClass`, the frozen `ScenarioDefinition` produced in Tasks 2 and 5, and the validated starter Civic Illustration Kit.
- Produces: `parseArtManifest(input: unknown): ArtManifest`, `loadArtManifest(): Promise<ArtManifest>`, `getCardPresentation(card: CardDefinition, manifest: ArtManifest): CardPresentation`, and the runtime asset paths used by `CardView` and `CardInspector`.

- [ ] **Step 1: Write the failing manifest and presentation tests**

Create tests that require:

- Exactly eight pilot card treatments.
- All eight card families in the pilot.
- Eight family icons, three source-class icons and six resource icons.
- A 1024×768 runtime image for every illustrated pilot card.
- Nonblank functional alt text.
- Stable SHA-256 checksums.
- `aiAssisted`, `humanEditor`, `representationReview`, `rightsReview`, and `reviewedAt` fields.
- A fallback treatment when an art record is absent.
- Official, derived and simulated badges that use independent shape/icon/label tokens.
- No party color used as a family token.
- The Civic Illustration Kit validates with exactly eight family, three provenance, six resource, six status, six institution and twelve issue assets.
- Runtime SVGs contain no visible semantic text, font dependency or external asset reference.

Use these exact pilot definitions:

```text
staff-policy-aide
policy-housing-choice-voucher
evidence-rent-burden-report
the alphabetically first coalition member-office card
constituency-urgent-renter-concern
institution-committee-hearing
political-media-attention
tactic-bipartisan-working-group
```

The Coalition pilot always uses a portrait-free Illustrated Civic Desk office motif and records `rightsReview: 'not-required'`. It must not acquire or substitute a portrait.

Run:

```bash
npm --prefix web run test:run -- src/art/schema.test.ts src/art/cardPresentation.test.ts
```

Expected: FAIL because the art contracts, manifest and pilot assets do not exist.

The supplied Civic Illustration Kit is not expected to fail. Before implementing the TypeScript art contracts, run:

```bash
python art/masters/modular-kit/civic-illustration-kit/validate_kit.py
```

Expected: PASS with `41 assets across 6 categories`. If it fails, repair the generator or manifest before copying any kit asset into the web runtime.

- [ ] **Step 2: Define the exact art contracts and strict parser**

Create `types.ts`:

```ts
export type ReviewState = 'not-required' | 'pending' | 'approved';

export interface ArtAssetRecord {
  assetId: string;
  cardDefinitionIds: string[];
  runtimePath: string;
  masterPath: string;
  width: 1024;
  height: 768;
  altText: string;
  credit?: string;
  referenceUrls: string[];
  aiAssisted: boolean;
  containsSemanticText: false;
  humanEditor: string;
  representationReview: ReviewState;
  rightsReview: ReviewState;
  reviewedAt: string;
  checksumSha256: string;
}

export interface ArtManifest {
  schemaVersion: 1;
  assets: ArtAssetRecord[];
}

export interface CardPresentation {
  familyColor: string;
  familyIconPath: string;
  familyLabel: string;
  sourceColor: string;
  sourceShape: 'rounded-square' | 'diamond' | 'hexagon';
  sourceIconPath: string;
  sourceLabel: 'Official record' | 'Based on records' | 'Simulated';
  illustrationPath: string;
  altText: string;
}
```

Implement a strict Zod `artManifestSchema: z.ZodType<ArtManifest>` and `parseArtManifest(input: unknown): ArtManifest`. Reject unknown fields, duplicate asset IDs, duplicate runtime paths, invalid checksums, non-HTTPS references, any `containsSemanticText` value other than `false` and review dates later than the current date.

- [ ] **Step 3: Implement approved visual tokens**

In `tokens.ts`, encode the exact family colors from the art specification:

```ts
export const FAMILY_TOKENS: Record<CardKind, { color: string; label: string; iconPath: string }> = {
  staff: { color: '#6A5485', label: 'Staff', iconPath: '/assets/icons/families/staff.svg' },
  policy: { color: '#B6503A', label: 'Policy', iconPath: '/assets/icons/families/policy.svg' },
  evidence: { color: '#267783', label: 'Evidence', iconPath: '/assets/icons/families/evidence.svg' },
  coalition: { color: '#9A6816', label: 'Coalition', iconPath: '/assets/icons/families/coalition.svg' },
  constituency: { color: '#3D754E', label: 'Constituency', iconPath: '/assets/icons/families/constituency.svg' },
  institution: { color: '#254F78', label: 'Institution', iconPath: '/assets/icons/families/institution.svg' },
  political: { color: '#844263', label: 'Political', iconPath: '/assets/icons/families/political.svg' },
  tactic: { color: '#58636B', label: 'Tactic', iconPath: '/assets/icons/families/tactic.svg' },
};
```

Add source tokens for blue rounded-square/check Official record, teal diamond/formula Based on records, and amber hexagon/spark Simulated. Party affiliation is a separate small `D`/`R` badge and may not override family tokens.

Use the kit's eight `svg/families/`, three `svg/provenance/` and six `svg/resources/` assets as the source masters for these tokens. Copy reviewed runtime exports into the matching `web/public/assets/icons/` folders; do not import files at runtime from `art/masters/`. Preserve the exact family color mapping in `tokens.ts` even when an issue illustration uses a different secondary tint.

- [ ] **Step 4: Build the reusable card shell and inspector treatment**

Update `CardView` to render a 180×252 card at 100% zoom with a top 8-pixel family band, icon and text family label, source-class badge, illustration window, two-line title limit, optional contextual subtitle, fixed time location and fixed resource-cost location. Keep the top 42 pixels readable in a fanned stack. When a controlled tag is necessary to predict a pattern, express it through the short contextual subtitle—such as “Housing evidence” or “Policy staff”—rather than a raw developer tag or inspector-only paragraph.

Render all text through Phaser or React; no semantic text may be baked into raster art. `CardInspector` must show effect, discovered pattern compatibility, cost, why it matters, provenance, method/uncertainty for derived context and the words “In this simulation” beside simulated relationship state. It may show successful example cards for discovered patterns but may not reveal exact undiscovered inputs.

- [ ] **Step 5: Produce the eight-card pilot and modular kit**

Use AI-assisted composition studies and Phaser Game Agent MCP only as development aids. Produce cleaned 1024×768 masters and optimized runtime exports for the eight pilot treatments. Use four to six colors, warm navy outlines, one dominant noun or verb, and no essential text inside the image.

Regenerate and validate the supplied kit before using it:

```bash
python art/masters/modular-kit/civic-illustration-kit/build_kit.py
python art/masters/modular-kit/civic-illustration-kit/build_sheet.py
python art/masters/modular-kit/civic-illustration-kit/validate_kit.py
```

Use its family, provenance, resource, status and institution assets as reusable source masters. Housing may be used for issue selection, Briefing Packs or the Sourcebook, but its tint may not replace a card's family color. Treat the remaining issue icons as future-module prototypes, not scope authorization.

Extend the modular kit with reusable desks, folders, reports, envelopes, calendars, office tools, hearing-room furniture, neutral hand poses, stack shadows and paper texture. The SVG kit is composition scaffolding and may not replace the eight cleaned 1024×768 pilot illustrations. Member-office art may depict a neutral office door, desk, district map shape or document wallet, but no face, portrait or intended likeness.

Author ten sample lines of restrained process-based humor in `art/reviews/humor-samples.md`. Each line must name its card or event context, remain optional to understanding and target scheduling, paperwork or procedural friction rather than a person, district or community.

- [ ] **Step 6: Implement staged art validation**

Add `validate:art` to `web/package.json`:

```json
{
  "scripts": {
    "validate:art": "tsx scripts/validate-art.ts"
  }
}
```

`validate-art.ts --stage pilot` requires the eight treatments, tokens, dimensions, checksums, alt text and metadata, but reports pending human representation decisions for Checkpoint 2. `--stage production` rejects any required pending review, missing card treatment, real-person likeness or manifest/runtime checksum mismatch.

Both stages must also execute or reproduce the checks in `validate_kit.py`: taxonomy counts, stable IDs, checksum integrity, no baked-in visible SVG text, no font dependency and no external SVG dependency. The kit manifest is a source-master manifest; it must not be merged blindly into `art-assets.json`, whose records describe runtime art treatments.

- [ ] **Step 7: Add visual interaction coverage**

Create `/dev/art-review` as a development-only gallery; call `notFound()` when `NODE_ENV === 'production'`. In `art-pilot.spec.ts`, render all eight pilot cards at 100% and 65%, fan three cards with 42-pixel headers visible, inspect one official, one derived and one simulated card, and verify reduced motion removes card-transform tweens while leaving outline and text feedback. Capture named screenshots for human review; do not use pixel snapshots as the only readability test.

Run a five-second recognition test with at least ten first-time viewers. Record family, information-class, dominant-action and contextual-tag answers in `art/reviews/pilot-review.json`. At least 90 percent of family and information-class answers, at least 80 percent of dominant-action answers and at least 80 percent of contextual-tag answers must be correct before the visual system is approved for bulk production. Review the ten humor samples separately; comprehension may never depend on the joke.

- [ ] **Step 8: Verify and commit**

```bash
python art/masters/modular-kit/civic-illustration-kit/validate_kit.py
npm --prefix web run validate:art -- --stage pilot
npm --prefix web run test:run -- src/art/schema.test.ts src/art/cardPresentation.test.ts
npm --prefix web run test:e2e -- --grep "art pilot"
npm --prefix web run lint
npm --prefix web run typecheck
git add art web
git commit -m "feat: add Illustrated Civic Desk art pilot"
```

### Task 7: Implement the pausable weekly clock, resources, and recoverable saves

**Files:**

- Create: `web/src/domain/week.ts`
- Modify: `web/src/domain/engine.ts`
- Create: `web/src/persistence/saveMigrations.ts`
- Create: `web/src/persistence/saveRepository.ts`
- Create: `web/src/persistence/playerProfile.ts`
- Test: `web/src/domain/week.test.ts`
- Test: `web/src/persistence/saveRepository.test.ts`
- Test: `web/src/persistence/playerProfile.test.ts`

**Interfaces:**

- Consumes: `TermState`, `PlayerProfile`, `GameEvent`, `ScenarioDefinition`, `executeCommand`, patterns and the frozen snapshot.
- Produces: `resolveWeek(state: TermState, scenario: ScenarioDefinition): WeekResolution`, `SaveStorage`, version-1 save migration, atomic current/previous-week persistence and `mergeLifetimeDiscoveries(profile, termState): PlayerProfile`.

- [ ] **Step 1: Write failing clock and save tests**

Cover:

- `TICK` advances `elapsedMs` only when unpaused.
- Card movement remains accepted while paused.
- A working card transforms exactly when `remainingMs` reaches zero.
- `ADVANCE_WEEK` applies expiry, unanswered-concern trust loss, relationship decay, desk-capacity penalty, morale resolution, and then increments the week.
- A successful weekly resolution autosaves.
- A simulated storage failure leaves the current save unchanged.
- A corrupt current save recovers the prior weekly checkpoint.
- An unsupported schema version returns a typed recovery result instead of throwing into the UI.
- Save/reload preserves `discoveredPatternIds` and `unlockedSlotExpansions` exactly.
- Merging lifetime discoveries produces a sorted unique profile list without changing `TermState`, RNG cursor or active matching rules.

Expected first run: FAIL because the clock and save repository do not exist.

- [ ] **Step 2: Implement pure time and weekly resolution**

Use `weekLengthMs` values of `150000` relaxed, `105000` standard, and `75000` brisk. `TICK` receives an integer `deltaMs`, clamps it to `0..1000`, and completes active patterns in deterministic card-ID order. `ADVANCE_WEEK` is valid only when the clock has expired or the player confirms early completion after all required decisions are resolved.

Implement:

```ts
export interface WeekResolution {
  nextState: TermState;
  events: GameEvent[];
  autosaveRequired: true;
}

export function resolveWeek(state: TermState, scenario: ScenarioDefinition): WeekResolution;
```

- [ ] **Step 3: Implement desk capacity and visible resource effects**

Scenario weeks 1–5 start with a desk capacity of 18 cards; weeks 6–17 use 22; weeks 18–24 use 26. Each excess unfiled card costs 1 Staff Morale, capped at a 10-point weekly loss. An unanswered urgent district concern costs the authored `trustPenalty`. Clamp all percentage resources to `0..100` and Staff Attention/Political Capital to `0..9`.

Before resolution, render the cause physically: excess cards crowd the desk boundary, urgent concerns receive a deadline stamp, unfinished assignments remain attached to staff and conditional coalition demands remain pinned to the bill. The weekly summary references those card IDs and visible states. A meter may quantify the result, but no penalty may appear without a corresponding board cue or explicit authored decision.

- [ ] **Step 4: Implement atomic local saves**

Use these keys:

```text
congress-game.save.candidate
congress-game.save.current
congress-game.save.previous-week
congress-game.player-profile
```

Define a `SaveStorage` interface over `getItem`, `setItem`, and `removeItem` for tests. Write and parse the candidate before rotating current to previous-week and promoting the candidate. Validate every read through `saveMigrations.ts`; version 1 is the only supported version in this slice. Store `PlayerProfile` separately. Update its lifetime discovery list only after a successful term save, and never read profile discoveries into `TermState` matching rules.

- [ ] **Step 5: Verify and commit**

```bash
npm --prefix web run test:run -- src/domain/week.test.ts src/persistence/saveRepository.test.ts src/persistence/playerProfile.test.ts
npm --prefix web run typecheck
git add web/src/domain web/src/persistence
git commit -m "feat: add weekly clock resources and resilient saves"
```

### Task 8: Implement bill construction and governing-value consequences

**Files:**

- Create: `web/src/domain/bill.ts`
- Modify: `web/src/domain/engine.ts`
- Test: `web/src/domain/bill.test.ts`

**Interfaces:**

- Consumes: canonical bill/resource/value types, `executeCommand`, Task 5 policy definitions and Task 7 timed pattern completion.
- Produces: `computePolicyIntegrity(provisionIds, selectedValues, scenario): number` and accepted/rejected bill/amendment command behavior.

- [ ] **Step 1: Write failing bill tests**

Test:

- Legislative Counsel + Evidence Summary + Policy Provision produces a Drafted Provision.
- A Drafted Provision added to the Bill Docket appears once in `bill.provisionIds`.
- A duplicate provision is rejected without mutation.
- Policy Integrity changes when a provision supports or conflicts with either chosen value.
- An accepted amendment can increase forecast support while reducing Policy Integrity.
- The emitted `RESOURCE_CHANGED` event explains the exact before/after value and cause.

- [ ] **Step 2: Implement value scoring**

Use the authored `valueEffects` on every provision. Recompute rather than incrementally drift:

```ts
export function computePolicyIntegrity(
  provisionIds: string[],
  selectedValues: [GoverningValue, GoverningValue],
  scenario: ScenarioDefinition,
): number;
```

Start at 60. Add 8 for each `+1` effect and subtract 10 for each `-1` effect across selected values, then clamp to `0..100`. Zero or missing effects are neutral. Display the contributing provision/value pairs in inspection data.

- [ ] **Step 3: Implement bill commands**

Transform completed drafting recipes into a drafted-provision card. Adding that card to `Bill Docket` consumes the drafted card, records the underlying policy definition ID, recalculates Policy Integrity, and emits `CARD_TRANSFORMED` plus any `RESOURCE_CHANGED` events.

Implement `ACCEPT_AMENDMENT` and `REJECT_AMENDMENT` only for a pending decision. Both resolve the decision; acceptance changes provision IDs and resources exactly as authored, while rejection changes the requesting relationship and Political Capital exactly as authored.

- [ ] **Step 4: Verify and commit**

```bash
npm --prefix web run test:run -- src/domain/bill.test.ts src/domain/engine.test.ts
npm --prefix web run typecheck
git add web/src/domain
git commit -m "feat: construct bills from sourced policy provisions"
```

### Task 9: Implement coalition work, conditional support, and a simulated vote forecast

**Files:**

- Create: `web/src/domain/coalition.ts`
- Create: `web/src/domain/votes.ts`
- Modify: `web/src/domain/engine.ts`
- Test: `web/src/domain/coalition.test.ts`
- Test: `web/src/domain/votes.test.ts`

**Interfaces:**

- Consumes: `BillState`, `RelationshipState`, `Resources`, the Task 5 House model and Task 8 provision/value effects.
- Produces: relationship transition functions, `forecastHouseVote(state, scenario): VoteForecast`, and seeded `resolveHouseVote` behavior.

- [ ] **Step 1: Write failing coalition tests**

Cover transitions from Interested → Conditional → Committed, relationship decay after neglect, demand satisfaction after adding the requested provision, and loss of support after rejecting a demand. Assert that published real-member fields never change and that all relationship state remains labeled simulated.

- [ ] **Step 2: Define the chamber model**

The player occupies one of 435 seats. During the six-week core, four curated Coalition cards represent four real member offices through portrait-free treatments; the remaining 430 seats are simulated anonymous blocs. Store the baseline and trait adjustments under a `sourceClass: 'simulated'` object in the scenario. Require every forecast to total 435 seats and return:

```ts
export interface VoteForecast {
  committed: number;
  conditional: number;
  undecided: number;
  opposed: number;
  threshold: 218;
  sourceClass: 'simulated';
  explanationKeys: string[];
}
```

This is a gameplay forecast, never a prediction of actual votes.

- [ ] **Step 3: Implement deterministic forecasting and seeded resolution**

`forecastHouseVote` uses bill traits, coalition relationships, District Trust, Bill Momentum, and authored anonymous-bloc adjustments without consuming RNG. `resolveHouseVote` consumes deterministic random values only for conditional and undecided simulated seats, records the resulting cursor, and emits the same totals for an identical state and seed.

- [ ] **Step 4: Verify and commit**

```bash
npm --prefix web run test:run -- src/domain/coalition.test.ts src/domain/votes.test.ts
npm --prefix web run typecheck
git add web/src/domain
git commit -m "feat: add coalition support and simulated vote forecast"
```

### Task 10: Implement the explainable Congressional Story Director

**Files:**

- Create: `web/src/domain/storyDirector.ts`
- Test: `web/src/domain/storyDirector.test.ts`

**Interfaces:**

- Consumes: `TermState`, `StoryEventDefinition`, `StoryCondition`, `RunSettings.termStyle`, resource metrics and deterministic RNG state.
- Produces: deterministic Story Director eligibility/selection with selected event, updated RNG cursor and `whyThisSurfaced` explanation keys.

- [ ] **Step 1: Write failing eligibility and pacing tests**

Run the director over at least 500 fixed seeds and assert:

- Ineligible events never appear.
- The same `pressureCategory` does not appear in two consecutive selected pressure events.
- Two consecutive Pressure/Consequence selections force an eligible Recovery next.
- A selected event respects its cooldown.
- Identical state, history, and seed cursor select the same event.
- Empty eligibility selects `event-recovery-office-reset`.
- `whyThisSurfaced` names state conditions, not random values.

- [ ] **Step 2: Enforce the canonical auditable condition language**

```ts
export type StoryCondition =
  | { kind: 'metric'; metric: keyof Resources; op: 'lt' | 'lte' | 'gte' | 'gt'; value: number }
  | { kind: 'week'; min: number; max: number }
  | { kind: 'stage'; anyOf: ProcedureStage[] }
  | { kind: 'hasProvision'; provisionId: string }
  | { kind: 'relationshipCount'; support: SupportState; op: 'gte' | 'lt'; value: number };

export interface StoryEventDefinition {
  id: string;
  class: 'opportunity' | 'pressure' | 'consequence' | 'recovery';
  pressureCategory?: 'district' | 'staff' | 'media' | 'coalition' | 'procedure';
  minWeek: number;
  maxWeek: number;
  cooldownWeeks: number;
  weight: number;
  conditions: StoryCondition[];
  choices: StoryChoiceDefinition[];
  whyRules: string[];
}
```

Keep this union identical to the canonical declaration in `domain/types.ts`; `storyDirector.ts` imports it rather than redeclaring it. No executable strings or arbitrary JavaScript may appear in content.

- [ ] **Step 3: Implement selection order**

Evaluate in this order: week/stage eligibility, authored conditions, cooldown, repetition suppression, forced recovery, term-style weight modifiers, seeded weighted selection, fallback recovery. Return the selected event, updated RNG cursor, and human-readable explanation keys. Difficulty and term style are separate inputs.

- [ ] **Step 4: Verify and commit**

```bash
npm --prefix web run test:run -- src/domain/storyDirector.test.ts
npm --prefix web run typecheck
git add web/src/domain/storyDirector.ts web/src/domain/storyDirector.test.ts
git commit -m "feat: add deterministic congressional story director"
```

### Task 11: Integrate the first six weeks into a playable loop

**Files:**

- Modify: `web/src/components/GameShell.tsx`
- Create: `web/src/components/SetupForm.tsx`
- Create: `web/src/components/CardInspector.tsx`
- Modify: `web/src/components/StaffHandbook.tsx`
- Create: `web/src/components/DecisionModal.tsx`
- Create: `web/src/components/ElectionOutlook.tsx`
- Modify: `web/src/components/Hud.tsx`
- Modify: `web/src/game/scenes/DeskScene.ts`
- Create: `web/src/game/scenes/DecisionScene.ts`
- Create: `web/src/domain/objectives.ts`
- Create: `web/src/domain/election.ts`
- Test: `web/src/components/SetupForm.test.tsx`
- Test: `web/src/components/ElectionOutlook.test.tsx`
- Test: `web/src/domain/objectives.test.ts`
- Test: `web/src/domain/election.test.ts`
- Test: `web/e2e/core-loop.spec.ts`

**Interfaces:**

- Consumes: Tasks 4–10 session, visual presentation, snapshot, clock, bill, coalition and Story Director interfaces.
- Produces: validated run setup, HUD/Inspector/Staff Handbook/Decision/Election Outlook UI, the pure `calculateElectionStanding` function, ordered onboarding objectives, deterministic weeks 1–6 and the autosaved six-week browser loop.

- [ ] **Step 1: Write failing setup and objective tests**

Test that setup requires one of the six districts, one party, exactly two distinct governing values, a pace, guidance level, term style, vote-information level, and policy-complexity level. Test the first nine opening objectives in the exact order from the design spec and assert that only confirmed engine events advance them; the Tactic-study and expanded-coalition objectives remain pending until Week 8 in Task 12.

Write failing election tests for this pure interface:

```ts
export function calculateElectionStanding(state: TermState): ElectionForecast;
export function calculateReelection(state: TermState): ReelectionResult;
```

Assert the exact provisional line items: baseline `50`; opponent Weak `+3`, Moderate `0`, Strong `-4`; District Trust `clamp((districtTrust - 50) * 0.30, -12, 12)`; bill outcome Active `0`, Enacted `+4`, Absorbed into package `+1`, Failed in committee `-3`, Failed in House `-4`, Failed in Senate `-3`; governing consistency `clamp((policyIntegrity - 50) * 0.04, -2, 2)`; and authored `electionEffects` summed then capped at `±6`. Round each line contribution to one decimal before calculating its running total. Assert the total is clamped to `0..100`, visible line-item running totals sum exactly to the displayed result, and the status is Favored only when the entire range is at least 50, Trailing only when the entire range is below 50 and Toss-up otherwise. Assert the range uses `±8` in Weeks 1–8, `±5` in Weeks 9–16 and `±3` in Weeks 17–24.

Prove that changing `staffMorale`, relationship count, unresolved-concern count or any demographic fixture field without changing the scored inputs does not change the result. Prove repeated calls do not read or advance the RNG and that the same state produces the same breakdown.

- [ ] **Step 2: Build setup, HUD, and inspection surfaces in React**

The HUD must show week, clock, Staff Attention, Political Capital, District Trust, Bill Momentum, Policy Integrity, and Staff Morale. The Card Inspector must show effect, discovered pattern compatibility, workload, information class, source title/date/link, and the explicit phrase “In this simulation” for simulated relationship or forecast fields.

`ElectionOutlook` shows the revealed Week 1 opponent, the current range, Favored/Toss-up/Trailing status and an expandable breakdown. Its fixed heading is **Simulated outlook — not polling**. It must never render demographic inputs, polling language or a probability of winning. Every line is announced with label, signed contribution and explanation.

Expand `StaffHandbook` to show every authored pattern in stable order. Undiscovered entries are labeled **Teased** and show only `discoveryHint` and silhouettes. First accepted use changes the entry to **Discovered** and reveals general slots, outputs and successful examples. Activated Tactic expansions change that same entry to **Expanded** and annotate the exact rule change in plain language. The Handbook opens while paused, is fully keyboard and screen-reader accessible and remains structurally separate from the Sourcebook.

Consequential decisions render in an accessible React dialog and dispatch a command only after confirmation. Opening a decision pauses the clock automatically. When a confirmed authored choice contains `electionEffect`, append exactly one `ElectionEffectEntry`, emit `ELECTION_EFFECT_ADDED`, recalculate the outlook and show the signed cause immediately. Reject an effect without `electionEffectExplanation`; never derive an election effect from demographic fields or free-form prose.

- [ ] **Step 3: Implement weekly packs and the six-week loop**

Add deterministic pack contents for weeks 1–6. A pack opens cards sequentially, but its exact contents remain hidden until revealed. Week 1 reveals the seeded opponent and includes Rent Burden Report, Urgent Renter Concern, Housing Choice Voucher and Committee Calendar Notice. Week 2 introduces Tenant Survey so the player can reuse the same Staff + housing Evidence pattern and see a different derived emphasis. Week 3 introduces Local Housing Organization as a **Constituency** card and shows a separate Teased coalition entry explaining that a future Tactic can expand it without revealing the exact key. Each week must allow at least one meaningful assignment, one district or coalition trade-off, and one filing/archiving choice. The first six weeks must support:

```text
open pack → assign staff → discover or reuse pattern → add/evaluate bill work
→ respond to district or coalition → file/archive → resolve Story Director event
→ advance week → autosave
```

At the end of week 6, show a development-only checkpoint panel rather than advancing to unfinished procedure content.

- [ ] **Step 4: Add integration E2E coverage**

`core-loop.spec.ts` must use only visible UI for the primary path and verify:

- Setup completes with GA-05, Democratic, Tenant Stability, and Fair Access.
- Week 1 reveals one deterministic opponent and the Election Outlook says **Simulated outlook — not polling**.
- The first pack opens and produces cards.
- The Handbook begins with a Teased Evidence hint; the Policy Aide completes an Evidence Summary with Rent Burden Report and the entry becomes Discovered.
- Policy Aide + Tenant Survey reuses the same pattern and produces the authored district-relevance emphasis without creating a second discovery.
- Save/reload preserves the term discovery and revealed opponent; the lifetime profile keeps a separate completion record.
- The Week 3 coalition entry remains Teased and accurately advertises a future Tactic expansion; the six-week loop does not bypass the Staff study required in Week 8.
- One provision is drafted and added to the bill.
- One constituent concern changes District Trust when ignored and changes a different resource when answered.
- One conditional coalition request is accepted or rejected.
- Paused decisions do not advance elapsed time.
- Week advancement autosaves and reload restores the same state.
- The loop reaches the week-6 checkpoint without a console error.

- [ ] **Step 5: Verify and commit**

```bash
npm --prefix web run test:run
npm --prefix web run test:e2e -- --grep "core loop"
npm --prefix web run validate:content
npm --prefix web run lint
npm --prefix web run typecheck
git add web
git commit -m "feat: integrate six-week congressional core loop"
```

## Verification Checkpoint 2 — Six-Week Core Loop

Claude Code must stop here and present the evidence before Phase 3.

Automated verification:

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test:run
npm --prefix web run validate:content
npm --prefix web run validate:art -- --stage pilot
npm --prefix web run test:e2e -- --grep "core loop|desk foundation|art pilot"
```

Manual verification:

- [ ] Complete setup in at least two contrasting districts and confirm setup copy never implies demographic determinism.
- [ ] Play weeks 1–6 on standard pace without using the test adapter.
- [ ] Complete at least three different patterns and confirm each uses the same drag/stack grammar.
- [ ] Confirm the 30-definition catalog contains exactly 16 patterns, four Tactic expansions, no ambiguous matches and at least 50 enumerated valid concrete stacks.
- [ ] Discover a pattern, save and reload, and confirm the Staff Handbook retains it; begin a new term and confirm run discovery resets while lifetime completion remains outside the term.
- [ ] Confirm the Week 1 Evidence entry moves from Teased to Discovered, the Week 3 coalition entry remains honestly Teased, and no exact hidden input is spoiled. Re-run the Checkpoint 1 fixture if you need to reconfirm the Expanded state before the full story reaches Week 8.
- [ ] Confirm the Week 1 opponent and **Simulated outlook — not polling** label survive save/reload and that no demographic field appears in the election breakdown.
- [ ] Accept one compromise and reject another; explain from the UI why resources and support changed.
- [ ] Ignore one urgent concern and verify the weekly summary explains the trust consequence.
- [ ] Before resolving that concern, identify its deadline cue on the desk; confirm staff overload and coalition demands are likewise visible before their meter effects.
- [ ] Inspect one official card, one derived card, and one simulated card; confirm their labels and fields cannot be confused.
- [ ] Save, reload, and verify the same week, cards, stacks, clock, resources, bill, relationships, and seed cursor.
- [ ] Confirm the Story Director provides recovery after sustained pressure and “Why This Surfaced” is understandable.
- [ ] Confirm a human editor approved the four six-week member-office identities, public-record copy, citations, portrait-free treatments and district-role rationales.
- [ ] Review all eight pilot cards at 100% and 65%, plus the three-card overlap view; confirm family, title and source class remain legible.
- [ ] Confirm the art uses Illustrated Civic Desk, one dominant subject/action, four to six colors and restrained process-based humor.
- [ ] Confirm the five-second recognition results meet the 90 percent family/information-class and 80 percent dominant-action/contextual-tag thresholds.
- [ ] Review all ten humor samples; reject any line that targets a person or community or is required to understand an outcome.
- [ ] Confirm the Civic Illustration Kit keeps card family, provenance and issue taxonomies independent; Evidence is never presented as a provenance class.
- [ ] Confirm the kit icons remain identifiable without color and all visible labels are rendered by the game rather than baked into runtime SVGs.
- [ ] Review the constituency pilot for plural, non-stereotyped representation and record the decision in `art/reviews/pilot-review.json`.
- [ ] Review the Coalition pilot's member-office motif and record the decision in `art/reviews/pilot-review.json`.
- [ ] Confirm the pilot contains no real-lawmaker portrait, intended likeness or AI-generated approximation.
- [ ] Complete two six-week runs with different districts or seeds; confirm at least one meaningful event, coalition demand or bill consequence changes while the same rules remain explainable.

Approval question: **Are both the repeated weekly loop and the eight-card visual system strong enough to justify the complete term and full 77-card art library?** Continue only after approval.

## Phase 3 — Complete Term, Civic Integrity, and Release Gate

### Task 12: Expand the approved content and complete procedure, reelection, and the Term Record

**Files:**

- Modify: `web/src/content/housing/vertical-slice.json`
- Modify: `web/src/content/housing/source-map.json`
- Modify: `web/src/content/catalog.test.ts`
- Modify: `web/scripts/validate-content.ts`
- Modify: `web/src/domain/votes.ts`
- Modify: `web/src/domain/election.ts`
- Create: `web/src/domain/termRecord.ts`
- Modify: `web/src/domain/engine.ts`
- Create: `web/src/game/scenes/VoteScene.ts`
- Create: `web/src/game/scenes/TermRecordScene.ts`
- Create: `web/src/components/TermRecord.tsx`
- Modify: `web/src/components/ElectionOutlook.tsx`
- Test: `web/src/domain/procedure.test.ts`
- Test: `web/src/domain/election.test.ts`
- Test: `web/src/domain/termRecord.test.ts`

**Interfaces:**

- Consumes: the user-approved 30-definition six-week catalog, `BillState`, `VoteForecast`, vote resolution, event log, resources and the Task 11 loop.
- Produces: the reviewed 77-definition/30-event/38-pattern housing catalog, 20 declarative Tactic expansions, at least 200 valid concrete stacks, a ten-office/424-anonymous House model, the Week 8 Tactic-study onboarding payoff, legal procedure transitions, committee/House/Senate resolution functions, transparent election resolution and `TermRecordData` rendered outside the canvas.

- [ ] **Step 1: Expand the catalog only after Checkpoint 2 approval**

Update the catalog tests first so they fail against the approved six-week content. Require the complete vertical-slice totals:

| Definition group | Count |
| --- | ---: |
| Staff | 3 |
| Policy provisions | 12 |
| Evidence | 12 |
| Coalition member offices | 10 |
| Constituency | 10 |
| Institution | 5 |
| Political | 5 |
| Legislative Tactics | 20 |
| **Playable definitions** | **77** |
| Story Director events | 30 |
| Authored card patterns | 38 |
| Tactic expansion definitions | 20 |
| Minimum valid concrete stacks | 200 |

Promote only reviewed housing content. Add these seven policy IDs:

```text
policy-national-housing-trust-fund
policy-transit-oriented-development
policy-community-land-trust
policy-first-generation-down-payment
policy-tenant-right-to-counsel
policy-factory-conversion
policy-resilience-retrofit
```

Add seven Evidence, six portrait-free member-office, six Constituency, two Institution, three Political and sixteen Legislative Tactic definitions, plus eighteen Story Director events, bringing each group to the exact table above. Name every new ID for its cited source or mechanical role rather than a sequence number.

Expand from 16 to exactly 38 authored patterns: eight universal Staff-action patterns, twelve cross-family patterns, eight chained provision/procedure patterns and ten patterns directly widened by Tactics. Provide one declarative effect record for each of the 20 Tactic cards; at least ten widen an existing slot, while the remaining effects alter cost, duration, output strength or procedure eligibility. No pattern may list exact input definition IDs. The density report must enumerate at least 200 valid concrete stacks and show more than one meaningful output/effect profile for each major pattern tier.

Update the House model to ten curated office seats plus 424 anonymous seats. Run the content validator and confirm it fails on the old counts before authoring the additional records, then passes with exactly 77 playable definitions, 30 events, 38 patterns, 20 expansions, at least 200 concrete stacks and 435 total seats.

- [ ] **Step 2: Write failing procedure-state tests**

Cover legal and illegal active-path transitions:

```text
draft → committee → house → senate → resolution → election → complete
```

Require two drafted provisions and one evidence-backed hearing request before committee. A committee setback must offer revision or absorption; a failed House vote must still advance toward a Term Record; a Senate change must offer acceptance or negotiation; week 22 must enter election resolution even if the bill has already failed. A terminal failure may move directly to the election phase at week 22, but it must never record success in a chamber it did not reach.

Extend `election.test.ts` with terminal cases for every bill outcome, exact running totals and `49.9 → lost` / `50.0 → won` boundaries. Assert that calling reelection does not change `rngCursor`, that every line is `sourceClass: 'simulated'`, that the visible Week 24 forecast center equals the final vote share, and that removing an authored election effect removes only its own line item.

- [ ] **Step 3: Implement political tests and partial outcomes**

Add typed resolution functions for committee hearing, markup, hostile amendment, House vote, simplified Senate result, final enactment, and reelection. Major tests pause automatically. Record every decision and result as structured events; do not reconstruct the history later from prose.

Support exactly these terminal legislative outcomes:

```text
enacted
failed-committee
failed-house
failed-senate
absorbed-into-package
```

Week 8 must deliver `tactic-bipartisan-working-group`. The player-facing route requires stacking it with eligible Staff, completing Study Tactic and then retrying the previously rejected opposing-party outreach. The same Handbook entry must move from Teased to Discovered to Expanded; do not create `requiresUnlock`, a new recipe type or an immediate activation button.

Reelection is a separate `won | lost` result produced by `calculateReelection(state)`. It reuses the visible Week 1 opponent and the same line-item calculation as `calculateElectionStanding`; it does not read the RNG or create a final uncertainty roll. Authored Story choices may append one visible `ElectionEffectEntry`, but their summed contribution is capped at `±6`. District Trust and bill outcome carry earlier concern, staff and coalition consequences, so those upstream states are not scored again as separate final line items. Demographic data is never accepted by the election interface.

- [ ] **Step 4: Generate a structured Term Record**

```ts
export interface TermRecordData {
  districtId: string;
  party: Party;
  values: [GoverningValue, GoverningValue];
  billOutcome: string;
  reelectionOutcome: 'won' | 'lost';
  reelectionVoteShare: number;
  reelectionBreakdown: ElectionLineItem[];
  finalResources: Resources;
  majorDecisions: Array<{ week: number; title: string; consequence: string; sourceClass: SourceClass }>;
  provisions: Array<{ id: string; status: 'retained' | 'removed' | 'absorbed'; citations: Citation[] }>;
  legacy: string;
}
```

Render the record in React so it is printable, selectable, keyboard accessible, and independent of the canvas. Separate factual provision/source sections from simulated results. Under **What was simulated**, render the final one-decimal vote share and every `reelectionBreakdown` row with its signed contribution, running total, explanation and amber Simulated badge. The rows must sum to the displayed result exactly. Do not display polling claims, demographic drivers or a hidden luck modifier.

- [ ] **Step 5: Verify and commit**

```bash
npm --prefix web run test:run -- src/domain/procedure.test.ts src/domain/election.test.ts src/domain/termRecord.test.ts
npm --prefix web run test:run -- src/content/catalog.test.ts
npm --prefix web run validate:content
npm --prefix web run typecheck
git add web/src/content web/scripts web/src/domain web/src/game/scenes web/src/components/ElectionOutlook.tsx web/src/components/TermRecord.tsx
git commit -m "feat: expand reviewed content and complete legislative term"
```

### Task 13: Produce and validate the complete 77-card art library

**Files:**

- Modify: `art/manifests/art-assets.json`
- Modify: `art/masters/cards/`
- Modify: `art/masters/member-offices/`
- Modify: `art/masters/modular-kit/`
- Modify: `art/references/member-offices/`
- Modify: `art/reviews/pilot-review.json`
- Create: `web/public/assets/cards/library/`
- Modify: `web/public/assets/member-offices/`
- Create: `web/scripts/build-art-contact-sheet.ts`
- Modify: `web/scripts/validate-art.ts`
- Modify: `web/package.json`
- Test: `web/src/art/library.test.ts`
- Test: `web/e2e/art-library.spec.ts`

**Interfaces:**

- Consumes: the approved pilot `ArtManifest`, all 77 `CardDefinition` records, family/source tokens, runtime `CardPresentation`, and the pilot review decisions recorded at Checkpoint 2.
- Produces: one production-valid art treatment for every playable definition, a complete asset manifest, a contact sheet and portrait-free treatments for all ten real member offices.

- [ ] **Step 1: Write the failing full-library tests**

Assert:

- Every one of the 77 playable card IDs resolves to exactly one `CardPresentation`.
- Every raster illustration is 1024×768 and every runtime file matches its manifest checksum.
- Every exported illustration records `containsSemanticText: false` and passes the manifest validator.
- Every asset has nonblank alt text, reference URLs where required and an identified human editor.
- Every culturally specific asset has `representationReview: 'approved'`.
- Every real-lawmaker treatment uses a portrait-free member-office motif with approved identity metadata.
- No real-lawmaker treatment contains a portrait, intended likeness or AI-generated approximation.
- Official public-record fields remain separate from simulated relationship overlays.
- The eight approved pilot treatments retain their approved visual tokens and composition unless a recorded review decision authorizes a change.

Run:

```bash
npm --prefix web run test:run -- src/art/library.test.ts
```

Expected: FAIL because only the eight-card pilot is present.

- [ ] **Step 2: Produce the remaining visual treatments**

Complete the library using the approved allocation:

```text
20–25 bespoke hero illustrations
30–35 modular scene combinations
15–20 icon-led procedural or tactic treatments
10 portrait-free real member-office treatments
```

The ranges overlap through reused icons and modules, but the manifest must resolve all 77 card IDs. Each illustration uses one dominant subject/action, four to six colors, warm navy outlines, simple shadows and restrained paper texture. Humor targets process rather than people or communities.

Use the validated Civic Illustration Kit for icon-led procedural and tactic treatments, family/provenance/resource/status markers, desk-zone cues and issue navigation. Do not stretch an issue icon into a card-family identifier, use an issue tint as the card's primary family color or use a generic symbol when district-specific or community-facing content requires researched illustration.

Read `art/reviews/pilot-review.json` first. Preserve approved pilot treatments. Apply recorded revisions before using the pilot as a template, and promote a pilot's pending review state to approved only when the review record names the asset, reviewer, decision and review date.

- [ ] **Step 3: Complete member-office identity records**

For each of the ten curated members, record member ID, official office/profile URL, source organization, state and district, party, retrieval date, reviewer and review date. The runtime treatment uses a neutral office motif and contains no portrait or intended likeness. The simulated support layer must remain a separate amber treatment and must not alter the official name, district or party badge.

- [ ] **Step 4: Complete representation and consistency review**

Review every constituency, district and culturally specific scene against the art specification. Record approval only after checking plural interests, documented environmental details, absence of demographic determinism, specific tribal references where applicable and humor directed at systems.

Review the full set for repeated composition, overuse of Capitol imagery, demographic patterns in negative events, family-color drift, inconsistent line weight, excessive party coding and ambiguous silhouettes.

- [ ] **Step 5: Generate the contact sheet**

Install the development-only image processor and add the script:

```bash
npm --prefix web install --save-dev sharp
```

`build-art-contact-sheet.ts` must sort by family then card ID, render every card at gameplay size, group family sections, display source-class badges and write `art/reviews/card-library-contact-sheet.png`. It must read the same manifest and tokens used by the game rather than recreating colors or labels.

Regenerate `art/masters/modular-kit/civic-illustration-kit/kit-sheet.svg` separately as the source-kit review sheet. It does not count as the 77-card contact sheet and must not be shipped as a runtime asset.

Add:

```json
{
  "scripts": {
    "art:contact-sheet": "tsx scripts/build-art-contact-sheet.ts"
  }
}
```

- [ ] **Step 6: Add full-library browser coverage**

`art-library.spec.ts` loads a development gallery containing all 77 cards and verifies that every runtime asset loads, every card exposes accessible text, all eight families retain icon/label identification, all three source classes retain shape/icon/label identification and the member-office simulated layer never obscures the official identity or record label.

- [ ] **Step 7: Run the production art gate and commit**

```bash
python art/masters/modular-kit/civic-illustration-kit/validate_kit.py
npm --prefix web run art:contact-sheet
npm --prefix web run validate:art -- --stage production
npm --prefix web run test:run -- src/art/library.test.ts
npm --prefix web run test:e2e -- --grep "art library"
npm --prefix web run lint
npm --prefix web run typecheck
git add art web
git commit -m "feat: complete reviewed 77-card art library"
```

### Task 14: Harden provenance enforcement and add the Sourcebook

**Files:**

- Modify: `web/scripts/ingest/fetch-congress.ts`
- Modify: `web/scripts/ingest/fetch-house-votes.ts`
- Modify: `web/scripts/ingest/fetch-census.ts`
- Modify: `web/scripts/ingest/normalize-housing-snapshot.ts`
- Modify: `web/scripts/validate-content.ts`
- Create: `web/src/components/Sourcebook.tsx`
- Test: `web/src/content/provenance.test.ts`
- Test: `web/src/components/Sourcebook.test.tsx`

**Interfaces:**

- Consumes: frozen snapshot/source manifest, art manifest/member-office identity records, source-class tokens and simulated relationship state.
- Produces: strengthened `validate:content`, reproducible snapshot audit and an accessible Sourcebook that separates official, derived and simulated information.

- [ ] **Step 1: Write failing provenance tests**

Assert:

- Every official fact has a direct authoritative citation and date.
- Every derived value names its source records, formula/method note, source year, and uncertainty note.
- Simulated fields cannot be stored under `officialRecord`.
- Source URLs use an allowlist containing `congress.gov`, `clerk.house.gov`, `senate.gov`, `govinfo.gov`, and `census.gov`.
- The snapshot includes a manifest with file checksums and a freeze date.
- The production browser bundle contains no API key and makes no request to those APIs during a Playwright run.

- [ ] **Step 2: Reproduce and audit the frozen snapshot**

Run the Task 5 ingest scripts into a fresh staging directory, normalize a second candidate, and compare its manifest and normalized records to the checked-in snapshot. Differences caused by later source updates are expected but must be reported record-by-record; they must not mutate the frozen gameplay snapshot. Add tests proving that fetchers refuse frozen output paths, redact `CONGRESS_API_KEY` from errors, and remain unreachable from browser imports.

- [ ] **Step 3: Enforce snapshot provenance**

Extend `validate:content` to verify the manifest checksum of every checked-in normalized source extract, reject future dates, and ensure derived records cite only IDs present in the same snapshot. A missing factual field remains absent and displays “Unavailable”; the validator must reject inferred substitutes.

- [ ] **Step 4: Build the accessible Sourcebook**

The React Sourcebook must filter by card family and information class, show source title/publisher/date/link, explain derived methods, show original source links in both languages, and keep real-member official records visually separated from current simulated relationship state. It must be usable while the game is paused and outside the canvas.

- [ ] **Step 5: Verify and commit**

```bash
npm --prefix web run validate:content
npm --prefix web run test:run -- src/content/provenance.test.ts src/components/Sourcebook.test.tsx
npm --prefix web run typecheck
git add web/scripts web/src/content web/src/components/Sourcebook.tsx
git commit -m "feat: enforce civic data provenance and sourcebook"
```

### Task 15: Complete onboarding, keyboard access, reduced motion, and Spanish UI

**Files:**

- Create: `web/src/components/AccessibleCardControls.tsx`
- Create: `web/src/content/i18n/en.ts`
- Create: `web/src/content/i18n/es.ts`
- Modify: `web/src/components/GameShell.tsx`
- Modify: `web/src/components/CardInspector.tsx`
- Modify: `web/src/game/scenes/DeskScene.ts`
- Test: `web/src/components/AccessibleCardControls.test.tsx`
- Test: `web/src/content/i18n/i18n.test.ts`
- Test: `web/e2e/accessibility.spec.ts`

**Interfaces:**

- Consumes: `GameSession`, `GameCommand`, `CardPresentation`, Inspector, Staff Handbook, Sourcebook, decision and Term Record surfaces.
- Produces: pointer-equivalent keyboard/controller controls, DOM card/stack semantics, reduced-motion behavior, persisted accessibility preferences and key-matched English/Spanish dictionaries.

- [ ] **Step 1: Write failing keyboard and translation tests**

Test that keyboard controls can select a card, choose Move/Combine/File/Archive, select a valid destination, confirm, and cancel. The resulting command must be identical to the pointer command. Test that the English and Spanish dictionaries have exactly the same keys and no blank value.

- [ ] **Step 2: Implement the DOM accessibility layer**

Expose every visible card and stack as a compact DOM list synchronized with the engine. Use buttons, lists, status regions, and dialogs with native semantics. Announce accepted/rejected stacks, completed actions, resource changes, and new decisions through an `aria-live="polite"` region. Keep the canvas `aria-hidden` only when the equivalent DOM controls are present.

- [ ] **Step 3: Complete input and preference support**

Support mouse, touch, keyboard, and controller mapping for the core actions. Persist text scale, language, reduced motion, and guidance preferences separately from the term save. When reduced motion is active, replace pack flourish, card bounce, and vote animations with instant state changes plus textual status.

- [ ] **Step 4: Add Spanish interface copy**

Translate navigation, setup, HUD labels, action verbs, tutorial objectives, information-class labels, Staff Handbook Teased/Discovered/Expanded labels, Election Outlook labels and explanations, decision controls, weekly summaries, and Term Record headings. Preserve policy names and source titles when no reviewed translation exists; add a translated summary and retain the original source link. Do not machine-translate quotations or legal text at runtime.

- [ ] **Step 5: Add automated accessibility coverage**

In `accessibility.spec.ts`:

- Run axe on setup, desk, decision, Staff Handbook, Sourcebook, vote, and Term Record surfaces with no serious or critical violations.
- Complete the first three objectives with keyboard input only.
- Confirm focus returns to the triggering control after dialogs close.
- Confirm 200% text scaling does not hide controls at a 1280×720 viewport.
- Confirm color-dependent values also have a text label and icon.
- Confirm reduced motion prevents transform tweens longer than 50 ms.

- [ ] **Step 6: Verify and commit**

```bash
npm --prefix web run test:run -- src/components/AccessibleCardControls.test.tsx src/content/i18n/i18n.test.ts
npm --prefix web run test:e2e -- --grep "accessibility"
npm --prefix web run lint
npm --prefix web run typecheck
git add web
git commit -m "feat: add accessible bilingual game controls"
```

### Task 16: Add full-term E2E, balance simulation, recovery tests, and release verification

**Files:**

- Create: `web/scripts/run-balance.ts`
- Create: `web/e2e/full-term.spec.ts`
- Modify: `web/e2e/core-loop.spec.ts`
- Test: `web/src/domain/fullTerm.test.ts`
- Test: `web/src/persistence/recovery.test.ts`
- Modify: `README.md`

**Interfaces:**

- Consumes: all domain, content, art, persistence, accessibility and UI interfaces from Tasks 1–15.
- Produces: 24-week invariant coverage, 1,000-seed balance runner, full-term browser path, recovery evidence and the final release-verification runbook.

- [ ] **Step 1: Write failing full-term invariant tests**

Drive the engine through all 24 weeks with scripted legal choices and assert:

- Every run reaches `complete` with a Term Record.
- The command log can replay to the identical final state.
- All resources remain in range.
- Every card belongs to exactly one stack or an explicit consumed/archive collection.
- Every selected story event was eligible at selection time.
- Every accepted stack has one highest-ranked pattern; no published stack has an equal-specificity/equal-priority collision.
- Every `PATTERN_DISCOVERED` event corresponds to a first accepted use and every active Tactic expansion references its declared target.
- Every Handbook entry derives exactly one Teased, Discovered or Expanded state from existing discovery/expansion fields; no parallel recipe-unlock state exists.
- No bill can skip a procedural stage.
- The vote total is always 435 and the fictional player replaces, rather than adds to, a seat.
- The revealed opponent remains unchanged from Week 1 through the Term Record; election calculation never advances `rngCursor`; final line items sum to the displayed vote share and contain no demographic input or duplicate staff/coalition/concern score.

- [ ] **Step 2: Implement a headless balance runner**

`run-balance.ts` accepts `--seeds`, `--district`, and `--style`; defaults to 1,000 seeds across all six districts and three term styles. Implement three transparent bots—integrity-first, coalition-first, and district-first—using only legal commands. Print JSON and a readable table containing enactment rate, reelection rate, combined-win rate, partial outcomes, average final resources, stalls, event repetition, provision frequency, pattern-use frequency, unused patterns, Tactic activation frequency, distinct output/effect profiles, election result distribution by opponent tier and district, mean simulated vote share, close-race frequency and each election line item's mean contribution.

The report is a calibration aid, not a target generator. It must flag any opponent tier with fewer than 100 completed samples, any final score outside `0..100`, a ledger that does not sum, an election result that changes when recalculated, or a demographic field accessed by the election module. Coefficient changes require an explicit versioned design decision; the runner must not silently tune them.

The command exits nonzero only for structural failures: a crash, an invariant violation, a run that does not complete by week 24, a missing recovery after two negative events, or an unavailable legal action. Win-rate ranges are reported for design review but are not silently tuned into the tests.

- [ ] **Step 3: Add the full browser path and recovery cases**

`full-term.spec.ts` completes one standard seeded term through setup, committee, House, Senate/final resolution, election, and Term Record. Use visible UI except for advancing real-time waits through an explicit test clock adapter that dispatches normal `TICK` commands. Verify the Week 1 opponent reveal, Teased → Discovered → Expanded Handbook story, Week 8 Staff + Tactic study, narrowing election ranges, unchanged opponent, no final roll and a final ledger whose rows sum to the displayed result.

Add recovery tests for corrupt current save, unavailable asset, unsupported save version, empty Story Director eligibility, and storage write failure. Verify each produces the documented fallback without losing the prior weekly checkpoint.

- [ ] **Step 4: Verify production behavior**

Run the production build and serve it locally. Check that no request targets government APIs, MCP endpoints, or an LLM; no development test adapter or `/dev/art-review` gallery is exposed; missing art uses the labeled fallback card; no pending-review asset is loaded; and an active term remains pinned to its starting snapshot.

- [ ] **Step 5: Run the complete automated release gate**

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test:coverage
npm --prefix web run validate:content
npm --prefix web run validate:art -- --stage production
npm --prefix web run art:contact-sheet
npm --prefix web run balance -- --seeds 1000
npm --prefix web run test:e2e
npm --prefix web run build
```

Expected: all commands exit 0. Archive the test summary, coverage summary, content counts, production art validation, contact sheet, balance report, and build output in the checkpoint notes.

- [ ] **Step 6: Update runbook and commit**

Document setup, Phaser MCP's development-only role, content refresh procedure, validation commands, save recovery, known vertical-slice limits, and production start commands in `README.md`.

```bash
git add README.md web
git commit -m "test: verify complete congressional vertical slice"
```

## Verification Checkpoint 3 — Release Candidate

Claude Code must stop and present all evidence; do not deploy or publish without a separate user request.

Automated verification:

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test:coverage
npm --prefix web run validate:content
npm --prefix web run validate:art -- --stage production
npm --prefix web run art:contact-sheet
npm --prefix web run balance -- --seeds 1000
npm --prefix web run test:e2e
npm --prefix web run build
```

Manual verification:

- [ ] A first-time tester completes the opening five objectives without verbal help.
- [ ] A standard-pace run reaches a Term Record in 45–60 minutes; record actual time and pauses.
- [ ] The tester can explain why the bill changed, identify committee/House/Senate/election stages, and name one remembered story.
- [ ] The tester can explain Teased, Discovered and Expanded in their own words and demonstrate the Week 8 Staff + Tactic study without using an inspector lookup table.
- [ ] At least one enacted, one failed, and one partial-outcome seed produce coherent Term Records.
- [ ] Keyboard-only and reduced-motion runs remain fully playable.
- [ ] Save/reload and prior-week recovery work in the production build.
- [ ] The Sourcebook opens every citation and visibly separates official, derived, and simulated content.
- [ ] The Staff Handbook separately records discoveries, hides exact undiscovered inputs, explains Tactic expansions and survives save/reload.
- [ ] The Week 1 Election Outlook names the revealed opponent, says **Simulated outlook — not polling**, narrows at the documented week boundaries and never changes the opponent.
- [ ] The final election has no spinner or hidden roll; its one-decimal vote share equals the visible ledger, and a tester can name at least two contributing decisions.
- [ ] The final validator reports exactly 38 patterns, 20 Tactic expansion definitions, zero ambiguous collisions and at least 200 concrete valid stacks with meaningful outcome variation.
- [ ] No factual statement lacks a source/date; no real lawmaker's simulated support is phrased as fact.
- [ ] The desk becomes pressured but remains organizable through filing, archiving, stack fan/collapse, pan, and zoom.
- [ ] Review the complete 77-card contact sheet for family-color drift, repeated composition, excessive Capitol imagery, ambiguous silhouettes and demographic patterns in negative events.
- [ ] Confirm every culturally specific illustration has approved representation review and every member-office treatment has approved identity metadata.
- [ ] Confirm all ten lawmaker cards use portrait-free member-office motifs, contain no intended likeness and keep simulated relationship overlays separate from official identity.
- [ ] The 1,000-seed report contains zero stalls and zero invariant violations; review dominant provision and event patterns before approving release.

Release decision: **Approve further playtesting, request balance/content revisions, or stop the vertical slice.**

## Specification Coverage Matrix

| Approved-spec requirement | Implemented/verified in |
| --- | --- |
| Stacklands-like drag, stack, separation, transformation | Tasks 3–4; Checkpoint 1 |
| Deterministic family/tag/source-class pattern matching | Tasks 2–5; Checkpoints 1–3 |
| Declarative derived resolvers and ambiguity rejection | Tasks 2–5, 12 and 16 |
| Tactics as persistent per-term rule expansions | Tasks 2–5, 11–12; Checkpoints 1–3 |
| Per-run discovery, lifetime profile and Staff Handbook | Tasks 2–4, 7, 11 and 15 |
| Teased → Discovered → Expanded onboarding story | Tasks 3–4, 11–12 and 16; Checkpoints 1–3 |
| 38-pattern/200-concrete-stack density gate | Tasks 5, 12 and 16; Checkpoints 2–3 |
| 24 Legislative Weeks and 45–60 minute standard term | Tasks 7, 12, 16; Checkpoint 3 |
| Six districts, party, and two governing values | Tasks 5, 8, 11 |
| Three staff roles and staged 30-to-77 playable definitions | Tasks 2, 5 and 12; Checkpoints 1–2 |
| 20 tactics, 20 declarative effects and 30 Story Director events | Tasks 5, 10 and 12 |
| Housing bill construction | Tasks 5 and 8 |
| Resources, overload, and weekly resolution | Task 7 |
| Conditional coalition support and vote forecast | Task 9 |
| Explainable RimWorld-inspired event pacing | Task 10 |
| Committee, House, simplified Senate, enactment, reelection | Task 12 |
| Transparent opponent reveal, narrowing outlook, no final roll and election ledger | Tasks 2, 11–12 and 16; Checkpoint 3 |
| Meaningful partial outcomes and Term Record | Task 12 |
| Official/derived/simulated separation | Tasks 5, 6, 9, 11 and 14 |
| Frozen real-data snapshot; no live runtime API | Tasks 5 and 14 |
| Deterministic save/reload and prior-week recovery | Tasks 2, 7 and 16 |
| Unlimited pause and movement while paused | Tasks 4 and 7 |
| Keyboard equivalents, screen-reader surface, reduced motion | Tasks 6 and 15 |
| Optional Spanish interface with original source links | Tasks 14 and 15 |
| Balance, stall, and event repetition validation | Tasks 10 and 16 |
| Illustrated Civic Desk card anatomy and tokens | Tasks 6 and 13; Checkpoints 2–3 |
| Eight-card pilot before bulk production | Task 6; Checkpoint 2 |
| Complete reviewed 77-card visual library | Task 13; Checkpoint 3 |
| Portrait-free real member-office treatments | Tasks 5, 6, 12–14 |
| Fun-first eight-definition/12–16-instance pattern spike and playtest thresholds | Task 4; Checkpoint 1 |
| Physical pressure visible before meter consequences | Tasks 4, 7 and 11; Checkpoints 1–3 |
| Representation, rights, alt-text and manifest review | Tasks 6, 13 and 15 |
| Restrained paper-based motion and reduced-motion equivalent | Tasks 4, 6 and 15 |
| Phaser MCP as development-only accelerator | Tasks 4, 6 and 16 |

## Primary Technical References

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest)
- [Phaser installation](https://docs.phaser.io/phaser/getting-started/installation)
- [Phaser input concepts](https://docs.phaser.io/phaser/concepts/input)
- [Phaser 4](https://phaser.io/phaser4)
- [Phaser Game Agent MCP](https://phaser.io/agent/mcp)
- [Vitest guide](https://vitest.dev/guide/)
- [Congress.gov API](https://api.congress.gov/)
- [House Clerk votes](https://clerk.house.gov/Votes)
- [Census ACS five-year data](https://www.census.gov/data/developers/data-sets/acs-5year.html)

## Final Handoff to Claude Code

Give Claude Code both approved specifications, the plain-language gameplay walkthrough and this plan. Instruct it to use `superpowers:executing-plans`, begin at Task 1, keep the checkboxes current, make the named commits, and stop after Verification Checkpoint 1. Do not begin the 30-definition catalog until the 10-minute interaction spike proves four base/five expanded valid stacks, the Staff Handbook and Tactic expansion behavior work, and the ten-person playtest passes the stated thresholds. At Checkpoint 2, review the 16-pattern/50-stack six-week loop, repeat-run variation, visible-pressure cues and eight-card art pilot before authorizing expansion to 77 definitions, 38 patterns, at least 200 concrete stacks and bulk art production. Make the release decision at Checkpoint 3.
