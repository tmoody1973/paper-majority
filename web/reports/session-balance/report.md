# Session balance report

Generated: 2026-09-05T16:06:48.781Z
Snapshot: `housing-session-2026-09-04-candidate` / `ff90f497eaf2efc4c4e18877ff360f824f2ffe2391badbb44900d6301f0a13e4`
Manifest: seeds 1–1000, parties democratic + republican, pace standard, five policies, 10000 total runs.

| Policy | Complete | Ready | Not ready | Harness failures | Avg commands | Avg PC spent | Avg idle seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| district-advocate | 2000/2000 | 2000/2000 | 0/2000 | 0/2000 | 50.44 | 4.00 | 431.73 |
| committee-specialist | 2000/2000 | 1892/2000 | 108/2000 | 0/2000 | 50.53 | 5.09 | 435.38 |
| coalition-broker | 2000/2000 | 2000/2000 | 0/2000 | 0/2000 | 51.39 | 4.00 | 429.42 |
| greedy-same-party | 2000/2000 | 2000/2000 | 0/2000 | 0/2000 | 49.67 | 4.00 | 432.70 |
| district-reward | 2000/2000 | 2000/2000 | 0/2000 | 0/2000 | 50.87 | 4.00 | 415.61 |

## Distinct action paths

- district-advocate: prioritizes District Trust, mandatory constituent work, district staff, and the targeted-data Tactic; 993 unique command traces; actions SUBMIT_WORK 20000, START_ASSIGNMENT 2000, RESOLVE_DECISION 4000, RESOLVE_STORY 12000, FAST_FORWARD 34888; learned Tactics tactic-targeted-data-briefing 2000; Tactics applied to completed work none observed; leading choices answer-renter-calls 2674, take-office-reset 2050, join-forum 1840, convene-shared-table 1236, choice-accept-local-control 1046; leading completed paths pattern-summarize-evidence 8000, pattern-draft-policy 4000, pattern-earn-district-endorsement 4000, pattern-shared-interest-outreach 4000.
- committee-specialist: prioritizes Bill Momentum, counsel, and early committee preparation even when optional Story costs compete with coalition work; 1000 unique command traces; actions SUBMIT_WORK 19976, START_ASSIGNMENT 2000, RESOLVE_DECISION 3976, RESOLVE_STORY 12000, FAST_FORWARD 35106; learned Tactics tactic-early-committee-consultation 2000; Tactics applied to completed work none observed; leading choices press-through-overload 1160, respond-to-media 1140, take-briefing-slot 1094, choice-accept-local-control 1046, choice-accept-fair-access 1016; leading completed paths pattern-summarize-evidence 8000, pattern-draft-policy 4000, pattern-earn-district-endorsement 4000, pattern-shared-interest-outreach 3976.
- coalition-broker: protects Political Capital for outreach, prefers same-party offices first, and studies bipartisan coordination; 1998 unique command traces; actions SUBMIT_WORK 20000, START_ASSIGNMENT 2000, RESOLVE_DECISION 4000, RESOLVE_STORY 12000, FAST_FORWARD 36786; learned Tactics tactic-bipartisan-working-group 2000; Tactics applied to completed work none observed; leading choices take-office-reset 1312, convene-shared-table 1116, choice-accept-local-control 1046, choice-accept-fair-access 1028, choice-accept-renter-stability 972; leading completed paths pattern-summarize-evidence 8000, pattern-draft-policy 4000, pattern-earn-district-endorsement 4000, pattern-shared-interest-outreach 4000.
- greedy-same-party: prefers same-party offices, minimizes optional Story cost, completes visible mandatory work, and does not study a Tactic; 2000 unique command traces; actions SUBMIT_WORK 20000, START_ASSIGNMENT 0, RESOLVE_DECISION 4000, RESOLVE_STORY 12000, FAST_FORWARD 35332; learned Tactics none; Tactics applied to completed work none observed; leading choices press-through-overload 1160, choice-accept-local-control 1046, choice-accept-fair-access 1028, choice-accept-renter-stability 972, choice-accept-permitting-path 954; leading completed paths pattern-summarize-evidence 8000, pattern-draft-policy 4000, pattern-earn-district-endorsement 4000, pattern-shared-interest-outreach 4000.
- district-reward: uses district-focused Story choices and staff order, meets visible deadlines, and studies negotiated cost sharing; 994 unique command traces; actions SUBMIT_WORK 20000, START_ASSIGNMENT 2000, RESOLVE_DECISION 4000, RESOLVE_STORY 12000, FAST_FORWARD 35744; learned Tactics tactic-negotiated-cost-sharing 2000; Tactics applied to completed work none observed; leading choices answer-renter-calls 2674, take-office-reset 2050, join-forum 1840, convene-shared-table 1236, choice-accept-local-control 1046; leading completed paths pattern-summarize-evidence 8000, pattern-draft-policy 4000, pattern-earn-district-endorsement 4000, pattern-shared-interest-outreach 4000.

## Baseline dominance checks

- greedy-same-party vs district-advocate: does not dominate — Counterexample seed 1/democratic: final districtTrust, final staffMorale; final PC 5 vs 5, spent 4 vs 4, idle 430.0s vs 432.0s; traces 59744b25e786 vs d40be0e6bbe9.
- greedy-same-party vs committee-specialist: does not dominate — Counterexample seed 1/democratic: final billMomentum, final staffMorale, minimum staffMorale; final PC 5 vs 1, spent 4 vs 6, idle 430.0s vs 438.0s; traces 59744b25e786 vs 589e24cbc8c6.
- greedy-same-party vs coalition-broker: does not dominate — Counterexample seed 1/democratic: idle simulation, final staffMorale, minimum staffMorale; final PC 5 vs 5, spent 4 vs 4, idle 430.0s vs 425.0s; traces 59744b25e786 vs bd17fde428af.
- district-reward vs district-advocate: does not dominate — No paired disadvantage, but readiness wins were not greater (2000/2000 vs 2000/2000).
- district-reward vs committee-specialist: does not dominate — Counterexample seed 1/democratic: final billMomentum, minimum staffMorale; final PC 5 vs 1, spent 4 vs 6, idle 420.0s vs 438.0s; traces 11e6816b1193 vs 589e24cbc8c6.
- district-reward vs coalition-broker: does not dominate — Counterexample seed 1/democratic: final billMomentum, final staffMorale, minimum staffMorale; final PC 5 vs 5, spent 4 vs 4, idle 420.0s vs 425.0s; traces 11e6816b1193 vs bd17fde428af.

Dominance requires paired completion, every ready outcome, equal-or-smaller readiness gaps, Political Capital spend and idle time, no additional missed obligations, and no lower final or minimum resource. Incomparable outcomes are reported as non-dominance. Bot outcomes do not show that people find the game fun.

## Harness failures

None. Not-ready completed Sessions remain outcomes in the denominator and are not harness failures.
