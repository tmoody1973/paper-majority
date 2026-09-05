# Task 6 report

Status: COMPLETE

Commit: `feat: resolve visible weekly commitments and recoverable capital income` (this Task 6 commit; the resulting hash is reported to the controller after commit creation)

## Changed files

- `web/src/domain/obligations.ts`, `web/src/domain/obligations.test.ts`
- `web/src/domain/week.ts`, `web/src/domain/week.test.ts`
- `web/src/domain/commands.ts`, `web/src/domain/events.ts`, `web/src/domain/engine.ts`
- `web/src/domain/decisions.ts`, `web/src/domain/selectors.ts`
- `web/src/components/WeekSummary.tsx`, `web/src/components/WeekSummary.test.tsx`
- `web/src/components/Hud.tsx`, `web/src/components/Hud.test.tsx`
- `web/src/components/AccessibleCardControls.tsx`, `web/src/components/AccessibleCardControls.test.tsx`
- `web/src/components/GameShell.tsx`, `web/src/components/GameShell.test.tsx`
- `web/src/game/session.ts`, `web/src/game/scenes/DeskScene.ts`
- `web/src/game/objects/CardView.ts`, `web/src/game/objects/StackView.ts`, `web/src/game/objects/StackView.test.ts`
- `web/src/app/globals.css`
- `web/src/app/workbench/week-boundary/page.tsx`
- `web/e2e/week-boundary.spec.ts`

## Decisions

- All Session time commands use one bounded transition. It advances in steps no larger than 1,000ms and lands on earlier work, obligation, and week-boundary stops.
- Every work item ready at one simulation timestamp completes in stable work-ID order before obligation fulfillment or expiry. A decision raised by one completion pauses future time only after that full batch.
- A week boundary pauses and preserves open obligations for a visible preview. Plain `ADVANCE_WEEK` only resolves an existing boundary. Confirmed early intent requires `expectedWeek`, advances the remaining timeline, and stops on a decision; replaying that intent at the boundary is stale and cannot consume another week.
- Boundary identity is `week:<number>`. Fulfilled obligation identity is the authored obligation definition plus its occurrence. Both ledgers survive structured cloning and prevent duplicate penalties or rewards.
- Obligation fulfillment uses canonical bill provision tags, prepared evidence, or accepted pattern-completion events. Completed-pattern evidence must occur after a decision-created occurrence. Positive coalition promise rewards remain owned by `applyRelationshipEvaluation`.
- Weeks 2–6 set Political Capital to a minimum of 1 through `applyResourceDelta`. Week 6 resolves once and remains week 6 for Task 9 conclusion; it never creates week 7.
- Desk overflow is counted from desk-located cards only: capacity 18 in weeks 1–5 and 22 in week 6, with one Staff Morale per excess card capped at 10. Filed and archived cards stay canonical and retain obligation history.
- Filing has six slots. FILE, UNFILE, and ARCHIVE reject active work. Generic cancellation returns the exact captured Staff Attention; decision-origin work remains non-cancellable.
- `WeekSummary` is placed above the hover-changing inspector, Bill Docket, and Work Mat controls. The HUD exposes week progress, due counts, and boundary/completion states. `useSyncExternalStore` keeps React on the canonical session snapshot without changing GameCanvas callback identity on ordinary updates.
- A development-only `/workbench/week-boundary` state supports real gesture verification before Task 9 setup. It is unavailable in production.

## Verification

- `npm test -- --run src/domain/week.test.ts src/domain/obligations.test.ts src/domain/engine.test.ts src/domain/work.test.ts src/domain/decisions.test.ts src/domain/coalition.test.ts src/components/WeekSummary.test.tsx src/components/Hud.test.tsx src/components/GameShell.test.tsx src/components/AccessibleCardControls.test.tsx src/game/objects/StackView.test.ts --pool=threads --maxWorkers=1` — PASS, 111 tests.
- `npm test -- --run src/domain/week.test.ts src/domain/obligations.test.ts src/domain/decisions.test.ts src/components/WeekSummary.test.tsx src/components/GameShell.test.tsx src/components/Hud.test.tsx src/components/AccessibleCardControls.test.tsx src/game/objects/StackView.test.ts --pool=threads --maxWorkers=1` — PASS, 53 tests after UI/selector integration.
- `npm test -- --run --pool=threads --maxWorkers=1` — PASS, 31 files and 272 tests (final integrated engine).
- `npm run typecheck` — PASS.
- `npx eslint <all changed TypeScript/TSX files>` — PASS with no findings.
- `npx playwright test e2e/week-boundary.spec.ts e2e/work-mat.spec.ts e2e/coalition-decisions.spec.ts e2e/bill-docket.spec.ts --project=chromium` — PASS, 9 tests using actual pointer/keyboard controls and port 3100.
- `npx playwright test e2e/week-boundary.spec.ts --project=chromium` — PASS, 1 final boundary/cancellation/fast-forward gesture test. The first sandboxed attempt failed to bind port 3100 with EPERM; the authorized out-of-sandbox run passed.
- `npm run report:patterns` — PASS after the authorized out-of-sandbox retry for tsx IPC: 4 base and 5 expanded legacy stacks.
- `git diff --check` — PASS.

## Residual concerns

- Task 8 still owns normal catalog/pack ingestion and therefore the normal gameplay moment that creates authored standing obligations. Task 6 verifies occurrences through decision creation and the development-only boundary fixture without adding Task 8 content behavior.
- Task 7 owns save migrations/repository persistence. Task 6 verifies clone-equivalent receipt identity using `structuredClone` but does not add persistence code.
- Task 9 owns readiness conclusion and the final Session record. After resolving week 6, Task 6 intentionally stays at the resolved week-6 boundary.
