# 014 — A member office survives a conversation

- **Decision** — The coalition slot in the outreach rule is a catalyst, like the Working Bill and like Staff. Approaching a member office produces an Outreach Result and leaves the office on the desk.

- **Why this came up** — Tarik, playing the spike, watched the Hillcrest Member Office vanish the moment its Outreach Result appeared, and asked whether that should happen. It should not. The review had flagged this as an open question ("is a Member Office destroyed by one conversation?"), and play answered it faster than analysis did: an office is an institution, not an ingredient. The fixture has exactly two offices, so the coalition family emptied itself after two conversations — and Task 9's whole design attaches persistent relationship states (Interested → Conditional → Committed, plus decay) to offices that must therefore still exist.

  This is decision 011's principle extended one step: people and institutions are catalysts; documents are what gets consumed.

- **Options**
  1. **Keep consuming the office.** Defensible only if a conversation is a one-shot resource, which contradicts the relationship system the design already specifies.
  2. **Office survives (chosen).** One line of content per scenario (`consumed: false` on the coalition slot). The office remains for Task 9 to build on.
  3. **Replace the office with a "contacted" variant card.** Models the state change, but it invents a second card system for what Task 9 will do properly with relationship state.

- **What we chose and why** — Option 2, prompted by Tarik's playtest observation, implemented as the smallest content change. The regression test that had codified the office's disappearance was rewritten to assert its survival.

- **What we gave up** — The same office can now be approached repeatedly in the spike, producing duplicate Outreach Results for +2 Bill Momentum each. Political Capital caps this at three total outreaches per run, so it is bounded, but it is real: repeat outreach is mildly degenerate until Task 9's relationship states gate it (a Committed office should answer differently the second time). Accepted for the spike; named here so Task 9 inherits it as a requirement rather than a surprise.

- **How we will know if this was right** — Watch a playtester approach the same office twice. If the duplicate result reads as a bug rather than a quirk, the spike needs a cheap guard (an office with an existing result declines politely) before the ten-person test.

- **What actually happened** —
