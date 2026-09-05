# Session balance report

Generated: 2026-09-05T17:45:50.025Z
Snapshot: `housing-session-2026-09-04-candidate` / `52221d76ef034c5cab06d8d7066f575be0771ff80ff5de69f4d8cd1d3e9c739e`
Manifest: seeds 1–1000, parties democratic + republican, pace standard, five policies, 10000 total runs.

| Policy | Complete | Ready | Not ready | Harness failures | Avg commands | Avg PC spent | Avg idle seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| district-advocate | 2000/2000 | 1602/2000 | 398/2000 | 0/2000 | 52.28 | 5.52 | 332.56 |
| committee-specialist | 2000/2000 | 2000/2000 | 0/2000 | 0/2000 | 53.76 | 6.00 | 343.63 |
| coalition-broker | 2000/2000 | 1626/2000 | 374/2000 | 0/2000 | 54.55 | 5.47 | 355.22 |
| greedy-same-party | 2000/2000 | 2000/2000 | 0/2000 | 0/2000 | 50.00 | 4.00 | 378.98 |
| district-reward | 2000/2000 | 2000/2000 | 0/2000 | 0/2000 | 50.00 | 4.00 | 390.33 |

## Distinct action paths

- district-advocate: resolves mandatory district priorities and delivers their earned endorsements to the authored recipients after drafting; no Tactic study is needed; 998 unique command traces; actions SUBMIT_WORK 21518, START_ASSIGNMENT 0, RESOLVE_DECISION 5518, RESOLVE_STORY 12000, FAST_FORWARD 37518; learned Tactics none; Tactics applied to completed work none observed; leading choices answer-renter-calls 2812, take-office-reset 1970, join-forum 1956, convene-shared-table 1306, choice-accept-local-control 1046; leading completed paths pattern-summarize-evidence 8000, pattern-draft-policy 4000, pattern-earn-district-endorsement 4000, pattern-negotiate-district-endorsement 3518, pattern-shared-interest-outreach 2000.
- committee-specialist: reserves evidence for two early committee packets and mandatory district endorsements, uses one packet to review a provision and delivers the other, and drafts with finite political assets; 1330 unique command traces; actions SUBMIT_WORK 22000, START_ASSIGNMENT 2000, RESOLVE_DECISION 4000, RESOLVE_STORY 12000, FAST_FORWARD 39520; learned Tactics tactic-early-committee-consultation 2000; Tactics applied to completed work tactic-early-committee-consultation 2000; leading choices press-through-overload 1126, choice-accept-fair-access 1028, choice-accept-renter-stability 972, steady-coalition 796, choice-preparation-committee-demand-local-control 704; leading completed paths pattern-earn-district-endorsement 4000, pattern-summarize-evidence 4000, pattern-tactic-costly-drafting 4000, pattern-tactic-early-preparation 4000, pattern-negotiate-committee-packet 2000, pattern-review-bill-preparation 2000.
- coalition-broker: protects Political Capital, drafts compatible language, prepares finite communication assets, and applies bipartisan widening to shared-interest office commitments; 1427 unique command traces; actions SUBMIT_WORK 22610, START_ASSIGNMENT 2000, RESOLVE_DECISION 4338, RESOLVE_STORY 12000, FAST_FORWARD 40148; learned Tactics tactic-bipartisan-working-group 2000; Tactics applied to completed work tactic-bipartisan-working-group 1810; leading choices take-office-reset 1452, convene-shared-table 1304, choice-accept-local-control 735, choice-accept-preservation 722, choice-accept-fair-access 676; leading completed paths pattern-summarize-evidence 8000, pattern-draft-policy 4000, pattern-earn-district-endorsement 4000, pattern-prepare-communication 2272, pattern-tactic-coordination 2272, pattern-shared-interest-outreach 2066.
- greedy-same-party: prefers same-party offices, minimizes optional Story cost, completes visible mandatory work, and does not study a Tactic; 1994 unique command traces; actions SUBMIT_WORK 20000, START_ASSIGNMENT 0, RESOLVE_DECISION 4000, RESOLVE_STORY 12000, FAST_FORWARD 36000; learned Tactics none; Tactics applied to completed work none observed; leading choices press-through-overload 1156, choice-accept-local-control 1046, choice-accept-fair-access 1028, choice-accept-renter-stability 972, choice-accept-permitting-path 954; leading completed paths pattern-summarize-evidence 8000, pattern-draft-policy 4000, pattern-earn-district-endorsement 4000, pattern-shared-interest-outreach 4000.
- district-reward: uses district-focused Story choices and staff order, meets visible deadlines, and studies negotiated cost sharing; 1958 unique command traces; actions SUBMIT_WORK 18000, START_ASSIGNMENT 2000, RESOLVE_DECISION 4000, RESOLVE_STORY 12000, FAST_FORWARD 36000; learned Tactics tactic-negotiated-cost-sharing 2000; Tactics applied to completed work tactic-negotiated-cost-sharing 2000; leading choices answer-renter-calls 2558, take-office-reset 1992, join-forum 1840, convene-shared-table 1144, choice-accept-local-control 1046; leading completed paths pattern-summarize-evidence 6000, pattern-earn-district-endorsement 4000, pattern-shared-interest-outreach 4000, pattern-draft-policy 2000, pattern-tactic-costly-drafting 2000.

## Baseline dominance checks

- greedy-same-party vs district-advocate: does not dominate — Counterexample seed 1/democratic: idle simulation, minimum staffAttention, minimum politicalCapital, final districtTrust, final staffMorale, minimum staffMorale; final PC 5 vs 2, spent 4 vs 6, idle 370.0s vs 329.0s; traces 3b551aeab57e vs a865fa5b6d4a.
- greedy-same-party vs committee-specialist: does not dominate — Counterexample seed 1/democratic: idle simulation, minimum politicalCapital, final billMomentum, final staffMorale; final PC 5 vs 2, spent 4 vs 6, idle 370.0s vs 344.0s; traces 3b551aeab57e vs d672c3b97b90.
- greedy-same-party vs coalition-broker: does not dominate — Counterexample seed 1/democratic: idle simulation, minimum politicalCapital, final billMomentum, final staffMorale, minimum staffMorale; final PC 5 vs 3, spent 4 vs 5, idle 370.0s vs 350.0s; traces 3b551aeab57e vs afd79c04fd6d.
- district-reward vs district-advocate: does not dominate — Counterexample seed 1/democratic: idle simulation, minimum staffAttention, minimum politicalCapital, final districtTrust, final billMomentum, final staffMorale, minimum staffMorale; final PC 5 vs 2, spent 4 vs 6, idle 394.0s vs 329.0s; traces 86d3248acf93 vs a865fa5b6d4a.
- district-reward vs committee-specialist: does not dominate — Counterexample seed 1/democratic: idle simulation, minimum politicalCapital, final billMomentum; final PC 5 vs 2, spent 4 vs 6, idle 394.0s vs 344.0s; traces 86d3248acf93 vs d672c3b97b90.
- district-reward vs coalition-broker: does not dominate — Counterexample seed 1/democratic: idle simulation, minimum politicalCapital, final billMomentum, final staffMorale, minimum staffMorale; final PC 5 vs 3, spent 4 vs 5, idle 394.0s vs 350.0s; traces 86d3248acf93 vs afd79c04fd6d.

Dominance requires paired completion, every ready outcome, equal-or-smaller readiness gaps, Political Capital spend and idle time, no additional missed obligations, and no lower final or minimum resource. Incomparable outcomes are reported as non-dominance. Bot outcomes do not show that people find the game fun.

## Harness failures

None. Not-ready completed Sessions remain outcomes in the denominator and are not harness failures.
