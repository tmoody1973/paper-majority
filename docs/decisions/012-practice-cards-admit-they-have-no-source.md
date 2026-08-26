# 012 — A card that claims a real record but has no citation says so

- **Decision** — Any card whose information class is Official record or Based on records, and whose citation list is empty, is labelled a practice card on its face and in the inspector. Real citations arrive with the Task 5 catalog.

  *Amended 2026-08-26:* the label applies only to **authored** cards. A card the player manufactures in play (an Evidence Summary, an Outreach Result) is not a document with a missing citation — its source is the card that went in. Those cards show their lineage instead: "From: Tenant Survey" on the face, the full input list in the inspector. Tarik caught the original rule mislabelling his own summaries during play.

- **Why this came up** — An external review found that both "official" cards in the spike ship `citations: []`. The Rent Burden Report draws a blue tick and the words **Official record**, its inspector line reads *"Real public information, from a real source,"* and its own description calls it *"A published record of how much of their income renters here spend on housing."* None of that is backed by anything. The Housing Choice Voucher is the same.

  What is at stake is the promise the whole project rests on: that a player can always tell a fact from a simulation. A tester who believes they are holding a sourced government document during the very test that measures comprehension has been misled by us, in the direction that matters most.

  The design spec does require a citation and date on every factual card, but that sits in the whole-game definition-of-done list, not in the Checkpoint 1 gate. So this was never a broken acceptance criterion. It was a quiet claim we had not earned.

- **Options**
  1. **Add real citations now.** The underlying documents exist. But CLAUDE.md forbids inventing or inferring a citation, so every source and date would need Tarik to supply and approve it first — real work, and work that belongs with the catalog rather than with a fixture that exists to test dragging.
  2. **Say plainly that these are practice cards (chosen).** Costs a line of space on the card face and a sentence in the inspector. Honest immediately, and it disappears on its own the moment a card gains a citation.
  3. **Leave it until Phase 2.** Defensible on the letter of the gate, and wrong on its spirit: the ten-person playtest happens before Phase 2, and it is exactly the audience that would be misled.

- **What we chose and why** — Option 2, chosen by Tarik after the review laid out the three routes. The note is derived, not authored: any non-simulated card with an empty citation list gets it, so nobody has to remember to add a flag, and nobody can forget to remove one. A card that later gains a real citation loses the label automatically.

  Simulated cards are deliberately excluded. They are already honest about being invented; they are not documents with a missing source.

- **What we gave up** — Twelve cards on the desk now carry more small print, and four of them say "Practice card — no source" where the art direction wants restraint. It also slightly undercuts the fiction: the player is reminded they are inside a test build. That is the right trade during a playtest and the wrong one at launch, so this label is temporary by design — it should be gone from every shipped card, not styled better.

- **How we will know if this was right** — In the playtest, ask whether anyone believed the Rent Burden Report was a real document. Nobody should. If a tester says the label confused them about which cards are simulated — three classes plus a practice note is a lot of provenance vocabulary — the wording moves into the inspector only.

- **What actually happened** —
