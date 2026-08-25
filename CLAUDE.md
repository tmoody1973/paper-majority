# Paper Majority — Claude Code Project Instructions

## Project identity

**Paper Majority** is a desktop-first congressional strategy game built with Next.js, React, TypeScript and Phaser 4.

**Subtitle:** *A Congressional Strategy Game*  
**Tagline:** *Build the bill. Hold the coalition. Face the vote.*

## Source-of-truth order

When instructions appear to conflict, use this order:

1. `docs/superpowers/plans/2026-08-23-paper-majority-vertical-slice.md`
2. `docs/superpowers/specs/2026-08-23-paper-majority-design.md`
3. `docs/superpowers/specs/2026-08-23-paper-majority-art-design.md`
4. `docs/examples/pattern-gameplay-walkthrough.md` — explanatory example, never authority over the plan
5. `art/masters/modular-kit/civic-illustration-kit/README.md` and `manifest.json`
6. The three root-level SVG mockups
7. `references/inspiration/` — optional context only, never additional requirements

Ask the user before resolving a material contradiction or expanding scope.

## Execution rules

- Use `superpowers:executing-plans` when it is installed.
- Execute the implementation plan in order and keep its checkboxes current.
- Use test-driven development exactly as specified in the plan.
- Run each named verification command and inspect its output before claiming completion.
- Make the named commits after their verification succeeds.
- Stop after every verification checkpoint and wait for explicit user approval.
- Do not begin Phase 2 during the initial work session.
- Do not create features, content, art or infrastructure outside the approved vertical-slice scope.
- If the repository has unrelated existing changes, preserve them and report any overlap before editing.

## Architecture boundaries

- The pure TypeScript domain engine owns authoritative state, commands, rules, randomness and outcomes.
- The engine matches controlled family/tag/source-class slots, ranks specificity deterministically and rejects ambiguous published patterns.
- Derived pattern outputs use allowlisted resolver IDs; scenario JSON never stores or evaluates functions.
- Tactics apply bounded, declarative per-term rule expansions recorded in authoritative state.
- Phaser owns the tactile desk, card input and game animation.
- React owns text-heavy, accessibility-sensitive and source-oriented interfaces, including the Staff Handbook and Sourcebook.
- React and Phaser send commands; neither directly mutates authoritative state.
- Identical snapshot, seed and command sequence must produce identical results.
- The election opponent is drawn once from the seeded stream during setup, revealed in Week 1 and never rerolled. The pure engine owns the visible outlook and final line-item calculation.
- Do not add a runtime LLM or call live government APIs during play.
- Government data enters only through validated, versioned snapshots.

## Civic-integrity boundaries

- Keep official records, derived context and simulation visibly and structurally separate.
- Never invent a citation or fill a missing fact through inference.
- Never present simulated support, motives or negotiations as claims about a real lawmaker.
- Use portrait-free member-office cards for real lawmakers. Do not acquire, generate, alter or ship a real lawmaker likeness during the vertical-slice plan.
- Do not treat demographics as predictors of political behavior.
- Never use demographic fields in the election calculation or present the simulated outlook as polling.

## Art boundaries

- Follow the approved Illustrated Civic Desk direction.
- Prove the 10-minute, eight-definition pattern-density interaction spike before building the civic-data catalog.
- Produce the eight-card pilot before bulk art.
- Keep Phase 2 at exactly 30 playable definitions and 12 Story Director events until Checkpoint 2 is approved.
- Do not begin the complete 77-card art library until Checkpoint 2 is approved.
- Preserve family color, icon and text redundancy and the independent provenance system.
- Use the supplied Civic Illustration Kit as a validated source-master library, not as a replacement for bespoke pilot art.
- Keep card family, provenance and issue taxonomies independent. Evidence is a family, not a provenance class.
- Render visible labels through Phaser or React. Do not bake semantic text or font dependencies into runtime SVGs.
- Do not let issue-thumbnail colors override the approved card-family color system.
- Every drag action requires a keyboard-accessible equivalent.
- Reduced motion must communicate every state change.

## Pattern and discovery boundaries

- Do not author exact input-definition-ID recipes.
- The Phase 1 fixture has eight distinct starting definitions, 12–16 instances, three patterns, four base valid stacks and five after the Tactic expansion.
- Failed stacking is free: no resource, time, discovery or expansion state changes.
- Per-run discoveries and activated Tactics live in `TermState`; lifetime discoveries live in a separate player profile and never change a term's rules.
- Handbook state is derived from the existing fields only: Teased before discovery, Discovered after first accepted use and Expanded after a declared Tactic expansion. Do not add `requiresUnlock` or a parallel recipe system.
- The player studies a Tactic by stacking eligible Staff with it and completing a timed assignment; completion invokes the existing `ACTIVATE_TACTIC`/`TacticExpansionDefinition` path.
- The 30-definition six-week catalog requires exactly 16 patterns, four Tactic effects and at least 50 concrete stacks.
- The 77-definition full catalog requires exactly 38 patterns, 20 Tactic effects, at least 200 concrete stacks and zero ambiguous collisions.

## Election boundaries

- Reveal Weak, Moderate or Strong opponent strength in Week 1 from the setup seed using the approved 25/50/25 thresholds.
- Show **Simulated outlook — not polling** with a `±8`, `±5` or `±3` range for Weeks 1–8, 9–16 or 17–24.
- Use the approved visible line items only: baseline, opponent, District Trust, bill outcome, governing consistency and capped authored election effects.
- Do not separately score Staff Morale, coalition count or unanswered concerns at the end; their upstream consequences are already represented.
- Never draw new randomness during reelection. The Term Record must show an exact one-decimal vote share and a ledger that sums to it.

## Civic Illustration Kit

The starter kit is located at `art/masters/modular-kit/civic-illustration-kit/`. Before copying or modifying one of its assets, run:

```bash
python art/masters/modular-kit/civic-illustration-kit/build_kit.py
python art/masters/modular-kit/civic-illustration-kit/build_sheet.py
python art/masters/modular-kit/civic-illustration-kit/validate_kit.py
```

Expected validation: `41 assets across 6 categories`. The kit contains prototype-safe family, provenance, resource, status, institution and issue SVGs. It contains no production card illustrations, real-lawmaker photographs or approved community scenes.

## Phaser Game Agent MCP

The Phaser Game Agent MCP is an optional development accelerator, not a runtime dependency or architectural authority.

- Use it only for bounded Phaser scene, input, animation, temporary-asset or screenshot experiments.
- Review, test and commit any accepted output locally.
- The game must build and run without an MCP connection.
- If the MCP is unavailable, continue with the normal Phaser implementation unless the current task explicitly requires it.

## Initial stopping point

The first implementation session ends at **Verification Checkpoint 1 — Fun-First Interaction Gate**. Present pattern-density output, deterministic/ambiguity tests, Staff Handbook and Tactic-expansion evidence, manual interaction checks, the ten-person playtest worksheet, threshold results, commit list, known limitations and the exact approval needed to begin the 30-definition Phase 2 catalog.
