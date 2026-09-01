# 017 — Shared seeds are allowed; rewards for showing up are not

**Status:** Proposed by Claude on 2026-09-01. Decision pending Tarik.

- **Decision (proposed)** — A run's seed may be shared and replayed by anyone, so two people can play the identical term and compare ledgers. The game never rewards a player for logging in, never tracks streaks, and never prompts a return. Spec section 9's ban on daily-login mechanics is kept, and this record draws the line it did not draw.

- **Why this came up** — The gameplay review listed comparison as one of the seven reasons people return to a strategy game, and noted it is the one Paper Majority gets nearly for free: the engine is deterministic, so the same seed and the same commands produce the same term. Sharing a seed costs a URL parameter. Comparing results costs a shareable Term Record.

  But spec section 9 says: *"No real-money packs, purchasable randomness or daily-login mechanics are permitted."* A "daily seed" is close enough to that sentence that it should not be decided by whoever happens to write the code.

- **Options**
  1. **No shared seeds.** The strict reading. Safe, and it forfeits the only comparison mechanic available under the "no multiplayer" non-goal.
  2. **Shared seeds without rewards or streaks (proposed).** The Wordle shape: one shared puzzle, no prize for playing it, no penalty for skipping it, results shared by the player if they choose. The line is about what the game *does to you for returning*, not about whether two people can play the same term.
  3. **A full daily challenge with a leaderboard.** Needs a server, accounts and moderation, and starts to look like the retention loop the spec is refusing. Not for the vertical slice.

- **What we chose and why (recommendation)** — Option 2, with the boundary written as rules the code must obey:
  - A seed can be entered, shared and replayed. That is all.
  - No reward, unlock, badge, bonus or streak is ever tied to *when* or *how often* a player plays.
  - The game never notifies, nags or counts days.
  - Nothing requires a server. A shared Term Record is text or an image the player exports.
  - Every shared ledger carries the same "simulated, not polling" labelling as the in-game one.

  This preserves the spec's intent (no manipulation of return behaviour) while allowing the thing the spec was not actually against (two people playing the same term).

- **What we gave up** — Without a leaderboard the social pull is weaker: comparison is opt-in, between friends, by pasting a record. That is a deliberate trade. And "no server" means no verification that a shared result is genuine; a Term Record is a claim, not a proof. Acceptable, because nothing is at stake in a comparison beyond bragging.

- **How we will know if this was right** — Whether testers share a seed with each other without being asked. If nobody does, the feature is harmless and idle. If the first thing someone asks for is a streak or a badge, the line is in the right place and holding.

- **What actually happened** —
