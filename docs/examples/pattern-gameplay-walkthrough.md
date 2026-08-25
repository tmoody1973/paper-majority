# Paper Majority: Plain-English Gameplay Walkthrough

**Audience:** Anyone who wants to understand the game without already knowing Congress or game-design vocabulary  
**Purpose:** Show the card loop, reusable patterns, Staff Handbook, Story Director and transparent election through one example term  
**Status:** Approved behavior example; exact card values may change during balance testing

## The game in one sentence

You run a congressional office by moving cards around a desk, combining the right kinds of cards to build a housing bill, handling problems as they arrive and trying to pass the bill without losing your district's trust or your next election.

It feels like Stacklands because one drag gesture does most of the work. It creates RimWorld-style stories because the game watches what you are doing and sends opportunities, pressure and consequences that fit your situation.

## Where your cards come from

You do not begin with all 77 cards. Cards enter the desk in understandable ways:

| Source | What it gives you |
| --- | --- |
| Starting office | Your three Staff cards, Working Bill and basic office tools |
| Weekly Briefing Pack | A small mixed set of new evidence, concerns, policy ideas and events |
| District Mail | Constituent concerns and local organizations |
| Policy Research | Reports, testimony and policy options |
| Coalition Outreach | Member Offices, caucuses and support opportunities |
| Committee Intelligence | Hearing notices, procedural openings and amendment risks |
| Story Director | A believable memo, call, notice or news event based on your current situation |
| Completed stacks | New cards created by your actions, such as Evidence Summary or Drafted Provision |
| Milestones | Tactics and procedural cards earned by advancing the bill or office |

You always know the category of a pack before opening it, but not the exact cards inside. There are no paid packs.

## Before Week 1

You choose a real congressional district, a party and two governing values. In this example you choose a housing-stressed Georgia district, the Democratic Party, Tenant Stability and Fair Access.

The game creates a fictional freshman representative—you. Real district facts stay factual, but your relationships, bill and election are clearly labeled simulated.

The same seeded setup also selects your opponent once:

> **Opponent: Moderate**  
> **Simulated outlook — not polling**

You see this in Week 1. It will not secretly change, and the game will not roll dice again at the end to decide whether you win.

## Week 1: discover your first reusable rule

Your first envelope opens and gives you:

- Rent Burden Report — official housing-cost Evidence
- Urgent Renter Concern — a simulated Constituency problem
- Housing Choice Voucher — a Policy idea
- Committee Calendar Notice — an Institution card showing an early deadline

The Staff Handbook contains a gray entry labeled **Teased**:

> Housing Evidence works with a policy-focused Staff card.

That is a hint, not the exact answer.

You drag **Policy Aide** onto **Rent Burden Report**. The cards snap together, a short work bar fills and an **Evidence Summary** slides out.

The Handbook entry changes to **Discovered**:

> Policy-focused Staff + housing Evidence → Evidence Summary

You did not memorize “Policy Aide plus Rent Burden Report.” You learned a broad rule that can work with several suitable Evidence cards.

At the same time, the Urgent Renter Concern is counting down. You can assign your District Director to answer it, or use that staffer on something else. If you ignore it, District Trust falls at the end of the week. You can see the deadline on the card before the meter changes.

This is the main pressure of the game: you can usually solve each problem, but you cannot solve all of them at once.

## Week 2: reuse the rule instead of memorizing a pair

The next pack gives you a **Tenant Survey**. It is also housing Evidence, so you try Policy Aide + Tenant Survey.

It works for the same reason and uses the same Discovered Handbook entry. However, the result is not identical:

- The official Rent Burden Report gives more committee credibility.
- The Tenant Survey gives more district relevance.

One pattern accepts both cards, while a deterministic resolver uses the selected input to decide the result's authored effects. No AI invents the outcome during play.

Now you combine an Evidence Summary with Housing Choice Voucher. That satisfies a second pattern:

> Evidence Summary + renter-focused housing Policy → Drafted Provision

Your bill is no longer only an idea. It contains a drafted provision backed by evidence.

## Week 3: see a possibility you cannot use yet

A **Local Housing Organization** arrives. It is a Constituency card because it represents a district interest, not a congressional vote.

You combine it with District Director and create **District Priority: Rental Stability**. That helps explain what people in the district need from your bill.

The Handbook also shows a separate coalition entry that is still **Teased**:

> This outreach rule can be expanded by a Tactic.

The game is telling you that a larger possibility exists without giving away the exact card or creating a different locked recipe system.

## Weeks 4–7: your term becomes a story

You add the drafted voucher provision to the Working Bill and approach a same-party Member Office. The office becomes Conditional: it may support the bill if you accept an amendment.

Meanwhile, the Story Director notices that:

- your Staff Attention is low;
- the renter concern is close to expiring;
- the bill has momentum but only a narrow coalition.

Instead of selecting a random disaster with no connection to you, it sends a committee scheduling change. That creates a memorable problem: the hearing opportunity moved earlier while your best evidence is unfinished.

You pause and choose:

- finish the evidence and risk missing district mail;
- answer the district and enter the hearing less prepared;
- spend Political Capital to gain a little time.

The event also offers **Why This Surfaced**, which explains the eligible in-game conditions. It does not expose or invent facts about real people.

## Week 8: turn a Discovered rule into an Expanded rule

You receive **Bipartisan Working Group**, a Tactic card.

You cannot press a magic unlock button. You drag an eligible Staff card onto the Tactic and start **Study Tactic**. This uses Staff Attention and takes a short amount of office time.

When study finishes, the existing coalition rule changes to **Expanded**:

> Opposing-party Member Offices may now use this outreach pattern when their policy-interest tags overlap the bill.

Nothing about the Member Office card was secretly rewritten. The rule around it changed, and the Handbook shows exactly how.

Earlier, Working Bill + Opposing-Party Member Office produced a free rejection shake. You try it again. This time it works, and the office offers Conditional Support in exchange for a rural-housing amendment.

You can accept, reject or delay. Each choice has visible costs. The Tactic created a new possibility; it did not guarantee a good deal.

## Weeks 9–17: build something that can survive the House

The loop continues:

1. Open a pack.
2. Assign Staff.
3. Reuse or discover patterns.
4. Improve the bill or coalition.
5. Handle one district or political problem.
6. File or archive what does not fit on the desk.
7. Resolve the week's Story Director event.

You create more evidence-backed provisions, request a committee hearing and survive markup. Some weeks are opportunities; some are pressure; some are consequences of earlier choices; recovery weeks give you room to reorganize.

Your bill reaches the House floor. A forecast shows committed, conditional, undecided and opposed seats. That vote may use seeded uncertainty for simulated undecided seats, but it is separate from your reelection. Preparation still matters most.

Suppose the bill passes narrowly after you accept the rural amendment. Bill Momentum rises, but Policy Integrity falls because the final bill moved away from one of your starting values.

## Weeks 18–24: finish the bill and face the election you can see coming

The Senate changes the bill. You accept a smaller version instead of risking total failure, and the bill is enacted.

Throughout the term, the Office Election Outlook has shown a range:

- Weeks 1–8: current score plus or minus 8 points
- Weeks 9–16: plus or minus 5 points
- Weeks 17–24: plus or minus 3 points

The range gets tighter because the term is closer to ending. It is still labeled simulated, not polling.

Imagine your final state is:

- District Trust: 61
- Policy Integrity: 55
- Bill outcome: Enacted
- Opponent: Moderate
- One public listening-session choice: +1 election effect

The final Term Record shows the exact calculation:

| Simulated line item | Contribution | Running total |
| --- | ---: | ---: |
| Starting baseline | +50.0 | 50.0 |
| Moderate opponent | +0.0 | 50.0 |
| District Trust: `(61 - 50) × 0.30` | +3.3 | 53.3 |
| Bill enacted | +4.0 | 57.3 |
| Governing consistency: `(55 - 50) × 0.04` | +0.2 | 57.5 |
| Public listening session | +1.0 | 58.5 |

> **Final simulated vote share: 58.5% — Reelected**

There is no final hidden dice roll. If your result changes, the ledger shows which visible decision changed it.

Staff Morale, coalition size and unanswered concerns are not added again at the finish. They already affected your District Trust, bill outcome and earlier choices. Counting them twice would make the result confusing and unfair.

## What is real and what is made up for the game

| Label | Meaning | Example |
| --- | --- | --- |
| Official Record | Directly sourced public information | A Census rent-burden statistic |
| Derived Context | A reviewed calculation or summary | “Housing-cost pressure is high relative to the national median” |
| Simulated | Exists only in this fictional term | Conditional support, Story Director events and your election result |

The Sourcebook explains facts and citations. The Staff Handbook explains gameplay patterns. The Election Outlook explains simulated electoral consequences. Those three surfaces remain separate so the player always knows what kind of information they are reading.

## What the pattern engine is actually checking

The player sees cards. The engine sees controlled data:

```text
Policy Aide
family: Staff
tags: policy-focused, housing

Tenant Survey
family: Evidence
tags: housing, renter-focused
information class: Derived
```

The pattern asks for:

```text
Slot 1: Staff with policy-focused tag
Slot 2: Evidence with housing tag
```

Both slots are satisfied, so the stack works. The exact card IDs are not the rule.

More specific patterns beat broader patterns. Published content is rejected if two patterns are equally valid with the same priority. Derived outputs use allowlisted resolver IDs, not functions stored in scenario JSON. The same snapshot, seed and command sequence therefore produces the same result.

## The three Handbook states

| State | What the player knows |
| --- | --- |
| Teased | A rough direction, but not the exact input and result |
| Discovered | The reusable family/tag rule and examples that have worked |
| Expanded | The discovered base rule plus the exact change created by an activated Tactic |

These states come from `discoveredPatternIds` and `unlockedSlotExpansions`, which already belong to the pattern architecture. There is no second hidden-recipe system.

## What the first prototype must prove

Before building the larger scenario, the eight-definition interaction spike must demonstrate:

1. Exactly three authored patterns.
2. Four valid concrete stacks before the Tactic and five after it.
3. Two different Evidence cards satisfying the same Staff pattern.
4. Meaningfully different effects from those two Evidence choices.
5. One chained transformation from Evidence to Drafted Provision.
6. One opposing-party outreach stack rejected before Study Tactic and accepted after it.
7. A clearly visible Teased → Discovered → Expanded Handbook change.
8. No resource or time penalty for an invalid experiment.
9. No ambiguous pattern matches.
10. First-time players understanding the result without repeatedly opening the inspector or Sourcebook.

If those conditions fail, the team fixes tags, results, hints or interaction feedback before authoring the larger card library.
