# Start Here: Building Paper Majority with Claude Code — Starter v4

This package contains the approved design authority and execution instructions for the Paper Majority vertical slice. It does not contain generated application code; Claude Code creates that code by following the implementation plan.

## Package contents

- `CLAUDE.md` — persistent project instructions Claude Code reads from the project root
- `INITIAL-PROMPT.txt` — the first prompt to paste into Claude Code
- `docs/superpowers/specs/` — approved gameplay and art specifications
- `docs/superpowers/plans/` — the sequenced, test-driven implementation plan
- `docs/examples/pattern-gameplay-walkthrough.md` — a plain-language example of the complete loop, reusable patterns, Story Director and transparent election
- Three root-level SVG files — approved visual-direction references
- `art/masters/modular-kit/civic-illustration-kit/` — validated 41-asset SVG source kit, builders, manifest and review sheet
- `references/inspiration/` — optional Stacklands research; not implementation requirements
- `PACKAGE-MANIFEST.md` — file inventory and authority notes

## Requirements

- Claude Code installed and authenticated
- Node.js 20 or later
- Python 3.9 or later for the deterministic SVG asset builders
- npm
- Git
- A modern desktop browser
- `superpowers:executing-plans` available in Claude Code for the exact planned workflow

The Phaser Game Agent MCP is optional. It requires a Phaser account and credits; the game itself must never depend on the MCP at runtime.

## Optional Phaser MCP setup

Before opening Claude Code, run:

```bash
npx @phaserjs/game-agent
```

Complete the sign-in flow, restart Claude Code and verify the connection with:

```text
Check my Phaser Game Agent account.
```

If you skip this setup, Claude Code can still execute the implementation plan using Phaser normally.

## Build sequence

1. Extract this package into the directory that will become the project root.
2. Open a terminal in `paper-majority-claude-code-starter`.
3. Start Claude Code:

   ```bash
   claude
   ```

4. Open `INITIAL-PROMPT.txt`, copy the entire contents and paste them into Claude Code.
5. Confirm that Claude Code runs the supplied Civic Illustration Kit validator successfully during preflight.
6. Review Claude Code's environment and document preflight.
7. Let Claude Code execute Phase 1 through Verification Checkpoint 1.
8. Read the gameplay walkthrough, then test the 10-minute interaction spike yourself and with ten first-time players using the supplied worksheet.
9. Do not approve Phase 2 until the three patterns, four-to-five-stack density change, Teased → Discovered → Expanded Handbook story, Staff-based Tactic study, pressure cues and recognition/replay thresholds pass.

## Asset-kit preflight

You can verify the supplied asset library before opening Claude Code:

```bash
python art/masters/modular-kit/civic-illustration-kit/validate_kit.py
```

Expected: `Civic Illustration Kit valid: 41 assets across 6 categories`.

The kit supplies reusable icons and issue thumbnails. Non-housing issue assets remain source-only during the vertical slice. Task 6 still requires eight cleaned pilot illustrations and human review before any 77-card bulk-art production begins.

## What Checkpoint 1 should produce

Claude Code should complete Tasks 1–4 and stop with evidence for:

- The application and test harness
- The deterministic domain foundation
- Deterministic family/tag/source-class pattern validation
- The React–Phaser bridge
- An eight-definition, 12–16-instance, three-pattern interaction spike playable in under ten minutes
- Four valid concrete stacks before the Tactic and five after it
- One rejected opposing-party outreach stack becoming valid after Bipartisan Working Group
- A Staff Handbook that visibly moves from Teased to Discovered to Expanded
- Staff + Tactic study that activates the existing rule expansion rather than a second recipe system
- Card pickup, dragging, valid stacking, transformation and invalid separation
- Visible district deadline, staff overload and coalition-request pressure before meter consequences
- A blank ten-person playtest worksheet for recording recognition, causality and voluntary replay
- Automated test, type-check, lint and build results named in the plan
- Manual testing instructions and a commit summary

The 30-definition housing scenario, 16-pattern/50-stack six-week loop and eight-card art pilot belong to Phase 2 and must not begin without your approval. Expansion to 77 definitions, 38 patterns and at least 200 concrete stacks occurs only after Checkpoint 2.

The full term also implements a transparent simulated election: a seeded opponent revealed in Week 1, a narrowing outlook labeled as not polling, and a final line-item vote-share ledger with no hidden finish-line roll.

## Current official setup references

- Phaser Game Agent MCP: <https://phaser.io/agent/mcp>
- Claude Code MCP: <https://code.claude.com/docs/en/mcp>
- Phaser documentation: <https://docs.phaser.io/>
