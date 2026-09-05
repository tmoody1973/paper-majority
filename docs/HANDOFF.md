# Handoff — Paper Majority, Phase 1

> **Active implementation — 2026-09-04:** Tarik authorized the [replayable Session plan](superpowers/plans/2026-09-04-replayable-session.md). Work runs in `.worktrees/replayable-session` on `codex/replayable-session`, with progress tracked in that worktree's `.superpowers/sdd/2026-09-04-replayable-session/progress.md`. The historical Phase 1 report below remains evidence of that earlier build. Its old stop instruction does not override the new execution request; human replay, content and art acceptance remain pending.

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
