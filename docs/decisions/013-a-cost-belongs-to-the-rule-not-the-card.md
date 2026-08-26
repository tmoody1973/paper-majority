# 013 — What a card costs is read from the rule that charges it

- **Decision** — The cost line on a card face and in the inspector is derived from the rules the player has already discovered, and it names the resource that is really spent. Cards no longer carry an authored `workload` number for display, and no cost appears for a rule the player has not found.

- **Why this came up** — An external review found that every member-office card read **"Uses 1 staffer"** while outreach costs 1 Political Capital and no Staff Attention at all. The inspector repeated the same false claim in longer words: *"Costs 1 Staff Attention while it is working."*

  The cause was structural rather than a typo. `workload` is a number on a card, but a cost belongs to the action. A single per-card number can only ever describe one rule, so on any card that takes part in a differently-priced rule it is guaranteed to be wrong, and it will go wrong again for free every time the catalog grows.

  What is at stake is the thing Checkpoint 1 measures. The gate asks whether a player can predict what a stack will do and name the cause of a setback. A card that misstates its own price makes both of those harder in exactly the way the playtest is supposed to detect.

  This also closes a question decision 003 left open: *"A player looking at '1 attention' on a card cannot tell it will come back, while Political Capital will not."* The wording now carries that distinction.

- **Options**
  1. **Set `workload: 0` on the member offices.** One line, removes the false claim today. It also removes the only signal that outreach costs anything, and the next card with a mismatched cost reintroduces the bug silently.
  2. **Derive the cost from discovered rules (chosen).** Correct by construction and impossible to author wrongly. Costs real code, and it means no card shows a cost on a fresh desk, because nothing has been discovered yet.
  3. **Keep `workload` and add a second authored field for Political Capital.** Keeps the up-front signal and re-creates the same drift the moment a third resource or a second rule appears.

- **What we chose and why** — Option 2, by Tarik, after the review named the trade. Wording is now split by kind: *"Ties up 1 staffer"* on the face and *"…You get them back when it finishes"* in the inspector; *"Spends 1 political capital"* and *"…That is really spent — it does not come back."*

  Costs stay hidden until the rule is discovered for the same reason the Handbook hides slots until then: a price is a strong hint about what a card is for, and the gate is measuring whether people can work rules out.

- **What we gave up** — The opening desk is quieter. Every card used to carry a cost line at week one; now none do until the first rule lands. Some of that was genuinely useful for planning, and we have traded it for accuracy plus a discovery curve we have not tested with anyone yet.

  A card in two differently-priced rules shows only the first cost on its face. The inspector lists them all. That is a real simplification, made because the card face has room for one line, and it will need revisiting when a card belongs to several rules at once.

  `workload` still exists on `CardDefinition`. Nothing displays it now, which means it is authored content with no consumer — it should either find a real use in desk capacity or be removed before the catalog is written.

- **How we will know if this was right** — In the playtest, ask a tester after their first discovery what that rule costs and whether they get the staffer back. They should be able to answer both from the card. And watch whether anyone hesitates at week one because no card shows a price; if more than two or three do, the opening desk needs a different way to say "this will tie somebody up."

- **What actually happened** —
