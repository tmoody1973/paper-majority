# Paper Majority Civic Illustration Kit

This deterministic SVG kit supplies the reusable visual grammar for the Paper Majority prototype. It is designed to support the approved **Illustrated Civic Desk** direction without turning every card into a generic software icon.

## What the kit contains

| Category | Count | Purpose |
|---|---:|---|
| Card-family icons | 8 | Staff, Policy, Evidence, Coalition, Constituency, Institution, Political and Tactic |
| Provenance icons | 3 | Official record, Derived context and Simulated |
| Resource icons | 6 | Staff Attention, Political Capital, District Trust, Bill Momentum, Policy Integrity and Staff Morale |
| Status icons | 6 | Working, expiring, overextended, locked, conditional and committed |
| Institution/desk-zone icons | 6 | Committee, House floor, Senate, Bill Docket, Sourcebook and Archive |
| Issue-module illustrations | 12 | Issue selection, Briefing Packs and Sourcebook navigation |

The issue-module set deliberately separates **Public Safety** from **Justice** and **Immigration** from **Civil Rights**. Combined symbols would collapse distinct civic subjects into misleading shorthand.

## Taxonomy rules

The game uses three independent visual systems:

1. **Card family** describes what a card does.
2. **Provenance** describes whether information is Official, Derived or Simulated.
3. **Issue** describes the policy subject.

Issue colors never replace the family band, family icon or family label. Evidence is a card family and is not a provenance class.

## Production boundary

This kit may supply:

- Family, provenance, resource and status icons
- Issue-selection and Sourcebook thumbnails
- Components for icon-led procedural and tactic cards
- Composition scaffolding for the eight-card art pilot

It may not substitute for:

- The eight cleaned 1024 x 768 pilot illustrations
- Reviewed constituency or culturally specific scenes
- Authorized real-lawmaker photographs
- Bespoke hero illustrations
- District-specific environmental research

All visible labels are rendered by Phaser or React. Runtime SVG files contain no `<text>` elements or font dependencies, which keeps them localizable and prevents semantic copy from becoming baked into artwork.

## Commands

Run from the project root:

```bash
python art/masters/modular-kit/civic-illustration-kit/build_kit.py
python art/masters/modular-kit/civic-illustration-kit/build_sheet.py
python art/masters/modular-kit/civic-illustration-kit/validate_kit.py
```

`build_kit.py` regenerates every runtime-safe SVG and `manifest.json`. `build_sheet.py` creates the review-only `kit-sheet.svg`. `validate_kit.py` verifies taxonomy counts, checksums, alt text, relative paths and the absence of baked-in text or external dependencies.

## Review status

Every asset is marked `usageStatus: prototype`. Community-facing or culturally sensitive final assets still require the representation review defined in the art specification. Icons marked `representationReview: pending` are visual starting points, not approved final depictions.

## Extending the kit

Add a new generator to the appropriate function in `build_kit.py`, then regenerate and validate. New assets must:

- Use a stable semantic ID
- Use the approved palette or an explicitly reviewed secondary tint
- Remain identifiable without color
- Contain no visible semantic text
- Include functional alt text in the manifest
- Avoid real-person likenesses, official seals and unsourced cultural imagery
