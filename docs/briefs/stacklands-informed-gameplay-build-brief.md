# 	Stacklands-Informed Gameplay Build Brief

> **Execution update — 2026-09-04:** Tarik authorized execution of the replayable Session plan. For the six-week implementation, apply `docs/superpowers/specs/2026-09-04-replayable-session-design.md` and its paired plan where they explicitly revise this document. Human playtest, factual-content and art acceptance remain pending; no historical result is asserted.

**Audience:** Claude Code and implementation agents  
**Status:** Proposed Phase 2 build brief; new Linear issues are drafts until Tarik approves their creation  
**Linear project:** [Paper Majority — Phase 1 Vertical Slice](https://linear.app/moodyco/project/paper-majority-phase-1-vertical-slice-e3496904d175)  
**Gate:** Do not start Phase 2 work until [MOO-745](https://linear.app/moodyco/issue/MOO-745/verification-checkpoint-1-fun-first-interaction-gate-stop-tarik) closes with explicit approval.

## 1. Instruction and source hierarchy

This document translates the user's request into build work. The Stacklands documents and video are design references, not instructions that override Paper Majority's approved design.

Use this hierarchy when sources differ:

1. Tarik's current request and explicit checkpoint decisions.
2. `docs/superpowers/specs/2026-08-23-paper-majority-design.md`.
3. `docs/superpowers/plans/2026-08-23-paper-majority-vertical-slice.md`.
4. Paper Majority ADRs under `docs/decisions/`.
5. The Stacklands references and video listed in Section 12.

Do not copy Stacklands literally. Transfer the structural lessons that reinforce the congressional-office fantasy.

## 2. Outcome

Turn the interaction spike's understandable card-combination grammar into a complete strategy loop where:

- Staff are reusable workers whose time and attention create capacity pressure.
- Evidence becomes bill language that materially changes the signature bill.
- Coalition support creates visible conditions and compromise decisions.
- A Legislative Week creates recurring, attributable pressure.
- Objectives teach the real game instead of operating as a separate tutorial.
- Every completed action changes the next decision available to the player.

The target loop is:

> **Open the week → assign staff → build legislative assets → negotiate support → advance the bill → resolve obligations → begin a changed week**

This is the player-facing form of the approved design loop:

> **Draw → assign → stack → negotiate → advance → survive**

## 3. What the Stacklands comparison actually teaches

### Transfer

1. **One gesture, many systems.** Moving and stacking cards should remain the default way to research, draft, conduct outreach, study Tactics, file, archive and advance bill work.
2. **Workers are catalysts.** A worker performs timed work and returns. Scarcity comes from concurrency, time and obligations rather than silently destroying the worker.
3. **Production chains must close.** A crafted output must solve or alter the next strategic problem. Evidence Summary cannot remain valuable only because it is a correct recipe output.
4. **One recurring boundary can create several pressures.** The Legislative Week should resolve deadlines, workload, desk capacity, district attention and relationship upkeep together.
5. **Growth creates upkeep.** More staff and allies create more options, but also more correspondence, morale pressure, amendment demands and scrutiny.
6. **Objectives can be the onboarding.** The opening Office Agenda should consist of real objectives driven by real engine events.
7. **Board organization can be strategy.** Filing, archiving and desk capacity should make attention physically visible.
8. **Randomness needs a legible container.** Weekly Briefing Packs may hide exact contents, but their category and possible role must be understandable.
9. **System changes need universal feedback.** Working stacks, progress, transformation, worker return and consequences should share a consistent visual and audio language.

### Do not transfer

- No generic sell-everything-for-coins economy.
- No literal food or combat system.
- No real-money packs, daily rewards or purchasable randomness.
- No large random catalog before the repeated weekly loop works.
- No automatic acceptance of ethically consequential compromises.
- Do not force explicit decisions into drag-and-drop when accessible accept/reject confirmation better protects agency and traceability.

## 4. Current state and decisions already made

- The interaction engine, deterministic matcher, tactile desk and interaction fixture exist.
- [MOO-745](https://linear.app/moodyco/issue/MOO-745/verification-checkpoint-1-fun-first-interaction-gate-stop-tarik) is in review and remains the approval gate.
- [MOO-747](https://linear.app/moodyco/issue/MOO-747/task-7-weekly-clock-desk-capacity-and-recoverable-saves-phase-2) already specifies the weekly clock, desk capacity, visible deadlines, attributable consequences and recoverable saves. Do not create a duplicate.
- [MOO-746](https://linear.app/moodyco/issue/MOO-746/task-6-eight-card-art-pilot-phase-2-blocked-on-checkpoint-1) already specifies the eight-card art pilot. Do not create a duplicate.
- `docs/decisions/011-staff-are-assigned-not-consumed.md` establishes that Staff cards are catalysts and return after every assignment. This has been implemented and must remain invariant.
- The current fixture is an interaction test, not evidence that the complete strategy loop works.

## 5. Milestone-level acceptance

Checkpoint 2 is ready for human testing when a player can complete this chain entirely through visible UI:

1. Open a deterministic Weekly Briefing Pack.
2. Assign an idle Staff card to evidence.
3. Produce an Evidence Summary and see the Staff card return.
4. Draft a provision from staff expertise, evidence and policy.
5. Add the Drafted Provision to the Bill Docket.
6. See the Working Bill and Policy Integrity change for a named reason.
7. Approach a member office and receive interested, conditional, committed or refused support.
8. Explicitly accept or reject a pending amendment request.
9. File or archive at least one card to manage desk capacity.
10. Resolve a visible district or workload obligation at the end of the week.
11. Open the next week in a changed state and recover that state after reload.

The interaction must satisfy the five mechanic checks:

- **Clarity:** the player can predict the broad class of result before committing.
- **Motivation:** each output affects the bill, coalition, weekly survival or future options.
- **Response:** inputs can be arranged, cancelled and resolved without corrupting state.
- **Satisfaction:** important actions fire at least two feedback channels and make state change visible.
- **Fit:** the interaction reads as running a congressional office rather than crafting arbitrary objects.

## 6. Linear issue map

The following order matches the approved vertical-slice plan. Proposed issues must be created in the existing Linear project and assigned to the Moodyco team.

| Order | Linear work | State | Dependencies |
| --- | --- | --- | --- |
| Gate | MOO-745 — Verification Checkpoint 1 | Existing, In Review | MOO-744 |
| Parallel | MOO-746 — Eight-card art pilot | Existing, Backlog | MOO-745 approval |
| 1 | Proposed Task 5 — Validated housing scenario and Briefing Pack catalog | Draft | MOO-745 approval |
| 2 | MOO-747 — Weekly clock, desk capacity and recoverable saves | Existing, Backlog | MOO-745 approval |
| 3 | Proposed Task 8 — Close the policy production loop with the Bill Docket | Draft | Task 5 and MOO-747 |
| 4 | Proposed Task 9 — Conditional coalition support and explicit amendment choices | Draft | Task 8 |
| 5 | Proposed Task 10 — Explainable Congressional Story Director | Draft | Task 5 and MOO-747; may proceed alongside Task 8/9 once interfaces are stable |
| 6 | Proposed Task 11 — Office Agenda and playable six-week loop | Draft | MOO-746, Task 5, MOO-747 and Tasks 8–10 |

## 7. Proposed Linear issue contracts

### Proposed Task 5 — Build the validated housing scenario and Briefing Pack catalog

#### Intent

Replace force-cast fixture content with a validated, sourced six-week housing scenario that can support meaningful production chains, weekly packs, coalition work and Story Director events.

#### Acceptance criteria

- [ ] Add a strict Zod `scenarioSchema` and `parseScenario(input: unknown): ScenarioDefinition`; do not create a second domain interface.
- [ ] Reject unknown fields, tags, resolver IDs, broken references, invalid costs and ambiguous pattern collisions.
- [ ] Add the reviewed six-week snapshot with exactly 30 playable definitions, 16 patterns, four Tactic expansions and 12 separately stored Story Director events.
- [ ] Enumerate at least 50 valid unordered concrete stacks and report density by pattern, family combination and output.
- [ ] Preserve official/derived/simulated information classes and require HTTPS citations plus retrieval dates for official and derived records.
- [ ] Keep real member-office facts separate from simulated relationship state.
- [ ] Implement the currently declared `validate:content` command so it no longer points to a missing script.
- [ ] Keep ingestion development-only, refuse to overwrite frozen snapshots and never expose credentials or live APIs to the game runtime.

#### Verification checklist

- [ ] Observe schema and catalog tests fail before implementation.
- [ ] `npm --prefix web run validate:content` exits zero and prints the exact catalog counts and density report.
- [ ] `npm --prefix web run test:run -- src/content/schema.test.ts src/content/catalog.test.ts` passes.
- [ ] Invalid fixtures covering broken references, authored party-relative tags, resolver mismatches and pattern collisions fail with actionable messages.
- [ ] Manifest checksums match the reviewed frozen snapshot.
- [ ] A production browser run makes no request to Congress.gov, Census, House Clerk, Linear, MCP or an LLM.

#### Out of scope

Card art, full-term content, bill commands, coalition simulation and Story Director selection logic.

---

### Proposed Task 8 — Close the policy production loop with the Bill Docket

#### Intent

Make drafting strategically meaningful by turning Evidence and Policy work into persistent bill provisions whose value consequences are visible and explainable.

#### Acceptance criteria

- [ ] Legislative Counsel + Evidence Summary + Policy produces a Drafted Provision through the canonical matcher.
- [ ] Adding a Drafted Provision to the Bill Docket consumes the drafted card and records its policy definition exactly once in `bill.provisionIds`.
- [ ] Duplicate provisions are rejected without mutation or resource cost.
- [ ] Policy Integrity is recomputed from the bill's provision IDs and the player's two selected governing values rather than incrementally drifting.
- [ ] The Card Inspector lists the provision/value contributions behind Policy Integrity.
- [ ] Bill changes emit deterministic `CARD_TRANSFORMED` and signed `RESOURCE_CHANGED` events with exact before/after values and causes.
- [ ] Staff catalysts return to idle when drafting completes or is cancelled.
- [ ] The desk shows a clear working stack, universal progress, returned Staff card, transformed output and updated Bill Docket.

#### Verification checklist

- [ ] Observe bill and engine tests fail before implementation.
- [ ] Unit tests prove successful drafting, duplicate rejection, recomputation and deterministic replay.
- [ ] A visible-UI E2E creates a Drafted Provision, adds it to the Bill Docket and verifies the named integrity contribution.
- [ ] State before/after plus emitted event deltas reconcile exactly.
- [ ] Cancelling at every assignment stage returns Staff Attention and the Staff card without duplicating inputs or outputs.
- [ ] `npm --prefix web run test:run -- src/domain/bill.test.ts src/domain/engine.test.ts` and `npm --prefix web run typecheck` pass.

#### Out of scope

Vote resolution, Senate procedure, full art, Story Director selection and election scoring.

---

### Proposed Task 9 — Implement conditional coalition support and explicit amendment choices

#### Intent

Turn outreach into a strategic negotiation loop where support is conditional, compromises are explicit player choices and every benefit or cost is traceable to a visible office or demand.

#### Acceptance criteria

- [ ] Relationship state supports Interested → Conditional → Committed plus authored refusal and decay paths.
- [ ] Same-party outreach can succeed under the base rule; opposing-party outreach remains unavailable until the relevant Tactic expansion is learned.
- [ ] Studying a Tactic returns its Staff catalyst and visibly annotates the expanded Handbook rule.
- [ ] A conditional office attaches an amendment-request slip to the Working Bill before any consequence is applied.
- [ ] Outreach never automatically accepts an amendment or automatically reduces Policy Integrity.
- [ ] `ACCEPT_AMENDMENT` and `REJECT_AMENDMENT` are valid only for a pending decision and each applies only its authored, explained consequences.
- [ ] Acceptance or rejection updates relationship state, resources and bill provisions deterministically.
- [ ] The simulated House forecast totals 435 seats, labels itself simulated and explains its committed, conditional, undecided and opposed counts.
- [ ] Published real-member facts remain immutable; all support and demand state remains explicitly simulated.

#### Verification checklist

- [ ] Unit tests cover every relationship transition, demand satisfaction, rejection, decay and immutable published fields.
- [ ] E2E proves Ridgeline refuses before the Tactic and succeeds after the completed Staff + Tactic study.
- [ ] E2E proves a conditional offer causes no integrity loss until the player confirms acceptance.
- [ ] Accept and reject paths each display the named office, demand and signed resource/bill changes.
- [ ] Identical state and seed produce identical forecasts and resolution events.
- [ ] Forecast totals always equal 435 and never present themselves as real polling or a prediction of actual lawmakers.

#### Out of scope

Senate negotiation, final House vote UI, real-world vote prediction and Story Director event selection.

---

### Proposed Task 10 — Implement the explainable Congressional Story Director

#### Intent

Give each week variable but auditable political developments so players must adapt without feeling that the game is inventing arbitrary punishment.

#### Acceptance criteria

- [ ] Story conditions use only the canonical declarative union; content cannot contain executable strings or arbitrary JavaScript.
- [ ] Selection evaluates eligibility, conditions, cooldown, repetition suppression, forced recovery, term-style modifiers and seeded weighting in the documented order.
- [ ] The same pressure category cannot be selected twice consecutively.
- [ ] Two consecutive pressure/consequence selections force an eligible recovery event.
- [ ] Empty eligibility selects the authored recovery fallback.
- [ ] Every surfaced event returns `whyThisSurfaced` explanation keys naming visible state conditions rather than random values.
- [ ] Weekly Briefing Packs reveal exact contents sequentially while keeping their category visible beforehand.
- [ ] Packs represent office capacity and uncertainty only; they contain no real-money or retention mechanics.

#### Verification checklist

- [ ] Run the Story Director over at least 500 fixed seeds and prove eligibility, cooldown, repetition and recovery invariants.
- [ ] Identical state, history and RNG cursor select the same event and update the cursor identically.
- [ ] Every selected pressure or consequence references a visible condition, card, relationship or unfinished obligation.
- [ ] A player can pause and organize the desk while opening or evaluating a pack; paused time does not advance.
- [ ] `npm --prefix web run test:run -- src/domain/storyDirector.test.ts` and `npm --prefix web run typecheck` pass.

#### Out of scope

LLM-generated events, live news, arbitrary scripting, monetized packs and full-term event content.

---

### Proposed Task 11 — Build the Office Agenda and playable six-week loop

#### Intent

Integrate the clock, packs, production chain, coalition decisions and Story Director into a repeated six-week game loop whose onboarding is the actual progression system.

#### Acceptance criteria

- [ ] Add a persistent Office Agenda driven only by confirmed engine events.
- [ ] Week 1 presents a visible six-week objective expressed through the Working Bill, coalition support and office obligations; the player can inspect current progress and the remaining gap at any time.
- [ ] The opening objectives teach opening a pack, assigning Staff, producing a summary, drafting a provision, adding it to the Bill Docket, approaching an office and managing one obligation.
- [ ] Objectives never complete from UI clicks alone or from unconfirmed intent.
- [ ] Each of weeks 1–6 contains at least one meaningful assignment, one district or coalition trade-off and one filing/archiving decision.
- [ ] Each week presents at least one constrained decision with two viable paths, a visible opportunity cost and a consequence that changes a later option; completing the known recipe chain is never the only meaningful decision.
- [ ] Every completed production chain changes at least one persistent strategic state: the Working Bill, coalition support, an obligation, available capacity or a learned Tactic.
- [ ] The next Weekly Briefing names at least one consequence carried forward from the player's previous decisions.
- [ ] The visible weekly loop is: open pack → assign Staff → discover/reuse a rule → add/evaluate bill work → respond to an obligation → file/archive → resolve event → advance → autosave.
- [ ] The Handbook separately communicates base recipes discovered and Tactic expansions learned; it does not imply completion while a relevant Tactic remains unlearned.
- [ ] Important completions show anticipation, progress, transformation, worker return, the named consequence and the next strategic option through at least two accessible feedback channels.
- [ ] Decisions pause the clock and require explicit accessible confirmation.
- [ ] Reload restores the same week, board, bill, relationships, discoveries, objectives and deterministic RNG cursor.
- [ ] Week 6 resolves the visible six-week objective with an explainable bill-and-coalition assessment, then ends at a development checkpoint rather than entering unfinished procedure content.

#### Verification checklist

- [ ] A visible-UI E2E completes the primary six-week path without direct state dispatches.
- [ ] Save/reload at the end of every week preserves authoritative state exactly.
- [ ] A first-time human tester can complete the opening five objectives without facilitator rescue.
- [ ] New-player test: the player can describe the Evidence → Summary → Provision → Bill chain.
- [ ] Stress test: repeated invalid combinations, cancellations, pause/rearrange and weekly boundaries do not corrupt stacks or resources.
- [ ] Skill test: a returning player can preserve Staff capacity, avoid at least one deadline and improve their coalition outcome.
- [ ] Abuse test: duplicate provisions, repeated amendment confirmation and save reload cannot duplicate benefits.
- [ ] Readability test: an observer can name the card, demand, deadline or unfinished job behind every setback.
- [ ] Full unit, E2E, content validation, lint, typecheck and production build gates pass.

#### Engagement and motivation gate (required for completion)

Task 11 cannot move to Done on automated verification alone. Test the complete six-week slice with at least five first-time players who enjoy strategy games; prioritize players who are not already familiar with Congress. Do not coach beyond the instructions available in the build.

- [ ] At least four of five players can state both their immediate objective and the six-week objective after Week 1 without being shown the objective text again.
- [ ] At least four of five players can identify a decision where they gave up one useful option to protect or pursue another, and can name a later consequence of that choice.
- [ ] At least four of five players agree or strongly agree with “I wanted to see what happened next,” and each cites a specific bill, coalition, deadline, obligation or event as the reason.
- [ ] At least four of five players identify a specific action completion or reveal that felt satisfying and can describe the visible or audible feedback that made it land.
- [ ] At least four of five players can explain why an Evidence Summary or Drafted Provision mattered beyond completing a recipe.
- [ ] No more than one player describes the primary experience as following a predetermined sequence of correct card combinations.
- [ ] Run at least two returning-player sessions. Each player can pursue a materially different valid sequence, anticipate at least one consequence and intentionally improve or alter their bill, coalition or office outcome.
- [ ] Record anonymized session notes, the post-play responses, relevant event traces and every failed threshold. Attach the evidence to the Linear issue.
- [ ] Any failed threshold blocks completion until the design is revised and the failed check is rerun; do not convert a failed engagement result into a documentation-only exception.

#### Out of scope

Weeks 7–24, committee and chamber procedure, final reelection resolution, Spanish localization and the full 77-card art library.

## 8. Claude Code execution rules

For each approved Linear issue:

1. Read the Linear issue before editing code. The issue is the contract.
2. Confirm Intent, Acceptance criteria, Verification checklist and Out of scope are present.
3. Move only that issue to In Progress.
4. Write failing tests first where the contract requires them.
5. Implement only the accepted scope and preserve unrelated user changes.
6. Verify against the real fixture, browser and saved state rather than asserting completion.
7. Commit atomically with the Linear identifier in the commit message.
8. Post concise verification evidence to the issue.
9. Move the issue to Done only after every acceptance and verification item passes.
10. Stop at the next checkpoint requiring Tarik's judgment.

Do not merge several proposed issues into one implementation pass. Their dependency order protects the deterministic engine and keeps gameplay judgments reviewable.

## 9. Tuning order

If the integrated loop does not feel good, tune in this order:

1. **Response:** broken drag, cancel, separation, pause or state transitions.
2. **Clarity:** missing preview, cause or transformation feedback.
3. **Motivation:** outputs that do not affect the bill, support or weekly survival.
4. **Satisfaction:** weak progress, completion, sound or movement feedback.
5. **Fit:** language or presentation that feels like abstract crafting rather than congressional work.
6. Only then tune resource values, timing and event weights.

## 10. Checkpoint 2 approval question

> Does the repeated six-week loop make the player feel that they are allocating a congressional office's limited attention, converting evidence into legislation and choosing which compromises and obligations their bill can survive?

Do not authorize full-term content until human playtests answer this positively.

## 11. Explicit risks to watch

- A correct use of the learned grammar must never remove the only path to a required future action.
- Staff Attention, Staff-card availability and active jobs must always agree.
- No meter may change without a visible cause or explicit confirmed decision.
- The Handbook must not confuse recipes discovered with Tactics learned.
- The Office Agenda must guide without revealing every exact recipe.
- Briefing randomness must create adaptation, not dependency-chain dead ends.
- A crowded desk must create prioritization without making cards physically unusable.
- Coalition support must never imply a prediction of actual member behavior.
- Adding more systems must not create additional primary interaction languages.

## 12. References

- `references/inspiration/stacklands-game-mechanics-core-loop-breakdown.md`
- `references/inspiration/stacklands-ux-interface-design-reference.md`
- `references/inspiration/game-mechanics-core-loop-template.md`
- [Stacklands beginner guide video](https://www.youtube.com/watch?v=CtpTnETb1Mc)
- `docs/superpowers/specs/2026-08-23-paper-majority-design.md`
- `docs/superpowers/plans/2026-08-23-paper-majority-vertical-slice.md`
- `docs/decisions/011-staff-are-assigned-not-consumed.md`
- `docs/playtests/interaction-spike-guide.md`
- `docs/playtests/interaction-spike-results.md`
