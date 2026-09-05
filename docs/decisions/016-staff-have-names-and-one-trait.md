# 016 — Staff cards have a name and one trait

**2026-09-04 execution disposition:** Adopted for Session implementation through Tarik’s instruction to execute the replayable Session plan; see that addendum for exact rules. Outcome evidence remains pending.

**Status:** Proposed by Claude on 2026-09-01. Decision pending Tarik.

- **Decision (proposed)** — Every Staff card in the Phase 2 catalog is a named, fictional person with exactly one authored trait. The trait is a tag, and the existing derived-output resolvers may read it, so which staffer does a job can change the result the same way which evidence does.

- **Why this came up** — Decision 011 made staff catalysts: they return after every job and nothing destroys them. That was right, and it also removed the only personal stake the desk had. The spec still promises a loss: overload can cause resignation (8.1). But a card called "Policy Aide" resigning is a resource going away; a card called Priya Nair, committee veteran, resigning is a story. RimWorld's stories work because colonists have names and traits; the gameplay review found nothing on this desk a player would miss.

  There is also a mechanical reason. The game already teaches that the card you choose matters: the official report and the tenant survey give different summaries. Staff are the one family where that is not true. A trait makes "which staffer" a decision using machinery that already exists.

- **Options**
  1. **Keep staff generic.** Zero cost. Staff remain interchangeable tokens, and resignation remains a number.
  2. **A name and one trait, read by resolvers (proposed).** Authoring cost only: a name, a one-line trait, and a tag per staff card in Task 5. The resolvers already branch on input tags. No new system.
  3. **Full personalities, arcs, dialogue.** The RimWorld version. Real writing and a relationship model that does not exist yet. Phase 3 at the earliest.

- **What we chose and why (recommendation)** — Option 2. It costs almost nothing at authoring time and is expensive to retrofit once thirty cards exist without it. Traits should be professional, not personal: committee veteran, district organiser, numbers person, former reporter. Each biases a derived output in a way the card face can state in one phrase.

  Guardrails, from spec 14.6 and 14.4: staff are fictional and must not be modelled on any real congressional staffer. Traits must never be demographic or coded to demographics; a trait is a professional background, never an identity. Names should read as ordinary and varied without any name being a signal about behaviour.

- **What we gave up** — Some of the clean abstraction. A player may reason about a named person rather than the rule, which is what the Handbook's family-and-tag logic is trying to teach. The mitigation is that the trait is visible as a tag and appears in the Handbook slot language like any other tag.

  Also a small authoring burden per staff card, and a translation burden later: trait phrases are player-facing copy.

- **How we will know if this was right** — In the Task 11 engagement gate, ask testers to name one staffer from their run without looking. If most cannot, the names did not land and this is cosmetic. If a tester mentions a staffer unprompted when describing a setback, it worked.

- **What actually happened** —
