## Task 1 report: reconcile resources and reserve work costs once

### RED

Command:

```text
npm --prefix web run test:run -- src/domain/resources.test.ts src/domain/engine.test.ts
```

Result: failed as expected with 9 failures and 47 passing tests. The failures showed
positive spend events (`+1` instead of `-1`), unclipped reported gains (`+3` instead
of the applied `+1` at the Political Capital cap), completion effects reporting their
requested rather than applied value, and cancellation recomputing `+2` attention
after an in-flight pattern's cost changed from 1 to 2.

### GREEN

Targeted command:

```text
npm --prefix web run test:run -- src/domain/resources.test.ts src/domain/engine.test.ts
```

Result: 2 files passed, 57 tests passed.

Full unit command:

```text
npm --prefix web run test:run
```

Result: 18 files passed, 188 tests passed. This full run followed the final production
code change; the only subsequent code change added the zero-cost regression, which
passed in the final targeted run.

Typecheck command:

```text
npm --prefix web run typecheck
```

The first attempt found that the worktree had no generated global `LayoutProps`.
After `npx next typegen` generated the route types, the same typecheck passed with no
errors.

Spike density command:

```text
npm --prefix web run report:patterns
```

Result: passed with 4 base and 5 expanded valid concrete stacks.

### Files

- `web/src/domain/resources.ts`
- `web/src/domain/resources.test.ts`
- `web/src/domain/engine.ts`
- `web/src/domain/engine.test.ts`
- `web/src/domain/events.ts`
- `web/src/domain/types.ts`

### Implementation and concerns

`applyResourceDelta` now owns the 0–9 counter bounds and 0–100 meter bounds and
returns the signed difference actually applied. Every engine resource event uses that
result. Work start negates authored costs and stores the actual positive amount paid
on its active stack; completion and cancellation release only the stored Staff
Attention. A present empty reservation is authoritative, so a zero-cost job cannot
acquire a refund when content changes later.

`paidCost` is optional for compatibility with existing version-1 state. An older
in-flight stack with no reservation falls back to its scenario-defined attention
cost; all newly started work records a reservation, including an empty one.
