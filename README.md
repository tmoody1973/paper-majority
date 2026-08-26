# Paper Majority

*A Congressional Strategy Game*

**Build the bill. Hold the coalition. Face the vote.**

A desktop-first web game in which a fictional freshman member of the House guides a
housing-affordability bill through one compressed 24-week congressional term. Cards are
dragged and stacked on an open desk; every factual claim stays sourceable and visibly
separate from simulation.

## Picking this up cold?

Start with **[docs/HANDOFF.md](docs/HANDOFF.md)** — current state, how to run it, the
traps that cost real time, and what is waiting on a decision.

## Status

Phase 1 — the fun-first interaction spike. The build stops at **Verification Checkpoint 1**
and does not begin the 30-definition Phase 2 catalog without explicit approval.

## Requirements

- **Node.js 20 or later** (this repository is developed on Node 26)
- **npm**
- **Python 3.9 or later** — only for the deterministic SVG asset builders under `art/`.
  Use `python3`; a bare `python` command is not assumed to exist.
- A modern desktop browser

## Local development

```bash
npm --prefix web install
npm --prefix web run dev
```

Open the URL that `next dev` prints. Do not reuse a stale `localhost` link from an
earlier process.

## Verification scripts

Run each from the repository root.

| Command | What it proves |
| --- | --- |
| `npm --prefix web run lint` | ESLint passes across the app |
| `npm --prefix web run typecheck` | `tsc --noEmit` reports no type errors |
| `npm --prefix web run test:run` | The Vitest unit and component suite passes |
| `npm --prefix web run test:coverage` | The same suite plus a coverage report |
| `npm --prefix web run test:e2e` | The Playwright end-to-end suite passes |
| `npm --prefix web run validate:content` | The scenario snapshot parses and satisfies every content rule *(added in Task 5)* |
| `npm --prefix web run balance` | The seeded balance simulation runs *(added in a later task)* |

## Asset kit

The supplied Civic Illustration Kit is source-master artwork, not runtime art.

```bash
python3 art/masters/modular-kit/civic-illustration-kit/build_kit.py
python3 art/masters/modular-kit/civic-illustration-kit/build_sheet.py
python3 art/masters/modular-kit/civic-illustration-kit/validate_kit.py
```

Expected validator output: `Civic Illustration Kit valid: 41 assets across 6 categories`.

## Architecture

- A pure TypeScript domain engine owns all authoritative state, rules, randomness and outcomes.
- Phaser 4 owns the tactile desk, card input and game animation.
- React owns text-heavy and accessibility-sensitive surfaces, including the Staff Handbook.
- React and Phaser dispatch commands; neither mutates authoritative state directly.
- No runtime LLM. No live government API calls during play.

## Authority order

1. `docs/superpowers/plans/2026-08-23-paper-majority-vertical-slice.md`
2. `docs/superpowers/specs/2026-08-23-paper-majority-design.md`
3. `docs/superpowers/specs/2026-08-23-paper-majority-art-design.md`
4. `docs/examples/pattern-gameplay-walkthrough.md` — explanatory example only
5. `art/masters/modular-kit/civic-illustration-kit/README.md` and `manifest.json`
6. The three root-level SVG mockups

`references/inspiration/` is optional background and never adds requirements.
