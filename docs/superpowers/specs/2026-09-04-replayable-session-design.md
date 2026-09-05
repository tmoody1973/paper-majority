# Paper Majority — Replayable Session Design Addendum

**Date:** 2026-09-04  
**Status:** Proposed implementation design, prepared at Tarik's request. This document does not record a passed playtest or approval to cross an existing checkpoint.  
**Delivery target:** A complete six-week Session with three viable approaches using the same housing catalog.  
**Implementation plan:** [Replayable Session plan](../plans/2026-09-04-replayable-session.md)

## 1. Player promise and proof

Build a housing proposal, earn a viable coalition, and keep the commitments that make that coalition possible before the Session ends. The player should finish knowing what they sacrificed and wanting to try another approach.

The repeatable loop is: reveal an opportunity → allocate staff → make or use legislative assets → choose commitments → resolve visible obligations → enter a changed week.

The first delivery is the six-week Session, not the complete 24-week Term. It ends in a readiness assessment for a committee opportunity, not enactment or reelection. The original full-term implementation remains a later delivery after Checkpoint 2. Extensive replayability is a hypothesis to validate through repeat play, not a promised outcome of adding random seeds.

## 2. Relationship to existing authority

Read the original approved design, original implementation plan, and the Stacklands-informed build brief alongside this addendum. During execution, record acceptance of this addendum and amend their conflicting sections together; do not silently let two incompatible contracts govern the build.

| Topic | Existing contract | Proposed disposition |
| --- | --- | --- |
| Checkpoint 1 | Human interaction gate before Phase 2 | Preserve; no test results are supplied by this document |
| Six-week ending | Development checkpoint | Adopt ADR 015's permanent Session, with an objective and record |
| Staff identity | Three reusable staff roles; ADR 016 pending | Adopt one fictional name and one professional trait per role |
| Shared seeds | ADR 017 pending | Share versioned run setup, with no server, streak, or login reward |
| Political Capital | ADR 018 pending and internally inconsistent about a weekly floor | At a new Session week, raise capital to at least 1; add rewards for unique fulfilled commitments and milestones; preserve cap 9 |
| Cross-party outreach | Universal tactic prerequisite in spike | Keep the spike unchanged. Session permits shared-interest outreach; the tactic broadens acceptable interests or improves a declared coordination rule |
| Integrity | Spike applies a party-based penalty on outreach | Session recomputes from actual provision/value effects; party is never an integrity penalty |
| Partial stacks | Invalid stacks bounce immediately | Preserve normal drops. Add an explicit Work Mat for assembling 2–4 inputs before submission |
| Catalog | 30 definitions, 16 patterns, four tactics, 12 events, at least 50 stacks | Preserve counts. Use instance forms for summaries/drafts and a Bill Docket anchor, rather than silently adding output definitions |
| Tactic timing | Full-term example introduces expansion in Week 8 | Session presents at least two meaningful tactic offers before Week 4; study remains a timed assignment |
| Saves | Version 1 originally planned | Introduce validated version 2 for the new state; explicitly adapt supported legacy fixtures/checkpoints |
| Art/content gate | Eight-card pilot and factual review at Checkpoint 2 | Preserve; mechanics-ready is not the same as release-ready |

## 3. Scope and non-goals

Build one shared Session engine with three strategy affordances: district advocate, committee specialist, coalition broker. These are approaches the player discovers, not mandatory classes or separate campaigns.

Preserve the existing 30-definition category budget: 3 staff, 5 policy provisions, 5 evidence, 4 coalition offices, 4 constituency, 3 institution, 2 political, 4 tactics. Every drawable card must have a reachable use. The 12 authored Story Director events are separate from the card count.

Reuse the five policy IDs, three staff-role IDs, six district source selections, ingestion rules, and pilot IDs from original Task 5. A source selection is not evidence that its historical descriptive text remains correct: verify cited facts when constructing the frozen snapshot. Do not infer behavior from demographics.

Exclude full House/Senate resolution, enactment, election gameplay, 77-card expansion, new issue modules, live news, runtime LLMs, multiplayer, accounts, purchases, and permanent numerical upgrades. Preserve the existing election model for the later Term; do not show its forecast or opponent as a Session objective.

## 4. Three approaches and competing uses

| Approach | Route to readiness | Cost and exposure |
| --- | --- | --- |
| District advocate | Resolve district obligations; turn local evidence into a priority endorsement that helps satisfy an authored office condition | Less time for technical preparation; evidence spent locally is unavailable for drafting |
| Committee specialist | Prepare a reviewed provision and a relevant committee evidence packet that answers an authored office concern | Occupies counsel and evidence; district obligations compete for the same week |
| Coalition broker | Coordinate compatible offices, fulfill their conditions, and use a tactic to reduce a specific coordination burden | More promises can conflict when the bill changes; coordination occupies scarce staff |

The approaches share one objective and rule engine. Scenario-authored support conditions accept different forms of preparation; none grants support merely because the player chose an approach label. At least three evidence definitions must have three reachable uses: drafting, answering an office concern, and district/committee preparation. These uses consume the same evidence instance or occupy it for exclusive work.

Use context-specific tags such as committee relevance and district relevance to determine effects. Information provenance must not double as a universal quality score. A summary retains its source lineage and its authored relevance through subsequent drafting or negotiation.

## 5. Bill, support, and decisions

The Session Bill Docket is an engine-owned destination, not an extra card definition. Docketing a drafted policy records its underlying policy ID exactly once and increments bill revision. The original integrity formula remains: start at 60, add 8 for each positive selected-value effect, subtract 10 for each negative effect, clamp 0–100. Display the contributing provisions and selected values. No generic penalty for dealing with another party.

Each office stores simulated support, its current demand, accepted promise IDs, and the bill revision last evaluated. Public office facts are immutable. Repeated outreach with the same bill revision and unresolved demand provides inspection or a free refusal, not another reward.

A pending decision contains a stable ID, the originating office/event, expected bill revision, previewable choices, and status. Accept/reject/counter resolves that exact decision once. A bill edit invalidates stale previews and re-evaluates affected promises. Conflicting promises must be visible before the player accepts them; a warning does not forbid deliberate compromise.

Counteroffers require evidence, authored eligibility, and time. They are not an automatically superior third button. Every consequential decision pauses simulation; cards can still be inspected and rearranged. Changes to bill/support wait until explicit confirmation and any stated work completes.

## 6. Work, time, and pressure

Staff Attention remains a concurrency limit. In Session, every job that uses attention identifies an assigned staff instance; no invisible fourth worker. Each staffer can serve one active job. Unheld attention is derived from capacity and active reservations, not accumulated through repeated refunds.

Use the existing pace durations: relaxed 150000ms, standard 105000ms, brisk 75000ms per week. Author research and response jobs initially at 20000–35000ms, drafting at 40000ms, and substantial preparation at 60000ms; use these as versioned tuning inputs, not hard-coded UI constants. Trait benefits are bounded, initially a 0.8 duration multiplier on the matching professional task, with a generalist route always available.

At most three prominent actionable pressures should appear together during initial tuning. Show due time and consequence on the desk and in keyboard controls. Separate active commitments from archived informational clutter. Filing cannot hide or cancel obligations, and a crowded desk must remain readable.

An action that completes exactly at a deadline resolves before that deadline expires. At a week boundary, complete due actions, pause, and show the boundary preview. Advance resolves expired obligations, support consequences, staff/capacity effects, then starts the next week. Unfinished legitimate work carries across the boundary. A pending decision blocks advancement. Explicitly ending a week early advances through the same events and consequences as elapsed time; it cannot grant free production or erase deadlines.

Fast-forward advances the same simulation transitions and stops at the next decision, deadline, completion needing attention, or week boundary. Unlimited planning pauses and reduced motion remain available.

## 7. Economy and recovery

At the opening of weeks 2–6, Political Capital becomes max(current, 1). Completing a distinct district obligation or coalition promise grants the authored reward, initially 1; meeting the readiness preparation milestone grants 1 once. Clamp actual gains to the cap of 9 and emit actual applied deltas. No rewards for redisplaying a card, repeating a conversation, or loading a save.

Track reward receipt by stable occurrence ID, not card definition. Two different authored concerns may both pay; the same concern can pay only once. Reloading cannot reroll opportunities or repay a fulfilled commitment.

Recovery offers a reachable generalist job or narrower objective at a real opportunity cost. It does not erase consequences or guarantee success. Staff overload must be warned before a penalty, and permanent resignation is deferred until short-session tests establish a fair recovery route.

## 8. Variation and ending

Seeded variation changes staff trait assignments within role eligibility, reviewed opportunity pools, available office demands, pack contents, and deadline windows. District facts remain frozen. A district's gameplay priorities are explicit authored simulation choices.

Guarantee a starting policy, a reachable draft path, and baseline access to all necessary staff roles. Every mandatory step has a non-random fallback. Optional rewards and methods vary; a particular tactic is never required to finish. Validate all four tactics individually and in all 16 activation subsets for both player parties.

Use the original Story Director order: eligibility → cooldown/repetition checks → forced recovery → term-style weights → seeded draw. Never repeat a pressure category consecutively; after two pressure/consequence events provide eligible recovery. A guaranteed authored fallback is available. Events explain their visible causes and retain occurrence IDs. Previews and cosmetic actions consume no random draws.

The default Session objective is checked at Week 6: at least two distinct docketed provisions, two committed offices, and no overdue mandatory Session obligation. Voluntarily declining an optional opportunity is not a failed mandatory obligation. Content must support all three approaches to this objective. The result is a readiness assessment, not a prediction of committee votes.

Record partial achievements, remaining gaps, selected values, bill contents, commitments fulfilled/broken, declined opportunities, and major causes. An early conclusion at a weekly boundary records the current outcome and missing requirements honestly. Do not synthesize an unplayed alternative as a guaranteed victory.

A challenge code includes scenario ID and hash, rules version, seed, mode, party, district, selected values, and gameplay settings. Known combinations remain available; profile discovery only changes explanations. No score bonus or advantage for returning on a particular day.

## 9. Acceptance and evidence

Automated correctness is necessary but cannot establish engagement. Checkpoint 2 still includes original content, art, accessibility, and interaction requirements.

For an initial Session pilot, recruit eight strategy-curious adults and invite a second run after the first, without coaching it. Proposed investigation thresholds: six of eight explain a sacrifice and its later consequence; five of eight voluntarily start another run; four of those returning players complete it; at least three returning players intentionally change approach. These are small-sample product gates, not population retention estimates. Record counts and reasons, including every refusal.

Run three authored agent policies plus greedy same-party and district-reward baselines over 1000 fixed seeds per party at standard pace. Report performance by district, values, scenario and settings; action frequency; capital stalls; readiness paths; unmet obligations; and idle-time share. Investigate a baseline that dominates all three intended approaches. Passing a finite seed suite proves behavior on that suite only.

All policy scripts dispatch legal commands through the production engine. Human/browser completion tests must use gestures and keyboard UI, not state mutation adapters. No human result is prefilled.
