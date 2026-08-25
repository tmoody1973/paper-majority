# 003 — Staff Attention is held during a job and returned when it finishes

- **Decision** — Starting an assignment holds Staff Attention for its duration and gives it back on completion. Political Capital and the four percentage meters are genuinely spent and do not come back.

- **Why this came up** — Writing the interaction spike, the desk ran out of Staff Attention after three assignments and could never recover, because the spike has no weekly reset. The ten-minute test would have soft-locked before a player reached the Tactic.

  What is at stake: whether the gate is testable at all. A loop that stalls halfway is not a loop.

- **Options**
  1. **Refill Staff Attention every week.** Matches the eventual design, but the spike has no weeks, so it does nothing here.
  2. **Treat Staff Attention as a concurrency limit (chosen)** — held while working, released on completion.
  3. **Give the spike a large starting pool** so it never runs out. Hides the constraint the game is actually about.

- **What we chose and why** — Option 2, by Claude, because the approved design already says so. The design spec's resource table defines Staff Attention as the thing that "limits simultaneous office work" — a concurrency limit, not a wallet. Implementing it as a wallet was the deviation; this is the correction.

- **What we gave up** — There is now a real distinction between two kinds of cost that the interface does not yet explain. A player looking at "1 attention" on a card cannot tell it will come back, while Political Capital will not.

- **How we will know if this was right** — Ask testers, after a few assignments, whether they expect their staffer to be free again. If they are surprised either way, the card face needs to say which kind of cost it is.

- **What actually happened** —
