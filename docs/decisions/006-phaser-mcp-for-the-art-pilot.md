# 006 — The Phaser Game Agent generates art studies, not the pilot masters

- **Decision** — Use the Phaser Game Agent MCP during the eight-card art pilot, for
  exploration only: composition studies, object variations, palette and lighting
  alternatives. The eight finished 1024 × 768 card masters are produced by a human
  from those studies. Every generated file is downloaded and committed to this
  repository; the game never loads anything from Phaser's CDN.

- **Why this came up** — Tarik directed that the art pilot use the Phaser MCP. Before
  planning around it, its actual tools were read rather than assumed.

  What is at stake: the pilot gate is where the visual system is either approved for
  bulk production or sent back. Building it on a tool that cannot meet the spec would
  be discovered at the gate, after the work.

- **What the tool can and cannot do**

  | Pilot requirement | Phaser MCP | Fit |
  |---|---|---|
  | 1024 × 768 card master | `generate_sprites` caps the longest side at **256 px** | **No** |
  | Illustrated Civic Desk — warm ink lines, 4–6 colours | Pixel art by default; only the `story` preset is painted | **No, by default** |
  | A person or an action on the card | `generate_background` is scenery only — "no characters, sprites, text or UI" | **Partial** |
  | Composition and palette studies | Exactly what it is good at | **Yes** |
  | Runtime asset delivery | Returns absolute CDN URLs and instructs you never to download them | **Refused** — see below |

- **Options**
  1. **Generate the eight pilot cards with the MCP directly.** Fails on size and style,
     and the spec forbids AI finalising an image without human cleanup and review.
  2. **Use it for studies; a human finishes the masters (chosen).** Slower, but it is
     what the approved art specification already prescribes for AI.
  3. **Skip the MCP entirely.** Loses a genuinely useful exploration tool for palette
     and composition alternatives, which is the expensive part of art direction.

- **What we chose and why** — Option 2, by Tarik (use the MCP) and Claude (scope it to
  studies). The art specification already says AI may support "composition studies,
  object and room variations, temporary card art, background exploration, palette and
  lighting alternatives" and may not independently finalise "any image that has not
  received human consistency and representation review". This decision applies that
  rule to a specific tool rather than inventing a new one.

- **The runtime rule this tool wants to break** — Its own instructions say to load its
  CDN URLs verbatim and never download them. This project forbids exactly that: the
  game must build and run with no MCP connection, and the production bundle is scanned
  for MCP URLs at every checkpoint. So generated files get downloaded, reviewed,
  committed under `art/`, and exported to `web/public/assets/`. The CDN URL is a
  delivery mechanism during development and never appears in shipped code.

- **What we gave up** — The fastest path. Generating eight cards directly would take
  minutes; studies plus human cleanup takes days. We also spend credits on output that
  is thrown away once it has informed the real drawing.

- **How we will know if this was right** — At the pilot's five-second recognition test
  with ten viewers: at least 90% correct on family and information class, 80% on
  dominant action. If the studies measurably shortened the path to a passing card, the
  tool earned its place. If the human redrew from scratch anyway, drop it.

- **What actually happened** —
