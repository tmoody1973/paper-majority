# 018 — Where Political Capital comes from

**Status:** Proposed by Claude on 2026-09-01. Decision pending Tarik. This one is a genuine open question in the spec, not a correction.

- **Decision (proposed)** — Political Capital is earned by visible acts the player performs during the term, chiefly answering district concerns and completing procedural milestones, plus a small weekly floor. It is never converted from District Trust or Policy Integrity, and it is never granted for time passing alone.

- **Why this came up** — In the spike, Political Capital is three points that are only ever spent. Spec section 8 calls it a "flexible currency for favors, briefings and procedural opportunities" and names no income source anywhere. Decision 003 established that Staff Attention is a limit that comes back and Political Capital is a real spend that does not. Nothing says how it is replenished.

  Without an income, the resource is a fuse: the office starts with three and the run is over for outreach purposes when they are gone. That cannot balance a 24-week term, and Tasks 8 and 9 cannot be tuned until the answer exists.

- **Options**
  1. **A flat weekly stipend.** Simple and predictable. Also flavourless: capital arrives whether the office did anything or not, which contradicts the "growth creates obligations" pillar and teaches nothing about where influence comes from.
  2. **Earned by visible acts, with a small floor (proposed).** Answering a district concern, completing a hearing request, delivering on a coalition promise, and specific Story Director opportunities each grant an authored amount, shown on the card that caused it. A floor of one point per week keeps a struggling office from stalling completely.
  3. **Trade it for other resources.** Convert District Trust or Bill Momentum into capital. Rejected outright: the spec says trust cannot be purchased, and selling trust for capital is the same transaction in reverse. It would also make the election ledger gameable through a side door.

- **What we chose and why (recommendation)** — Option 2. It is the only option where a player can point at the thing that gave them capital, which is the standard every other consequence in this game is held to (spec 8.4: pressure appears as board state before it appears as a number). It ties capital to constituent service, which is where a freshman member's leverage actually comes from, and it gives the district inbox a reason to matter beyond avoiding a trust penalty.

  Farming risk: if answering concerns yields capital, a player may hoard concerns. Mitigation belongs to Task 7: concerns expire, and an unanswered one costs trust, so the incentive is to answer promptly rather than to stockpile.

- **What we gave up** — Predictability. A player cannot plan on a fixed income, and a bad run of Story Director events can leave an office capital-poor for weeks. The floor limits how bad that gets. Also authoring cost: every capital-granting act needs a visible amount and a reason string.

- **How we will know if this was right** — Task 12's balance simulation across 1,000 seeds: no seed should stall with zero capital and no reachable way to earn any before the final phase. And in the engagement gate, a tester asked "how do you get more capital" should be able to answer from something they saw.

- **What actually happened** —
