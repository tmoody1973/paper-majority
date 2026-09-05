# Handoff — Paper Majority, Phase 1

> **Checkpoint 2 automated candidate — 2026-09-05:** The six-week Session implementation is on `codex/replayable-session`, based on reviewed commit `770077cf0f84c4267f9c75929942686ffbfeab2b`. The frozen candidate is `housing-session-2026-09-04-candidate`, rules version 2, hash `ff90f497eaf2efc4c4e18877ff360f824f2ffe2391badbb44900d6301f0a13e4`. Task 11's commit is identified by message `test: validate session strategy variety and replay gates` in this branch's git history.
>
> The automated balance manifest covers seeds 1–1000, both parties, five policies, standard pace, and the deterministic six-district/value rotation in `web/reports/session-balance/manifest.json`. All 10,000 runs completed with zero harness failures. Ready outcomes were district advocate 2,000/2,000, committee specialist 1,892/2,000, coalition broker 2,000/2,000, greedy same-party 2,000/2,000 and district reward 2,000/2,000. The committee policy's 108 completed `not-ready` endings remain in the denominator as outcomes. Illegal commands, stuck runs, invariant violations and the 10,000-command bound remain harness failures.
>
> The five scripts produce different staff, Story, office-order and Tactic-learning priorities. Their action frequencies, completed paths and trace counts are in `web/reports/session-balance/report.md`; all policy runs use player-observable information only. Four policies learn distinct Tactics, but none applies its learned rule to a completed target job in this cohort; no Tactic use is inferred from unlock alone. Matched comparisons found neither greedy same-party nor district reward dominated all three intended approaches. District reward and district advocate had no paired disadvantage and equal readiness, so district reward did not win more setups; the other baseline comparisons exposed trust, momentum, morale or idle-time tradeoffs. The scripts have distinct choices and investments, while human-perceived variety and actual Tactic-route appeal remain unproven.
>
> Actual-control browser acceptance is `web/e2e/session-accessibility.spec.ts`: it closes the opening Story, moves a real canvas card by pointer, completes the documented ready strategy through keyboard controls, checks the ending with axe, copies/exports the frozen record, reloads exact saved bytes and Resumes the same record. Existing not-ready, accept/reject/counter, Work Mat, Docket, reduced-motion and legacy fixture tests remain separate.
>
> **Checkpoint 2 is not accepted.** The housing content is still candidate/human-review-pending. Human source/editorial review, the MOO-746 reviewed eight-card art pilot and eight consented participant sessions are pending. `docs/playtests/session-replay-results.md` remains `NOT RUN`; bot readiness does not establish fun or human replayability. No 24-week or 77-card work is authorized before explicit acceptance.

The review build is currently verified as **Paper Majority — A Congressional Strategy Game** at [http://127.0.0.1:3100](http://127.0.0.1:3100) (local Next dev process PID 20039). If the process has ended, restart the same worktree with the command below and verify the title before review.

## Current Session startup

```bash
npm --prefix /Users/tarikmoody/Projects/paper-majority/.worktrees/replayable-session/web run dev -- --hostname 127.0.0.1 --port 3100
```

## Current Session commands

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test:run
npm --prefix web run report:patterns
npm --prefix web run report:patterns:session
npm --prefix web run validate:content
npm --prefix web run balance -- --mode session --seeds 1000 --parties both --pace standard
npm --prefix web run test:e2e
npm --prefix web run build
```

Playwright owns `http://127.0.0.1:3100` for its suite. If a verified Paper Majority server is already running there, use `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100`; never reuse ports 3000/3001 without checking the page title.

> **Replayable Session implementation — 2026-09-05:** Tarik authorized the [replayable Session plan](superpowers/plans/2026-09-04-replayable-session.md). The implementation is on `codex/replayable-session`; current automated evidence is in `web/reports/session-balance/` and the Session command block above. The historical Phase 1 report below remains evidence of that earlier build. Its old stop instruction does not override the completed six-week implementation; human replay, content and art acceptance remain pending.

**Written:** 2026-08-26 · **HEAD:** `776b295` · **Branch:** `main`

Read this first if you are picking the project up cold. It is the shortest path to
being useful without repeating a morning of discoveries.

---

## 1. Where things stand in one paragraph

Phase 1 is **built and green**, sitting on the Checkpoint 1 gate waiting for a
ten-person playtest. Tasks 1–4 of the implementation plan are complete and committed.
152 unit tests and 33 end-to-end tests pass. The pattern-density gate reports exactly
the four base and five expanded valid stacks the checkpoint demands. **Nothing is
blocked on the assistant.** The next move belongs to Tarik: play the ten-minute run,
then run ten testers, then approve or send it back.

**Do not start Phase 2 (Task 5 onward) until MOO-745 closes with a yes.**

---

## 2. Read these, in this order

| # | File | Why |
|---|---|---|
| 1 | `CLAUDE.md` | Project rules. Overrides everything else. |
| 2 | `docs/superpowers/plans/2026-08-23-paper-majority-vertical-slice.md` | The plan. Highest authority after CLAUDE.md. |
| 3 | `docs/superpowers/specs/2026-08-23-paper-majority-design.md` | Gameplay and civic-integrity rules |
| 4 | `docs/superpowers/specs/2026-08-23-paper-majority-art-design.md` | Card anatomy, families, motion timings |
| 5 | `docs/playtests/what-this-test-is.md` | What the ten-minute run is, in plain English |
| 6 | `docs/decisions/*.md` | Ten decisions with reasoning and cost. **Read 009 before touching the fixture.** |
| 7 | `docs/LEARNING-LOG.md` | What we expected vs what happened |

The specs were edited in `22587a0` to record an approved label change. They are current.

---

## 3. Running it

**Manual play — in a human's own terminal, not a background task:**

```bash
npm --prefix /Users/tarikmoody/projects/paper-majority/web run dev -- --hostname 127.0.0.1 --port 3001
```

Then `http://127.0.0.1:3001/?fixture=interaction-spike`

**Verification, all of it:**

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test:run          # 152 tests
npm --prefix web run report:patterns   # must say 4 base, 5 expanded
npm --prefix web run test:e2e          # 33 tests, starts its own server on 3100
python3 art/masters/modular-kit/civic-illustration-kit/validate_kit.py   # 41 assets
```

**To run E2E against an already-running dev server** (Next 16 refuses to start a second
dev server for the same directory):

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npx playwright test
```

---

## 4. Traps that cost real time. Do not rediscover these.

### Environment

- **Port 3000 is occupied** by an unrelated Codex/ChatGPT Next app on this machine. Use
  **3001** for manual play. Playwright owns **3100** and is configured never to reuse a
  server it did not start — `e2e/identity.spec.ts` fails loudly if the suite ever lands
  on the wrong application.
- **Next 16 will not run two dev servers for one directory.** Manual server and E2E
  cannot both start one. Use `PLAYWRIGHT_BASE_URL` to point at the running one.
- **Node 26 ships its own disabled `localStorage`**, and Vitest skips copying any jsdom
  key that already exists on `globalThis`. Fixed with `execArgv:
  ['--no-experimental-webstorage']` in `vitest.config.ts`. Do not remove it.
- **Testing Library's auto-cleanup does not register** when Vitest globals are off.
  `afterEach(cleanup)` is in `src/test/setup.ts`. Removing it makes every
  `getByTestId` find duplicates.
- **Background dev servers started by the assistant get killed** when the session
  reaps tasks. Ask the human to run it in their own terminal.
- **Never claim the server is up without curling it.** This was got wrong twice, once
  against a completely different application that happened to return 200.

### Phaser

- `body` and `data` are **reserved on Phaser's `Container` and `Scene`**. Naming your
  own fields that collides silently and produces baffling type errors.
- **Phaser's boot queue starts scenes with no data.** Passing the session through
  `scene.start(key, data)` alone is not enough — `DeskScene.create` ran with
  `session === undefined`. The session travels in `game.registry` under `deskData`.
- **`audio: { noAudio: true }`** is deliberate. Without it Phaser opens a WebAudio
  context the game never uses, and every teardown throws
  `InvalidStateError: Cannot suspend a closed AudioContext`. When sound arrives it will
  need its own lifecycle handling. `e2e/lifecycle.spec.ts` counts context constructions
  and fails if any appear.
- **Screen coordinates come from `camera.worldView`, not `camera.scrollX`.** Phaser zooms
  about the camera midpoint, so the naive formula is wrong the moment zoom is not 1.
- **The clock redraws the desk ten times a second.** `DeskScene.draggingCardId` exists so
  that redraw leaves the held card alone. Without it the redraw resets the card's
  position *and its depth*, and the lost depth made the pan handler mistake a card drag
  for a desk pan. Cards became undraggable while the clock ran.

### Testing

**Every single bug in this phase was found by a human clicking, not by a test.** Ten of
them. The pattern is always the same: the tests drove `GameSession` directly and skipped
the gesture layer, so the engine was provably correct while the game was unusable.

Concrete cases:
- Study Tactic was unreachable by mouse — the drag path only ever dispatched
  `STACK_CARD`. The E2E test called `START_ASSIGNMENT` directly and never noticed.
- The drag test only ran while **paused**, because that is the default state. The whole
  running-clock path was untested.
- A drag test passed while the bug was live because it only checked the end state. It
  now samples the *rendered* card position every frame.
- A test passed vacuously after a taxonomy change: both sides returned `undefined` and
  the assertion compared nothing. Assert `toBeDefined()` on both sides of a comparison.

**If you change anything a player touches, test it through the gesture.**

---

## 5. What exists

### The shape of it

```
web/src/domain/     pure TypeScript. All rules, randomness, outcomes. No React, no Phaser.
web/src/game/       Phaser 4. The desk, cards, drag, camera. Dispatches commands only.
web/src/components/ React. HUD, Staff Handbook, inspector, office brief, key panel.
web/src/content/    The interaction-spike fixture and result phrases.
```

`GameSession` (`src/game/session.ts`) is **the only object allowed to replace
authoritative state.** React and Phaser share one instance and both go through
`dispatch`.

### The fixture

`web/src/content/fixtures/interaction-spike.json` — **8 card definitions, 12 instances,
3 rules, 1 Tactic expansion.** Every card on the desk takes part in a rule; see decision
009 for why that is now a hard requirement.

| Rule | Inputs | Output |
|---|---|---|
| `pattern-evidence-summary` | Staff *(policy-focused)* + Evidence *(housing)* | Evidence Summary |
| `pattern-drafted-provision` | Evidence *(summary)* + Policy *(housing, renter-focused)* | Drafted Provision |
| `pattern-coalition-outreach` | Policy *(working-bill, catalyst)* + Coalition *(same-party)* | Outreach Result |

`expansion-bipartisan-outreach` widens rule 3's second slot to accept `opposing-party`.

**Gate numbers: 4 valid stacks before the Tactic, 5 after.** `report:patterns` fails the
build if that changes. Any content edit must keep it true.

### Deliberate design choices that look like bugs

- Cards that do not match **bounce and cost nothing**. There is no free piling; filing
  zones arrive in Task 7. (Decision 001)
- Pulling a card out of a running job **cancels it**. No refund except Staff Attention.
  (Decision 002)
- **Staff Attention is a concurrency limit, not a currency** — held while working,
  returned on completion. Political Capital is a real spend. (Decision 003)
- The **Drafted Provision is the end of the chain** in this slice. The card says so.
  (Decision 010)
- The game **starts paused**. Stacking works while paused, but nothing progresses. The
  HUD says so in bold once a job is frozen.

---

## 6. Open decisions waiting on Tarik

| # | Decision | Notes |
|---|---|---|
| 1 | **Checkpoint 1: approve or retest** | Needs the ten-person playtest first. The whole gate. |
| 2 | **Art pilot timing** | Start Phaser MCP studies now, or after the gate. Recommendation was to wait. See MOO-746 and decision 006. |
| 3 | Confirm the two rule calls in decisions 001 and 002 | Already built, cheap to reverse |

---

## 7. Linear

Project: **Paper Majority — Phase 1 Vertical Slice**

| Issue | State |
|---|---|
| MOO-741 Task 1 — bootstrap | Done |
| MOO-742 Task 2 — term state | Done |
| MOO-743 Task 3 — pattern engine | Done |
| MOO-744 Task 4 — interaction spike | Done |
| **MOO-745 Checkpoint 1** | **In Review — the gate** |
| MOO-746 Task 6 — art pilot | Backlog, blocked on 745 |
| MOO-747 Task 7 — weekly clock | Backlog, blocked on 745. Carries the deadline-visibility gap. |

Every completed issue has a comment with the evidence: the observed failure first, the
final numbers, and any deviation from the plan.

---

## 8. Known gaps, written down so they are not rediscovered

- **A deadline is not visible enough to be fair.** Today it is 11px text in a corner,
  around 8px at the desk's opening zoom. The design asks for a stamp and edge wear. And
  expiry currently applies **no penalty at all**. Both belong to MOO-747; full write-up
  is in that issue.
- **The Working Bill probably should not be a card.** It is filed under Policy now,
  which is better than Institution, but the design already describes a *Bill Docket*
  zone that holds it. Task 7 work. (Decision 008)
- **"Add the provision to your bill" does not exist.** It is the most natural thing a
  player tries after rule 2. First candidate for Phase 2. (Decision 010)
- **No sound.** Deliberate; see the Phaser note above.
- **Placeholder art.** Flat rectangles. Held back on purpose until the gate passes.

---

## 9. How to behave here

From CLAUDE.md and from what this phase actually taught:

- **Verify before asserting.** Screenshot the canvas, curl the server, read the file.
  "It should work" has been wrong every time it was said here.
- **Test through the gesture**, not through the engine. That is where every bug lived.
- **Prove a regression test actually catches the bug** by reverting the fix and watching
  it go red. Two tests in this phase passed while the bug was live.
- **Surgical fixes.** Do not gut a component to make an error go away.
- **Record decisions** in `docs/decisions/NNN-slug.md` — plain English, real options,
  the honest downside, and leave **"What actually happened"** blank. That field is
  Tarik's, in his voice.
- **Stop at checkpoints.** The gate exists so that being wrong stays cheap.
