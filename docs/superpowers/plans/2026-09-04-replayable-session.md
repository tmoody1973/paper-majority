# Paper Majority Replayable Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete six-week housing Session in which three viable strategies compete for the same cards, staff time, and coalition commitments, then verify that players choose to replay it.

**Architecture:** Extend the existing deterministic TypeScript engine and declarative pattern system. React and Phaser remain command clients of the same GameSession. Add focused domain modules for work, bill revisions, decisions, obligations, weekly resolution and Session records; use validated frozen content and versioned local persistence.

**Tech Stack:** Existing TypeScript, Next.js 16.3.2, React 19.2.8, Phaser 4.1.x, Zod 4, Vitest and Playwright; no new runtime service or framework required.

**Spec:** [Replayable Session design addendum](../specs/2026-09-04-replayable-session-design.md), read with [original approved design](../specs/2026-08-23-paper-majority-design.md), [original implementation plan](2026-08-23-paper-majority-vertical-slice.md), and [Phase 2 build brief](../../briefs/stacklands-informed-gameplay-build-brief.md).

**Status:** Plan prepared on 2026-09-04. No gameplay implementation, source promotion, checkpoint approval, or human playtest is represented as complete.

## Global Constraints

- Node.js 20 or later is required. Preserve the lockfile and existing dependency versions unless a concrete issue requires a separate change.
- Keep all rules, random selection, deadlines, and outcomes in pure TypeScript.
- Do not add a runtime LLM. Do not call live government APIs during a run.
- Identical snapshot, seed and command sequence must produce identical results.
- Keep failed stacking free: no resource deduction, elapsed-time charge or discovery mutation occurs on `STACK_REJECTED`.
- Preserve unlimited pause, card movement while paused, keyboard equivalents for every drag action, and reduced motion.
- Do not author gameplay recipes as exact card-ID pairs. Do not embed executable functions in scenario JSON.
- Keep official records, derived context and simulation structurally and visibly separate. No real-lawmaker likenesses or demographic behavioral rules.
- Preserve the original eight-definition/12-instance spike and its four-base/five-expanded density gate as a separate legacy fixture.
- Session catalog: exactly 30 playable definitions, 16 patterns, four tactics/expansions, 12 separate Story Director events, at least 50 concrete stacks, zero equal-ranked collisions.
- Existing Checkpoints 1 and 2 remain human gates. A request to write this plan does not mark either passed.
- Do not change `docs/playtests/interaction-spike-results.md` to invent results. Preserve unrelated changes, including the pre-existing untracked `ANTIGRAVITY_SCOUT_CARD_CONTENT_UX_PROMPT.md` observed during planning.
- Execute and review one task at a time. Shared contract files must have one writer. Create commits only for completed, verified implementation tasks; this planning request does not authorize starting those tasks.

## Delivery sequence and existing task mapping

| Milestone | Tasks here | Original work mapped | Reviewable result |
| --- | --- | --- | --- |
| Entry | 0 | Checkpoint 1; ADRs 015–018 | Reconciled scope and evidence before implementation |
| A: reliable work | 1–3 | Foundations extending Tasks 2–4, schema part of 5 | Correct costs, multi-card work, canonical Session state |
| B: one strategic week | 4–7 | Tasks 7–9 / MOO-747 | Evidence → bill → demand → explicit decision → consequence |
| C: complete Session | 8–10 | Tasks 5, 10–11 | Seeded content, six-week ending, restart and recoverable saves |
| D: replay proof | 11 | Checkpoint 2 and early balance work | Human repeat-play evidence, tested alternatives, reviewed pilot |
| Later Term | Original 12–16 | Checkpoint 2 approval required | 24-week procedure, election, full art and release work |

Keep MOO-746's eight-card art pilot as an existing parallel workstream after Checkpoint 1. It must join Milestone D; no duplicate issue is needed. This document creates no Linear issues and changes no issue status.

Dependency chain: `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11`. Tests and content design can be prepared independently, but merges into types, commands, engine or GameShell follow this order. Avoid a broad engine rewrite.

## File ownership and contracts

All paths below are relative to `/Users/tarikmoody/Projects/paper-majority`. A file marked Create does not currently exist. Keep tests adjacent to their unit; named end-to-end tests live under `web/e2e/`.

| Files | Responsibility |
| --- | --- |
| Modify `web/src/domain/{types,commands,events,initialState,engine}.ts` | Canonical contracts, dispatch and integration only |
| Create `web/src/domain/{resources,work,bill,coalition,decisions,obligations,week,runSetup,sessionRecord}.ts` | Bounded pure state transitions and selectors |
| Create `web/src/domain/{storyDirector,packs,objectives}.ts` | Declarative opportunities and actual objective progress |
| Modify `web/src/domain/{recipes,patternResolvers,dropIntent,selectors,cardDetail}.ts` | Instance forms, effective rules, input/preview parity |
| Create `web/src/content/{schema,loadScenario}.ts`, `web/src/content/housing/{vertical-slice.json,source-map.json,manifest.json}` | Validated versioned catalog and reviewed sources |
| Create `web/src/components/{WorkMat,BillDocket,DecisionModal,WeekSummary,SessionSetup,SessionRecord,Sourcebook}.tsx` | Accessible actions and explanations |
| Modify `web/src/components/{GameShell,GameShellRoute,Hud,StaffHandbook,AccessibleCardControls,CardInspector}.tsx`, `web/src/app/globals.css` | Existing shell integration |
| Modify `web/src/game/scenes/DeskScene.ts`, `web/src/game/objects/{CardView,StackView}.ts`, `web/src/game/session.ts` | Render destinations, cues and engine events; persistence orchestration |
| Create `web/src/persistence/{saveMigrations,saveRepository,playerProfile,challengeCode}.ts` | Validated local state, profile and versioned setup sharing |
| Create `web/scripts/{validate-content,run-balance}.ts`, `web/scripts/balance/{policies,metrics}.ts` | Executable content and strategy checks |

### Shared state decisions

Use one canonical version-2 `TermState`; do not create a competing Session state engine. Add these structures in Task 2 and implement their behavior in the specified later tasks:

```ts
type RunMode = 'interaction-spike' | 'session' | 'term';
type InstanceForm = 'raw' | 'summary' | 'drafted' | 'prepared';
type CardLocation = 'desk' | 'filed' | 'archived';
type DueTime = { week: number; offsetMs: number };
interface WorkReservation {
  id: string;
  cardIds: string[];
  staffCardIds: string[];
  paidCost: Partial<Resources>;
  completesAtSimulationMs: number;
  billRevision?: number;
  effectiveRuleVersion: string;
  consumedCardIds: string[];
  returnedCardIds: string[];
}
type ActiveWork = WorkReservation & (
  | { kind: 'pattern'; patternId: string; effectivePattern: RecipePattern }
  | { kind: 'study'; expansionIds: string[]; effectiveExpansions: TacticExpansionDefinition[] }
);
interface Obligation {
  id: string;
  sourceId: string;
  due: DueTime;
  mandatory: boolean;
  status: 'open' | 'fulfilled' | 'missed' | 'declined';
  rewardCapital: number;
  trustPenalty: number;
}
interface PendingDecision {
  id: string;
  sourceId: string;
  expectedBillRevision: number;
  choiceIds: string[];
  status: 'pending' | 'resolved';
}
```

These types refer to the existing `Resources`, `RecipePattern` and `TacticExpansionDefinition`. Define them in `domain/types.ts`. Add `mode`, monotonic `simulationMs`, weekly `elapsedMs`, `weekPhase: 'active' | 'boundary'`, `staffCapacity` (initially 3), `activeWork`, `obligations`, `pendingDecisions`, `rewardedOccurrenceIds`, `resolvedWeekIds`, `runStatus: 'active' | 'complete'`, and an optional immutable Session record. Each CardInstance gets `form`, `location`, and explicit underlying policy/source IDs where appropriate. `BillState` adds `revision`. Relationships gain demand/promise occurrence IDs, conditions and `evaluatedRevision`; add an explicit unavailable/refused status instead of pretending every office is interested.

Authored obligation, demand, choice, mode-objective, pack-pool and staff-trait definitions belong in the canonical `ScenarioDefinition`. Published office records remain separate from these simulated definitions. Define strict discriminated schemas with the same types in Task 2; consumers cannot accept arbitrary effect objects.

Add `SUBMIT_WORK { cardIds: string[] }`, `DOCKET_PROVISION { cardId: string }`, `RESOLVE_DECISION { decisionId, choiceId, expectedBillRevision }`, `OPEN_PACK { packOccurrenceId, categoryId }`, `FAST_FORWARD`, `UNFILE_CARD { cardId }`, and `CONCLUDE_SESSION` to GameCommand. Keep current commands, but route amendment compatibility commands through an exact pending decision and reject ambiguous legacy requests. All new transitions return the existing `EngineResult`.

## Task 0: Reconcile execution authority and baseline

**Files:** Read original plan/spec, `CLAUDE.md`, `web/AGENTS.md`, ADRs 015–018, and the addendum. On implementation approval, modify only their affected scope/status paragraphs and `docs/HANDOFF.md`; do not rewrite historical decisions or completed tasks.

- [ ] Record explicit Checkpoint 1 disposition and acceptance/revision of the addendum's decision table. If evidence is absent, present the prepared running spike for that existing gate; do not manufacture a passing result or begin Phase 2.
- [ ] Resolve the original plan's House-count inconsistency in writing: total 435 equals one player seat, four curated other offices, and 430 anonymous seats. All forecast code must use this one convention.
- [ ] Preserve the old spike. Record the current commit and unrelated changes, Node version, and verification baseline. Previous-turn evidence was 184 unit/component tests, passing typecheck and 4/5 density; rerun at execution rather than treating that as a permanent guarantee.

```bash
git status --short
git rev-parse HEAD
node --version
npm --prefix web run test:run
npm --prefix web run typecheck
npm --prefix web run report:patterns
```

- [ ] If library syntax is needed during implementation, use the user-mandated Context7 library/docs lookup outside the default sandbox, and read installed Next documentation before Next edits. This plan does not require a dependency upgrade.

**Acceptance:** One recorded scope contract, unchanged historical playtest evidence, verified baseline. No new catalog or feature code before the existing gate is satisfied.

## Task 1: Reconcile resources and reserve work costs once

**Files:** Create `web/src/domain/resources.ts` and `resources.test.ts`; modify `engine.ts`, `events.ts`; extend `engine.test.ts`.

**Interfaces:** `applyResourceDelta(resources: Resources, requested: Partial<Resources>): { resources: Resources; applied: Partial<Resources> }`. `RESOURCE_CHANGED.changes` is always the signed, clamped, actual difference. Work stores paid costs so later tactic activation cannot alter refunds.

- [ ] Add the following regression and a study-start test asserting −1 attention, followed by exactly +1 on cancellation/completion. Run `npm --prefix web run test:run -- src/domain/resources.test.ts src/domain/engine.test.ts`; observe the positive-spend event failure.

```ts
it('reports the gain actually applied at the capital cap', () => {
  const before = { ...OPENING_RESOURCES, politicalCapital: 8 };
  const result = applyResourceDelta(before, { politicalCapital: 3 });
  expect(result.resources.politicalCapital).toBe(9);
  expect(result.applied.politicalCapital).toBe(1);
});
```

- [ ] Implement the existing 0–9 counter and 0–100 meter bounds in the helper. At a spend site use negated costs, not the cost object itself:

```ts
const requested = Object.fromEntries(
  Object.entries(cost).map(([key, amount]) => [key, -amount]),
) as Partial<Resources>;
const change = applyResourceDelta(state.resources, requested);
```

- [ ] Retain free rejections and consumed-vs-catalyst semantics. Assert the sum of resource events equals final minus initial resources through start, completion, cancellation and cap clipping.
- [ ] Run the targeted tests and spike density; commit `fix: reconcile resource events with actual work costs` with only this task's files.

## Task 2: Introduce validated Session contracts and instance forms

**Files:** Modify canonical types, commands, events, initial state, `content/fixtures/loadFixture.ts`, `domain/recipes.ts`; create `content/schema.ts`, `schema.test.ts`, `domain/instanceForms.ts`, `instanceForms.test.ts`, `test/fixtures/session.ts`.

**Interfaces:** `parseScenario(input: unknown): ScenarioDefinition`; `upgradeLegacyScenario(input: unknown): ScenarioDefinition`; `createRun(input: InitialStateInput & { mode: RunMode }): TermState`; `effectiveCard(instance: CardInstance, scenario: ScenarioDefinition): MatchInput`. Extend MatchInput with effective source class and instance form, not mutated public definitions.

- [ ] Write failing tests for unknown fields/effects, nonfinite/negative costs, invalid IDs, duplicate policies, invalid deadline positions, incompatible saved mode and unknown source classes. Add a test that a summary retains its source IDs and cannot be summarized repeatedly as raw evidence.

```ts
it('keeps the three starting roles and an empty bill in Session', () => {
  const state = createRun({ ...sessionSetup, mode: 'session' });
  expect(state.schemaVersion).toBe(2);
  expect(state.mode).toBe('session');
  expect(state.bill.provisionIds).toEqual([]);
  expect(state.activeWork).toEqual([]);
});
```

Define and export `sessionScenario` and `sessionSetup` from `test/fixtures/session.ts`: a small explicitly simulated unit fixture with three staff roles, one raw housing report, two policy definitions, two offices, one district concern, and one tactic. Test-only counts need not equal the published catalog; never load this fixture in normal play.

- [ ] Implement strict version-2 schemas and an explicit version-1 adapter. Keep the spike's matching/results and RNG setup unchanged. Do not cast untrusted JSON through `unknown as ScenarioDefinition`.
- [ ] Replace the canonical scenario's fixed three-entry starting-card tuple with a validated nonempty list. Session setup requires three role instances plus baseline evidence and a policy; preserve the spike adapter's exact opening desk. Extend the fixed weekly-pack list into explicit guaranteed supplies and optional pools, retaining an adapter for legacy exact packs.
- [ ] Summary/drafted forms are instances of existing evidence/policy definitions; they are not extra catalog definitions. Compute matching tags and displayed provenance from form: summaries are derived and retain citations; fictional proposed bill language is visibly simulated and identifies its precedent. The Docket renders BillState as a destination.
- [ ] Export the new commands and state interfaces above. Unknown or unsupported effect variants fail validation rather than silently doing nothing.
- [ ] Run `npm --prefix web run test:run -- src/content/schema.test.ts src/domain/instanceForms.test.ts src/domain/initialState.test.ts` and typecheck; commit `feat: define validated session state and card forms`.

## Task 3: Make multi-card work and tactic effects usable

**Files:** Create `domain/work.ts`, `work.test.ts`, `components/WorkMat.tsx`, `WorkMat.test.tsx`, `e2e/work-mat.spec.ts`; modify recipes, resolvers, dropIntent, engine, selectors, DeskScene, GameShell and AccessibleCardControls.

**Interfaces:** `previewWork(state, scenario, cardIds): WorkPreview` where `WorkPreview` is a union `{ accepted: false; reason: string } | { accepted: true; patternId: string; staffCardIds: string[]; cost: Partial<Resources>; durationMs: number; consumedCardIds: string[]; returnedCardIds: string[] }`; export it from work.ts. `SUBMIT_WORK` recomputes this preview and reserves all inputs atomically.

- [ ] Write tests rejecting duplicate input IDs, expired/filed/working cards, insufficient capacity and two jobs assigned to one staffer. A three-card valid set must succeed without first accepting an invalid pair.

```ts
const before = state.resources.staffAttention;
const result = executeCommand(state, {
  type: 'SUBMIT_WORK', cardIds: [counsel.id, summary.id, policy.id],
}, { scenario });
expect(result.state.activeWork).toHaveLength(1);
expect(result.state.resources.staffAttention).toBe(before - 1);
expect(result.state.bill.provisionIds).toEqual([]);
```

The test constructs counsel/summary/policy as three idle instances from `sessionScenario`; do not pre-mark a recipe completed or skip preview.

- [ ] Implement the Work Mat as UI selection of 2–4 card IDs with removable ghost previews and an explicit Begin Work button. Staging reserves nothing; submission validates live state. Normal two-card drags keep their current behavior and invalid drops bounce. Keyboard users select the same inputs and call the same command.
- [ ] Implement one effective-rule function used by matching, preview, start, completion, Handbook and costs. Support widen-slot, resource-cost, duration-multiplier and explicit Session procedure-eligibility. Reject output-strength in the Session schema until a resolver explicitly declares its meaning. Sort expansion IDs; clamp costs to ≥0 and duration to a positive integer. Preserve authored specificity.
- [ ] Replace resolver lookup by the first definition ID with exact slot-assigned instance IDs. Export `inputsForSlot(context: ResolverContext, slotIndex: number): MatchInput[]`; quantity-two slots return both inputs, even when they share a definition. Determine consumption from effective slots. Test duplicate-definition instances with different source lineage and different forms; never let a returned staffer be selected as the consumed input by array position.
- [ ] Store the effective rule/cost at action start. Completion and cancellation use that reservation; studying another tactic mid-job cannot change its refund or outcome. Every attention-using Session job binds actual eligible staff.
- [ ] Route timed tactic study through the same WorkReservation lifecycle with `kind: 'study'`; it still activates the canonical expansions and is not a new recipe. Resolve all applicable expansion IDs in stable order rather than taking the first match. For Session actions, derive card progress from ActiveWork, and do not also decrement old per-card assignment timers. Retain legacy timers only within the isolated spike adapter.
- [ ] Run work, dropIntent and recipes tests. Through the actual browser UI, stage three inputs, remove one, stage it again, begin, cancel, and complete; repeat by keyboard while paused and while running. Confirm the stage operation itself never spends resources.
- [ ] Commit `feat: submit multi-card work with consistent tactic previews`.

**Milestone A:** Demonstrate one three-input job and tactic preview/start parity. A green matcher alone is insufficient evidence that a player can perform it.

## Task 4: Close evidence, drafting and bill construction

**Files:** Create `domain/bill.ts`, `bill.test.ts`, `components/BillDocket.tsx`, `BillDocket.test.tsx`, `e2e/bill-docket.spec.ts`; modify resolver IDs, instance forms, engine, CardInspector, GameShell and DeskScene.

**Interfaces:** `computePolicyIntegrity(provisionIds: string[], selectedValues: [GoverningValue, GoverningValue], scenario: ScenarioDefinition): number`; `previewBillChange(state, scenario, nextProvisionIds): { integrity: number; contributions: { provisionId: string; value: GoverningValue; delta: number }[] }`. DOCKET_PROVISION consumes one drafted instance and records its underlying policy exactly once.

- [ ] Test the formula, duplicate rejection, source-lineage retention, and no premature bill change when drafting starts. Assert idempotency by dispatching the same docket command twice.

```ts
const first = executeCommand(state, { type: 'DOCKET_PROVISION', cardId }, services);
const second = executeCommand(first.state, { type: 'DOCKET_PROVISION', cardId }, services);
expect(second.state).toEqual(first.state);
expect(first.state.bill.revision).toBe(state.bill.revision + 1);
```

- [ ] Implement drafting as a preserved underlying policy plus a drafted form. Docketing recomputes values from content, increments revision, and emits signed actual changes. Do not discard the identity of the evidence used.
- [ ] Add three context-distinct uses for summary evidence in the test fixture: drafting, answering an authored office concern, and preparing a district/committee packet. Each consumes/reserves the same instance; record its use so a completed job cannot spend it twice.
- [ ] Render Docket drop target and keyboard Add to Bill. Show provision contents, source context, values and the next readiness requirement. Rejected duplicates explain why without spending anything.
- [ ] Run `npm --prefix web run test:run -- src/domain/bill.test.ts src/components/BillDocket.test.tsx`; perform evidence → summary → draft → docket by gesture and keyboard; commit `feat: construct a revisioned bill from competing evidence uses`.

## Task 5: Implement persistent coalition promises and exact decisions

**Files:** Create `domain/coalition.ts`, `coalition.test.ts`, `domain/decisions.ts`, `decisions.test.ts`, `components/DecisionModal.tsx`, `DecisionModal.test.tsx`, `e2e/coalition-decisions.spec.ts`; modify engine, commands, events, selectors, BillDocket and scenario test fixture.

**Interfaces:** `evaluateRelationships(state, scenario): RelationshipState[]`; `previewDecision(state, scenario, decisionId, choiceId): DecisionPreview`. Define DecisionPreview in decisions.ts with affected offices, next provision IDs, resource deltas, new obligations, required work and expected bill revision. Preview is read-only and consumes no RNG.

- [ ] Test interested/conditional/committed/refused transitions, duplicate outreach, both parties, incompatible demands, stale revision, repeated confirmation, missing prerequisites and reject/counter paths.

```ts
const command = {
  type: 'RESOLVE_DECISION' as const, decisionId, choiceId: 'accept',
  expectedBillRevision: state.bill.revision,
};
const once = executeCommand(state, command, services);
const twice = executeCommand(once.state, command, services);
expect(twice.state).toEqual(once.state);
expect(once.state.player).toEqual(state.player);
```

- [ ] Session outreach reads shared-interest and simulated demand definitions; do not apply party-based integrity penalties. The legacy fixture retains its original tactic demonstration. Store the approached revision and pending occurrence ID; repeated unchanged outreach gives no capital, support or Momentum reward.
- [ ] Accept/reject/counter atomically resolves a pending ID, applies only allowed authored effects, creates any costed work and obligations, then reevaluates affected relationships. Counter requires its stated evidence/time and has a real downside. Bilateral conditions reference provision tags; pattern matching never becomes exact-ID recipes.
- [ ] Bill edits call coalition evaluation and show supporters lost/regained. Supported public facts stay immutable. No cached preview can authorize a change after its revision is stale.
- [ ] If the bill changes during costed outreach, completion produces a clearly identified offer for the examined revision; it cannot commit support for the new revision. Reevaluate eligibility against the current bill before presenting a new confirmable preview. Preserve completed evidence/work products and already-paid costs without issuing a duplicate reward.
- [ ] Append decision-presented, decision-resolved, promise-changed and opportunity-declined events with stable source/occurrence IDs to accepted state history. Record explicit rejection of an offer as an accepted decision command. An invalid card combination must still leave state unchanged; keep rejected-command diagnostics in the external test trace rather than mutating TermState just to log experimentation.
- [ ] Auto-pause decisions; show gains, losses, incompatible promises and affected provisions. Focus enters the modal and returns to its trigger. Escape may close inspection but cannot accept or silently reject an unresolved choice.
- [ ] Run coalition/decisions/component tests, and accept/reject/counter through UI. Include an opposing-party agreement that preserves integrity and a same-party demand that conflicts with selected values. Commit `feat: negotiate persistent coalition promises against bill revisions`.

## Task 6: Resolve weeks, obligations, staff and income consistently

**Files:** Create `domain/obligations.ts`, `obligations.test.ts`, `domain/week.ts`, `week.test.ts`, `components/WeekSummary.tsx`, `e2e/week-boundary.spec.ts`; modify engine, Hud, CardView, StackView, AccessibleCardControls and session.ts.

**Interfaces:** `resolveWeek(state: TermState, scenario: ScenarioDefinition): EngineResult`; `previewWeek(state, scenario): { dueObligationIds: string[]; effects: Partial<Resources>; carryingWorkIds: string[] }`; `nextStopDelta(state, scenario): number`. Run ordinary TICK and FAST_FORWARD through the same transition function, in steps ≤1000ms or exact earlier stops.

- [ ] Test completion exactly at deadline, a job crossing weeks, double advancement, pause, a pending decision at the boundary, early ending and capital receipts after reload-equivalent state cloning.

```ts
const result = executeCommand(stateAtBoundary, { type: 'ADVANCE_WEEK' }, services);
expect(result.state.week).toBe(stateAtBoundary.week + 1);
expect(result.state.rewardedOccurrenceIds.filter(id => id === obligationId)).toHaveLength(1);
expect(result.state.activeWork[0].completesAtSimulationMs).toBe(originalFinish);
```

- [ ] Separate monotonic simulation time from elapsed time in the current week. Process simultaneous completion before deadline expiry. Pause on the boundary, retain unfinished work, and mark week resolution once. Confirmed early advancement processes the remaining timeline and interrupts for decisions; it cannot jump past their effects.
- [ ] Implement obligations with stable occurrence IDs and exactly-once rewards. At new weeks 2–6 apply `max(capital, 1)` and actual signed deltas. Enforce the existing capacity limits (18 cards weeks 1–5, 22 in week 6; excess costs one morale each, capped at 10). Exclude archived/filed cards from clutter counts but never from outstanding obligations.
- [ ] FILE/UNFILE/ARCHIVE reject active work; archive changes location rather than destroying obligation history. Use six filing slots initially, stated on the cabinet. Mandatory open obligations remain visible even when their source card is filed or archived. Returned workers restore exactly their held capacity.
- [ ] Render deadline stamps, due-time text, affected office slips and carrying work before applying penalties. Fast-forward stops for player decisions; ordinary movement remains possible while paused. No permanent staff resignation in this delivery.
- [ ] Run week/obligations tests and UI boundary/cancellation/fast-forward parity flows. Commit `feat: resolve visible weekly commitments and recoverable capital income`.

## Task 7: Save and recover real Session state

**Files:** Create `persistence/saveMigrations.ts`, `saveMigrations.test.ts`, `saveRepository.ts`, `saveRepository.test.ts`, `playerProfile.ts`, `playerProfile.test.ts`, `e2e/session-recovery.spec.ts`; modify session.ts and GameShell.

**Interfaces:** Preserve `SaveStorage { getItem(key): string | null; setItem(key, value): void; removeItem(key): void }`; `saveCheckpoint(storage, state, scenario): SaveResult`; `loadCheckpoint(storage, scenario): LoadResult`. Define discriminated results in saveRepository.ts: success with state, recovered-previous with state, empty, incompatible-version, wrong-snapshot, corrupt, storage-unavailable. Include actionable messages without discarding data.

- [ ] Fault-inject every read/write during candidate validation and promotion; test corrupt current, valid previous, unknown rules version, wrong content hash and interrupted storage. Test saves with pending decisions and active jobs, not only empty boards.

```ts
const saved = saveCheckpoint(storage, stateWithPendingDecision, scenario);
expect(saved.kind).toBe('saved');
const loaded = loadCheckpoint(storage, scenario);
expect(loaded.kind).toBe('loaded');
if (loaded.kind !== 'loaded') throw new Error('expected validated state');
expect(loaded.state).toEqual(stateWithPendingDecision);
```

- [ ] Validate a candidate in memory, write it under `congress-game.save.candidate`, then rotate a validated current to `congress-game.save.previous-week` only at a completed week, and replace `congress-game.save.current`. Individual browser storage writes are atomic; the sequence is not a transaction. Recovery must retain a validated old checkpoint if any later write fails. Never delete the last known-good save to make room automatically.
- [ ] Store schema/rules version, snapshot ID/hash, mode, seed/cursor, IDs/counters, forms, reservations, paid costs, bill revision, decisions, obligations, receipts, history, settings and outcome. On reload restore paused; no offline progression. Version-1 adaptation validates supported legacy inputs and supplies only safe empty new fields. Reject unknown versions without guessing.
- [ ] Autosave at weekly resolution and consequential accepted decisions. Save warnings do not rewind an already accepted in-memory command or reapply rewards. Persist a sorted, deduplicated player-profile discovery archive separately; it changes explanations only.
- [ ] Run persistence tests and reload immediately before/after a paid decision and carried job. Commit `feat: persist and recover versioned session checkpoints`.

**Milestone B:** One complete strategic week by UI, including a revised bill, a fulfilled or deliberately rejected demand, one visible consequence, and reload. Check ledger reconciliation and confirm the player can explain the choice before increasing content volume.

## Task 8: Author the reviewed catalog and bounded run variation

**Files:** Create `domain/runSetup.ts`, `runSetup.test.ts`, `domain/packs.ts`, `packs.test.ts`, `domain/storyDirector.ts`, `storyDirector.test.ts`; create catalog/manifest/source-map and `content/catalog.test.ts`, `content/loadScenario.ts`, `scripts/validate-content.ts`; modify package.json and report-pattern-density.ts only to add a separate Session report mode.

**Interfaces:** `createRun` now uses `runSetup.ts`; `eligibleStoryEvents(state, scenario): StoryEventDefinition[]`; `drawStoryEvent(state, scenario): EngineResult`; `openPack(state, scenario, packOccurrenceId, categoryId): EngineResult`. Canonical pool definitions distinguish guaranteed supplies, optional category choices, weights and fallback IDs.

- [ ] Implement original Task 5's development-only ingestion and reviewed snapshot promotion, with its exact source-map, credential-handling and refusal-to-overwrite rules. Create its listed `web/scripts/ingest/*.ts` files and staging ignore rule as part of this task; read that task's full contract before starting. No arbitrary identity/citation substitutes.
- [ ] Build the 30-definition category budget in the addendum. Preserve original five policy/three staff IDs. Define 16 family/tag patterns covering four universal staff actions, five cross-family uses, three chained provision/preparation actions and four tactic-affected actions. Map each to a concrete bill/support/obligation/capacity effect and a reachable starting path. Study remains its existing assignment path, not a seventeenth recipe.
- [ ] For each of the five evidence definitions, author its role tags, valid instance forms, transformations, underlying source lineage and sinks. At least three must offer the three competing uses in the addendum. Author one professional trait per staff role with a generalist fallback; do not change a factual record to achieve a desired balance.
- [ ] Implement all four tactic definitions using supported effects from Task 3. At least two offers arrive by Week 3 in Session; alternate strategies must finish without studying a particular tactic. Keep the original fixture density report unchanged.
- [ ] Author twelve events: three opportunities, three pressures, three consequences, three recoveries. Every event lists eligibility, choices, costs, cooldown, explanation and occurrence identity. Include one unconditional recovery fallback. Apply the original Director selection order, two-pressure recovery rule, and no consecutive same-category pressure.
- [ ] Test deterministic setup and reward occurrence identity:

```ts
const a = createRun({ ...sessionSetup, mode: 'session', seed: 417 });
const b = createRun({ ...sessionSetup, mode: 'session', seed: 417 });
expect(a).toEqual(b);
expect(eligibleStoryEvents(a, scenario).map(event => event.id)).toEqual(
  eligibleStoryEvents(b, scenario).map(event => event.id),
);
```

- [ ] Guarantee starting staff roles, a raw policy and evidence, plus a baseline path to required work. Validate reachable optional methods and fallback supply. Freeze any pack reveal in state when opened; inspection, rearranging and save/reload cannot reroll it. Consume RNG only in declared setup/pack/event transitions, in stable candidate-ID order.
- [ ] Implement `validate:content`: validate every reference, supported effect, source, ID, count and checksum; enumerate both parties and all 16 tactic subsets, reject collisions, and verify ≥50 valid unordered concrete definition sets as the original gate requires. Separately report reachable form-aware matches and distinct outcomes; multiple forms of one definition set cannot be counted as multiple definition sets to pass the original gate. Verify coverage of all eight governing values and 435-seat accounting using the Task 0 convention.
- [ ] Run content, runSetup, packs and Director tests plus `npm --prefix web run validate:content`. Promote only reviewed snapshot data. Commit `feat: add bounded housing session opportunities and strategies`.

## Task 9: Integrate a complete six-week game and honest ending

**Files:** Create `domain/objectives.ts`, `objectives.test.ts`, `domain/sessionRecord.ts`, `sessionRecord.test.ts`, `components/{SessionSetup,SessionRecord,Sourcebook}.tsx`, `components/Sourcebook.test.tsx`, `e2e/session-loop.spec.ts`; modify domain/week.ts, domain/engine.ts, game/session.ts, GameShellRoute, GameShell, Hud, OfficeBrief, StaffHandbook and i18n/en.ts.

**Interfaces:** `sessionReadiness(state): { ready: boolean; provisionGap: number; supportGap: number; overdueMandatoryIds: string[] }`; `buildSessionRecord(state, scenario): SessionRecord` with immutable setup, objective/gaps, bill, integrity contributions, promises, obligations, declined opportunities and cause event IDs. Define SessionRecord in types.ts. No election fields on the Session record.

- [ ] Test objective completion from authoritative state, partial readiness, optional decline, pending decision at Week 6, and early conclusion. Finishing freezes gameplay commands but permits inspection/export/restart.

```ts
const record = buildSessionRecord(unreadyWeekSixState, scenario);
expect(record.outcome).toBe('not-ready');
expect(record.gaps.provisionGap).toBe(1);
expect('voteShare' in record).toBe(false);
```

- [ ] Keep `?fixture=interaction-spike` routed to the existing fixture; normal play opens Session setup. Do not silently map every requested mode to the spike. Offer party, two distinct values, one of the reviewed districts, seed and existing pace/style settings. Keep Term unavailable until its original later tasks are implemented.
- [ ] Week 1 shows the six-week goal, immediate work, and the current gap. Agenda steps observe confirmed events. Weeks 2–5 show carried consequences and competing opportunities; Week 6 resolves the readiness objective, produces the record and stops without creating Week 7, granting Week 7 income, or drawing another pack.
- [ ] Add public-source inspection in React, using reviewed citations and clear simulated-demand labels. Keep concise card faces; use shape/text as well as color. Provide named completion feedback, worker return and due-state cues; integrate MOO-746's reviewed art assets without adding catalog entries.
- [ ] Add the fast-forward control from Task 6, remembered Handbook explanations from Task 7, and early conclusion at an eligible weekly boundary. Restart creates a new state through createRun; it never overwrites the finished record before export is available.
- [ ] Run objectives and record tests. Complete six weeks using UI only, with one accept path and one reject/counter path, at standard pace and relaxed pace. Check keyboard-only completion and reduced motion. Commit `feat: complete the six-week session with an explainable outcome`.

## Task 10: Share reproducible setups and preserve learning

**Files:** Create `persistence/challengeCode.ts`, `challengeCode.test.ts`, `e2e/session-replay.spec.ts`; extend playerProfile tests and SessionSetup/SessionRecord/StaffHandbook.

**Interfaces:** `encodeChallenge(setup: ChallengeSetup): string`; `decodeChallenge(code: string, scenario: ScenarioDefinition): ChallengeDecodeResult`. Define ChallengeSetup with schema/rules version, snapshot ID/hash, seed, mode, party, district, two values and all gameplay settings; define result as success with setup or failure with reason. This shares setup, not proof of an authenticated score.

- [ ] Test round trip, unsupported versions, a changed snapshot, invalid settings, excessive input length (limit 8192 characters), and deterministic first-week state. Profile discoveries must not change resources, rules or RNG.

```ts
const decoded = decodeChallenge(encodeChallenge(setup), scenario);
expect(decoded).toEqual({ ok: true, setup });
expect(mergeLifetimeDiscoveries(profile, finishedState).lifetimeDiscoveredPatternIds)
  .toEqual([...new Set([...profile.lifetimeDiscoveredPatternIds,
    ...finishedState.discoveredPatternIds])].sort());
```

Define `mergeLifetimeDiscoveries(profile: PlayerProfile, termState: TermState): PlayerProfile` in playerProfile.ts; this pure helper never writes back into TermState.

- [ ] Validate decoded data before setup; reject unavailable snapshot hashes with a readable explanation. Provide Copy Challenge and Copy Record controls and show what is shared. Use a local text record; no account, upload or automatic messaging.
- [ ] Display factual next experiments based on untried available tactics/uses and the actual ending gaps. Do not claim counterfactual outcomes. Known patterns remain usable without repeating the tutorial or gaining numerical bonuses.
- [ ] Run challenge/profile tests and replay the exported setup from a clean browser profile. Commit `feat: share versioned session challenges and retain learned patterns`.

**Milestone C:** Two complete runs from one codebase, with a genuine ending, a different viable decision sequence, local recovery and a reproducible challenge. This is a playable candidate, not evidence that replayability has passed.

## Task 11: Prove strategic variety and complete Checkpoint 2

**Files:** Create `scripts/balance/{policies,metrics}.ts`, `scripts/run-balance.ts`, `domain/sessionBalance.test.ts`, `e2e/session-accessibility.spec.ts`, `docs/playtests/session-replay-protocol.md`, `docs/playtests/session-replay-results.md`; update `docs/HANDOFF.md` only with observed results.

**Interfaces:** `PolicyId = 'district-advocate' | 'committee-specialist' | 'coalition-broker' | 'greedy-same-party' | 'district-reward'`; `chooseCommand(policyId, state, scenario): GameCommand`; `runPolicy(policyId, setup, scenario): BalanceRun`. Define BalanceRun in metrics.ts with termination status, readiness gaps, resource minima, earned/spent capital, fulfilled/missed obligations, accepted/rejected choices, used tactics, idle simulation time and command trace hash.

- [ ] Implement policies using public engine selectors and legal commands only. They have the same observable information as players; they cannot inspect future pack draws. Bound each run at 10000 commands and report exhausted bounds as failures, not successes. Complete passes use seeds 1–1000 for both parties and all five policies at standard pace, rotating reviewed district/value setups reproducibly; save the exact manifest. Add focused relaxed/brisk boundary tests separately.
- [ ] Write regression cases for repeat-outreach farming, repeated reward receipts, stale amendment confirmations, tactic refund exploits, impossible mandatory supply, fast-forward overshoot and saves with unresolved work.

```ts
expect(run.termination).toBe('complete');
expect(run.rewardedOccurrenceIds.length).toBe(new Set(run.rewardedOccurrenceIds).size);
expect(run.resourceEventTotals).toEqual(run.finalMinusInitialResources);
```

Include the last two audit fields in BalanceRun when implementing metrics.ts. Log failures with setup, trace and the first violated invariant. Do not silently reroll failed seeds.

- [ ] Implement `npm --prefix web run balance -- --mode session --seeds 1000 --parties both --pace standard`; export JSON and Markdown reports under `web/reports/session-balance/`. Report each policy separately and stratify by setup. Investigate a greedy baseline that wins on more setups while meeting every reported outcome at equal/lower cost; do not force identical win rates across approaches. A winning scripted policy is not proof that humans find it fun.
- [ ] Preserve all original Checkpoint 2 tests and MOO-746 art/source review requirements. New E2E tests must exercise actual canvas gestures/keyboard controls; the existing `interaction-spike.spec.ts` helper dispatches commands directly and is not adequate gesture evidence.
- [ ] Run the eight-player protocol from the addendum and record actual consented, anonymized results in the new worksheet. Leave it blank until people play. Measure voluntary second starts/completions, intentional approach changes, sacrifice/consequence comprehension, confusion, waiting and repetitive work. Use the addendum's proposed thresholds as revision gates, not statistically established retention claims.
- [ ] When a gameplay threshold fails, revise the smallest implicated mechanic and repeat the failed observation. Do not answer a failed replay test by automatically expanding to 77 cards.
- [ ] Complete the final command gate below, update handoff with evidence and limitations, and commit `test: validate session strategy variety and replay gates` only after the relevant automated work passes. Human acceptance remains separately recorded.

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test:run
npm --prefix web run report:patterns
npm --prefix web run validate:content
npm --prefix web run balance -- --mode session --seeds 1000 --parties both --pace standard
npm --prefix web run test:e2e
npm --prefix web run build
```

For browser tests, let Playwright own its configured port 3100 when no dev server is running. If one already serves this repository, set `PLAYWRIGHT_BASE_URL` to its verified URL rather than launching a second Next dev server. Verify the title is Paper Majority before testing; historical ports 3000/3001 may serve unrelated projects. If a sandbox blocks a local server or the tsx IPC socket, use the permitted escalation workflow rather than changing game code to hide an environment error.

**Checkpoint 2 handoff:** Present the playable URL, exact build/snapshot, eight-card art review, source review, all automated results, strategy comparison, actual human observations, failed thresholds and smallest next revisions. No 24-week or 77-card work until that checkpoint is explicitly accepted.

## Acceptance coverage and scope boundaries

| Recommendation | Implementation | Required evidence |
| --- | --- | --- |
| Competing uses for evidence | 2, 3, 4, 8 | Same instance cannot satisfy three jobs; three reachable alternatives |
| Three viable strategies | 4–6, 8, 11 | Legal traces plus intentional human approach changes |
| Persistent coalition promises | 5 | Bill edits affect support; stale/double decisions rejected |
| Meaningful staff/time limits | 3, 6 | Real staff reservations; deadlines and carryover by UI |
| Fair economy and recovery | 1, 6, 8 | Signed ledger, receipt deduplication, fallback opportunity |
| Seeded bounded variation | 8 | Frozen sources, deterministic draws, required paths reachable |
| Complete short mode | 9 | Week 6 readiness and honest partial record |
| Shared challenges and knowledge | 7, 10 | Versioned setup round trip; profile has no gameplay power |
| Accessible feedback and less waiting | 3, 6, 9, 11 | Keyboard, reduced motion, stopped fast-forward, source inspection |
| Huge replayability ambition | 11 | Measured repeat play and mastery; never inferred from combination count |

The 24-week Term remains original Tasks 12–16, using the shared contracts after Checkpoint 2. Do not ship a mode toggle that enters unfinished procedure/election states. Session conclusions never substitute for the original transparent election calculation.

## Plan verification receipt

Prepared against the current file inventory, domain state/command/event types, pattern matching, setup, existing E2E helpers, original Task 5/7/8 contracts, Phase 2 build brief and pending ADRs 015–018. Existing functionality and proposed files are distinguished above. No application code or playtest records were changed while preparing this plan. Implementation snippets define contracts or focused examples; they do not represent already implemented features or an executed test run.
