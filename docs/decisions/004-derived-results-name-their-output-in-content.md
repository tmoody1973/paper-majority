# 004 — A derived result gets its output card name from content, not from engine code

- **Decision** — When a pattern produces a card by calculation, the pattern file passes the output card's name as a plain setting (`outputDefinitionId`). Engine code decides *what the result is worth*; content decides *which card comes out*. A calculation that is not given a name refuses to run.

- **Why this came up** — The plan sketched calculations like `summarize-evidence` living in the engine. The obvious implementation has that engine function return the card name — which quietly hard-codes housing-specific card names into the rules engine, where a second issue module could never reuse them.

  What is at stake: whether healthcare and infrastructure modules can reuse the same four calculations later, or whether each new issue forces an engine change.

- **Options**
  1. **Calculation names the output card.** Simplest to write. Welds the engine to the housing catalog.
  2. **Calculation takes the name as a setting (chosen).** One extra field per pattern; the engine stays issue-agnostic.
  3. **A separate lookup table** mapping calculations to outputs. A third place to keep in sync, for no gain.

- **What we chose and why** — Option 2, by Claude. It also preserves the hard rule that scenario files never contain runnable code: a pattern file holds a calculation's *name* and plain settings, never a function.

- **What we gave up** — Content authors now have one more field they can forget. Mitigated by making the calculation throw a clear error, and by the content validator in Task 5 catching it before publication.

- **How we will know if this was right** — When the healthcare module is scoped, check whether it reuses the existing four calculations unchanged. If it needs new engine code for the same shapes of result, this did not buy what it promised.

- **What actually happened** —
