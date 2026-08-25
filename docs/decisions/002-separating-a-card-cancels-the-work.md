# 002 — Pulling a card out of a running job cancels that job

- **Decision** — A player can always separate a card, even one in the middle of a timed assignment. Doing so cancels the assignment and returns every card in it to idle. The Staff Attention that was held comes back; nothing else is refunded.

- **Why this came up** — The first version refused to separate a busy card, which seemed safe. It immediately broke a Checkpoint 1 manual check: "Pause, move and separate cards, then unpause." With cards locked mid-job, that check is impossible to perform.

  What is at stake: the accessibility promise. The spec guarantees unlimited pause and card movement while paused. A card the player cannot touch breaks that promise.

- **Options**
  1. **Refuse to separate a working card.** Protects the player from wasting work. Breaks the pause guarantee and the checkpoint check.
  2. **Allow it and cancel the job (chosen).** Honest and predictable: you took the folder off the desk, so the work stopped.
  3. **Allow it and preserve progress**, resuming if the cards are restacked. Kindest, but needs a partial-progress model nothing else in Phase 1 has.

- **What we chose and why** — Option 2, by Claude. It keeps the physical metaphor intact — the game is about moving paper, and paper you pick up stops being worked on — without inventing a progress-preservation system that the six-week loop has not asked for yet.

- **What we gave up** — A player can destroy several seconds of work with one careless drag, and the game does not warn them. There is no undo.

- **How we will know if this was right** — Watch for accidental cancellations in the playtest. If testers cancel work they meant to keep more than once or twice across ten sessions, add either a confirm-on-drag or option 3.

- **What actually happened** —
