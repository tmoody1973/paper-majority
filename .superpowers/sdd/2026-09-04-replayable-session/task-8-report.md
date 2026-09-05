# Task 8 report — bounded housing opportunities and strategies

## Status

Implemented and locally verified on `codex/replayable-session` from Task 7 commit
`9993cd34e1953f0113fb676cb8268f77217db03f`. The housing snapshot remains a
visible **candidate** with `humanReviewPending: true`; this task did not promote
content or claim human review.

## Implementation and public contracts

- Added the strict candidate catalog, source map, manifest, loader, catalog
  analyzer and validator under `web/src/content/housing`,
  `web/src/content/loadScenario.ts`, `web/src/content/catalogAnalysis.ts` and
  `web/scripts/validate-content.ts`.
- `domain/runSetup.ts` is now the canonical `createRun(input)` implementation.
  Session setup validates the three fixed staff roles, raw evidence and Policy
  supply, baseline summarize/draft path and supported Tactic effects. It consumes
  the existing opponent draw followed by one stable definition-ID-ordered trait
  draw per staff role. A complete authored role pool receives deterministic
  trait/generalist variation; narrow legacy fixtures with incomplete role pools
  retain their historical one-draw setup.
- `domain/packs.ts` exports
  `openPack(state, scenario, packOccurrenceId, categoryId): EngineResult`.
  Guaranteed cards consume no RNG; each actual weighted pool pick consumes one
  draw in stable definition-ID order. The selected category, exact card IDs and
  occurrence are frozen in `state.revealedPacks`. Reopening, inspection,
  rearrangement and reload do not redraw. Pack obligations receive typed
  `OBLIGATION_CREATED` receipts with exact obligation/source/occurrence identity.
- `domain/storyDirector.ts` exports
  `eligibleStoryEvents(state, scenario): StoryEventDefinition[]`,
  `drawStoryEvent(state, scenario): EngineResult`, and the integrated
  `resolveStoryEvent`. Selection applies eligibility, cooldown, forced recovery,
  term-style weights and one seeded draw in that order. It blocks consecutive
  pressure categories, forces a recovery after two pressure/consequence events,
  and has an unconditional recovery fallback. Pending and resolved decisions
  retain stable occurrence IDs in `state.pendingStoryDecisions` and the event log.
- Added canonical `DRAW_STORY_EVENT` and `RESOLVE_STORY` commands, Story decision
  receipts, pack receipts and strict save checks. Save validation correlates every
  persisted Story decision and revealed pack to its exact canonical event
  receipt. GameSession checkpoints on Story presentation/resolution and pack open.
- `GameShell` renders the candidate-review notice, visible weekly pack actions and
  the Story decision dialog with exact cost/effect text. The development-only
  `/workbench/catalog` route supports real browser validation; Task 9 still owns
  final setup and Resume/New presentation.
- Added five allowlisted derived resolvers and used the existing recipe matcher,
  work-rule capture, tactic expansion, resource, decision, relationship,
  obligation and save engines. Specialized Session outreach now consumes and
  returns the exact captured inputs, allowing prepared endorsements, committee
  packets and political assets to be spent rather than silently retained.
- Official Clerk identity fields remain under `officialRecord`. Authored
  `housing-interest` and `shared-interest` behavior is kept separately under
  `simulation.interestTags`; district priorities, demands, staff traits, Story
  text, relationship state and House baseline are simulation content.

## Catalog receipt

- 30 playable definitions: 3 Staff, 5 Policy, 5 Evidence, 4 offices,
  4 Constituency, 3 Institution, 2 Political and 4 Tactics.
- Preserved the required three Staff IDs and five Policy IDs. The four office
  definitions are exactly Mike Flood, J. French Hill, Maxine Waters and Emanuel
  Cleaver, backed by their frozen Clerk profiles.
- 16 patterns, including four universal actions, five cross-family uses, three
  chained preparation/provision uses and four tactic-affected actions. Every
  pattern has a concrete resolver/effect and a drawable raw supply path. Prepared
  Constituency, Institution, Political, Evidence and drafted Policy forms are
  each reachable from an authored transformation.
- All five Evidence definitions include roles, valid forms, transformations,
  underlying source IDs and finite sinks. Three expose all four competing sinks:
  drafting, office concern, district preparation and committee preparation.
- Four supported tactic effects: widen one slot, reduce one resource cost, shorten
  one duration and add one procedure stage. Two Tactics are guaranteed by Week 3;
  all four arrive by Week 5. Baseline paths remain available without study.
- 12 Story events: 3 opportunities, 3 pressures, 3 consequences and 3 recoveries.
  Every event has conditions, choices, explicit costs, cooldown, cause text and
  stable occurrence identity.
- Each coalition accept/counter choice charges 2 Political Capital up front and
  authors +1 Political Capital as a deferred first-fulfillment reward through the
  existing once-only `rewardedOccurrenceIds` helper. The decision component is
  net -1 before any required-work cost, so bill remove/re-add revisions cannot
  create a profitable acceptance loop. Each demand retains a free unconditional
  refusal.
- House accounting is 1 player + 4 other curated offices + 430 anonymous seats =
  435.
- Base density for each party: 477 distinct unordered definition sets,
  588 reachable form-aware matches and 9 distinct outcomes. All 16 Tactic subsets
  for both parties (32 states) have zero equal-ranked collisions.
- The original interaction-spike report remains exactly 4 base / 5 expanded.

## Source and normalization receipt

Final tracked hashes:

- Candidate scenario SHA256:
  `10ce570df56fbc5efdf3cb2c375ba210f687791c16a7fc062273dea4d4045254`
- Source-map SHA256:
  `278210172fdfd89bbac3b4d6b3efe04706e131746ccf32a57c2df090cd9aec96`

The final normalization revision is
`web/.ingest-staging/housing-2026-09-04-task8-final-candidate` (ignored by Git).
It verified all 21 entries in the frozen raw-input manifest, streamed the roughly
47 MB ACS table, retained only the 13 mapped fields for the six mapped district
rows, and wrote a candidate-only normalized manifest with `promoted: false`.
Its scenario and source-map hashes exactly match the tracked manifest above. A
second normalization attempt exited 1 with
`Refusing to overwrite normalized snapshot outputs`.

Mapped source types actually used are five official program/context records,
four Clerk member profiles, two committee pages, the ACS B25070 table and metadata,
and CHAS, FMR, Building Permits Survey and AHS documentation/fallback records.
Normalization checksum-verified every referenced staged file. The live Census
fetch was intentionally skipped because the exact official raw bytes were already
frozen and verified; no identical refetch was needed.

The Congress.gov CLI wrote `mapped=0 fetched=0 skipped=1`; the House Clerk
roll-call CLI wrote `mapped=0 fetched=0 skipped=1`. Their source-map arrays are
explicitly empty because this Session makes neither legislative-history nor
roll-call claims. Congress credentials are read only from `CONGRESS_API_KEY` when
a reviewed mapping exists, and credential-bearing URLs are excluded from errors
and receipts. Future legislative-history or vote features require new reviewed
official records rather than substituting a HUD page or fabricated resource.

## Verification

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm test -- --run --pool=threads --maxWorkers=1` — PASS, 39 files / 344 tests.
- `npm test -- --run --pool=threads --maxWorkers=1 src/content/catalog.test.ts src/domain/runSetup.test.ts src/domain/packs.test.ts src/domain/storyDirector.test.ts src/domain/patternResolvers.test.ts src/persistence/saveRepository.test.ts`
  — PASS, 6 files / 42 tests.
- `npm run validate:content` — PASS: 30/16/4/12 counts, 477 definition
  sets, 588 form-aware matches, 9 outcomes, 32 collision states, 21 raw checksums,
  6 ACS geographies, eight governing values and 435-seat accounting.
- `npm run report:patterns` — PASS, legacy 4 base / 5 expanded.
- `npm run report:patterns:session` — PASS, zero collisions for both parties and
  all 16 Tactic subsets.
- `npm run ingest:normalize -- --snapshot housing-2026-09-04-task8-final-candidate`
  — PASS, 30 cards / 6 mapped Census rows / 21 raw checksums. Repetition exited 1
  with the expected refusal-to-overwrite message.
- `npm run ingest:congress -- --snapshot housing-2026-09-04-task8-congress-receipt`
  — PASS, 0 mapped / 0 fetched / 1 truthfully skipped.
- `npm run ingest:house-votes -- --snapshot housing-2026-09-04-task8-house-receipt`
  — PASS, 0 mapped / 0 fetched / 1 truthfully skipped.
- `npm run test:e2e -- e2e/candidate-catalog.spec.ts` — PASS, 1 Chromium test.
  It used the visible Story choice and pack button, then reloaded and verified the
  exact reveal, Story ledger and RNG cursor. The first sandboxed attempt could not
  bind suite-owned port 3100 (`EPERM`); the required rerun outside the sandbox
  passed and left no server running.

## Residual boundaries

- Official-source/editorial human review and art/replay acceptance remain pending;
  the catalog must stay candidate until those human gates occur.
- Task 9 owns final setup, Resume/New and Week 6 readiness presentation. The
  once-only readiness milestone is deliberately not duplicated here.
- Task 11 still owns balance-bot and exploit-path validation, including repeated
  outreach and bill-revision economy probes. The authored acceptance economy is
  bounded and once-only, but this report does not claim Task 11 acceptance.
- Any future legislative-history or vote feature must add reviewed Congress.gov or
  Clerk roll-call records and exercise the nonempty mapped-fetch path.
