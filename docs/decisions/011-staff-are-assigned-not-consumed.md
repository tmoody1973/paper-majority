# 011 — A staffer is assigned to work, never used up by it

- **Decision** — Staff cards are catalysts in every pattern that uses them. Assigning a staffer holds them for the length of the job and returns them to the desk when it ends. No rule destroys a Staff card.

- **Why this came up** — An external review found that finishing an Evidence Summary deleted the Policy Aide, because a pattern slot is consumed unless the content says otherwise. The spike desk carries two aides and four housing evidence cards. Using the rule twice — which is exactly what the design asks a player to do to learn it — left zero staffers, and the Tactic can only be studied by a staffer. Half of Checkpoint 1 became unreachable through ordinary, encouraged play.

  What is at stake: whether the ten-minute test can be completed at all, and whether the game's central promise about staff is true. Four sources already said staff are not consumed, and the code disagreed with all four:

  - The Policy Aide's own card text: *"Assigning them takes up their attention **until the work is done**."*
  - Design spec, Week 2: *"The player proves the rule is reusable. A Tenant Survey arrives. Policy Aide + Tenant Survey satisfies the same pattern"* — the same aide, a week later.
  - Design spec resource table: Staff *"Perform timed work"*, and overloaded staff *"remain visibly attached to unfinished assignments"* — attached, not absorbed.
  - The implementation plan: studying a Tactic *"returns the Staff card to idle."*

  That last one is the tell. The engine already gave the aide back after a Tactic study but destroyed them after a pattern. Same card, same kind of work, two opposite rules.

  A simulated playtest run through Codex, done independently and at the same time, reached the same conclusion first and put it more plainly than any of our own notes: *"The player understood the strategy correctly; the game punished them for applying it."*

- **Options**
  1. **Give the spike more Policy Aides.** Cheapest possible change, hides the contradiction, and the same soft-lock returns the moment the six-week catalog has more staff-driven rules than spare bodies.
  2. **Make Staff a catalyst everywhere (chosen).** One authored flag per staff slot. Matches every written source. Costs us a pressure lever we had not deliberately chosen to have.
  3. **Keep consuming staff and make it legible** — rewrite the card text, show a warning, treat losing a staffer as a real consequence. Defensible as a design, but it is a new design, and nothing in the approved spec asks for it.

- **What we chose and why** — Option 2. The finding came from an external review, Claude verified it against the design sources and reproduced the soft-lock, Tarik approved the fix. This was never a decision anyone made; it was a default in the matching code that no content had overridden. Naming it now means the six-week catalog inherits a rule rather than a habit.

- **What we gave up** — Staff are now effectively unlimited labour. The only thing that makes them scarce is Staff Attention, which is concurrency, and the clock. Nothing in the term wears a staffer down, and the office can never lose one. That removes a pressure source the 24-week loop may well want, and it will have to come back as something deliberate — morale, availability, a staffer pulled away by an event — rather than as a rule quietly eating cards.

  Second cost: the desk no longer shrinks as the player works. Every completed job now leaves one more card than it used to. Desk capacity in Task 7 carries more weight because of this decision.

- **How we will know if this was right** — Two things to watch in the ten-person playtest. Does anyone expect their staffer to be gone, and is surprised to see them return? And does the desk feel crowded by the end of ten minutes? If the second one shows up in more than two or three sessions, desk capacity moves earlier and the card that returns needs a visible home.

- **What actually happened** —
