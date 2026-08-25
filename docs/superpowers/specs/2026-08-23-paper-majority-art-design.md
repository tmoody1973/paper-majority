# Paper Majority: Art and Card Design Specification

**Date:** August 23, 2026  
**Status:** Approved for implementation  
**Revision:** August 24, 2026 — Added the validated Civic Illustration Kit, the fun-first interaction gate, portrait-free member-office treatments, contextual tag legibility and the Staff Handbook discovery treatment for the vertical slice. Added Teased, Discovered and Expanded Handbook states plus the simulated Election Outlook and final election ledger treatment.  
**Parent specification:** `docs/superpowers/specs/2026-08-23-paper-majority-design.md`  
**Implementation plan:** `docs/superpowers/plans/2026-08-23-paper-majority-vertical-slice.md`

## 1. Purpose

This document defines the visual language, card anatomy, illustration standards, representation rules, asset-production process, member-office identity policy, motion language and quality gates for **Paper Majority** and its housing-affordability vertical slice.

The art system must satisfy four competing needs:

1. Make a complex institution approachable without making it trivial.
2. Keep all 77 playable card definitions readable on a crowded, overlapping desk.
3. Distinguish official records, derived context and simulated developments at a glance.
4. Scale to an independent prototype budget without producing a visibly inconsistent library.

The resulting direction is named **Illustrated Civic Desk**.

## 2. Approved Direction

### 2.1 Visual character

Illustrated Civic Desk uses:

- Warm ink outlines
- Simplified shapes and restrained texture
- Four to six colors per illustration
- Familiar congressional-office objects
- Contemporary civic environments
- Diverse people represented without caricature
- Restrained wit rooted in office process
- Sparse card faces with detailed inspection surfaces

The game should feel human and tactile rather than bureaucratic, ceremonial or cartoonish.

### 2.2 Tone

The tone is **grounded with restrained wit**.

Humor may come from:

- Excessive paperwork
- Crowded calendars
- Scheduling conflicts
- Overflowing district mail
- A desk that becomes increasingly difficult to organize
- Procedural language and competing deadlines
- Staff attempting to manage too many obligations

Humor must not come from:

- A person's race, ethnicity, gender, age, disability, religion, income or physical appearance
- A district's economic or demographic conditions
- Constituent hardship
- Cultural symbols
- A real lawmaker's face, body, voice or mannerisms
- Treating public service or civic participation as inherently foolish

### 2.3 Rejected directions

**Editorial Collage** was not selected as the primary direction because its print textures and overlapping shapes could become visually dense across a large card library.

**Institutional Blueprint** was not selected because it risked making play feel like a government dashboard. Blueprint motifs may still appear in Sourcebook diagrams, procedural previews or Institution-card backgrounds.

## 3. Design Principles

### 3.1 Recognition before explanation

The card face helps the player recognize an object and its immediate cost. The inspector explains how it works, why it matters and where its factual content came from.

### 3.2 One illustration, one idea

Each illustration has one dominant noun or verb. Examples include reviewing a report, opening an envelope, marking up a bill, answering district mail or counting votes.

### 3.3 No baked-in interface text

Card names, rules, resource values, source classes, party labels and status text are rendered by the game. Illustrations do not contain essential words or numbers. Incidental paper marks may appear as nonsemantic texture only.

### 3.4 Color never works alone

Every card family is identified by a color, icon and text label. Every information class is identified by a color, shape, icon and text label.

### 3.5 Facts and simulation remain visually separate

Official identity and public records are never combined into the same visual element as simulated support, demands or outcomes.

### 3.6 Party is not the primary visual taxonomy

Democratic and Republican affiliation appears as a small factual badge. Red and blue do not define evidence, constituencies, policies, institutions or card families.

## 4. Card Anatomy

### 4.1 Base proportions

| Property | Standard |
| --- | --- |
| Gameplay size at 100% zoom | 180 × 252 CSS pixels |
| Aspect ratio | 5:7 |
| Corner radius | 12 CSS pixels |
| Outer stroke | 2 CSS pixels |
| Family band | 8 CSS pixels high |
| Internal padding | 10–12 CSS pixels |
| Illustration window | Approximately 158 × 112 CSS pixels |
| Title | Maximum two lines |
| Stack-visible header | Top 42 CSS pixels |
| Minimum gameplay scale | 65% |
| Maximum gameplay scale | 150% |

The exact pixel implementation may adapt to device density, but proportions and information hierarchy must remain stable.

### 4.2 Resting card face

At rest, a card displays only:

1. Family band
2. Family icon and text label
3. Information-class badge
4. Illustration or member-office motif
5. Card name
6. One short contextual subtitle when necessary
7. One high-frequency time value
8. One high-frequency Staff Attention or Political Capital value

Mechanical paragraphs, citations, compatibility details, methodology and extended context do not appear on the resting face.

When a controlled tag is essential to predicting a pattern, the contextual subtitle translates it into player language—such as **Housing evidence** or **Policy staff**. Raw developer tags never appear on the card face, and a required match concept cannot exist only inside the inspector.

### 4.3 Inspector

Hover, focus, long press or an explicit Inspect command opens a React-rendered inspector outside the Phaser canvas. It contains:

- Card name and family
- Information class
- Plain-language mechanical effect
- Valid pattern hints already discovered by the player
- Time and resource costs
- Expiration or workload information
- Why the content matters in the current district or bill
- Source title, publisher, source year, publication date and retrieval date
- Derived method and uncertainty note when applicable
- Original source link
- Editorial review date
- Alt text

Any simulated field begins with or appears adjacent to the phrase **In this simulation**.

### 4.3.1 Staff Handbook

The Staff Handbook is a React-rendered discovery surface separate from the factual Sourcebook. Its visual language resembles an office training binder rather than a fantasy spell book.

- **Teased** patterns use silhouettes and one authored directional hint; they never reveal exact hidden inputs by default.
- **Discovered** patterns show two to four family/tag slots, their output and previously successful card examples.
- **Expanded** patterns retain the discovered base rule and receive a restrained annotation naming the Tactic and describing the exact widened eligibility or changed effect.
- The entry label, valid-hover cues and engine eligibility must agree. A visual lock may advertise that a Tactic can expand a rule, but it must not imply a separate hidden recipe.
- Pattern, Tactic and completion counts remain text-readable and screen-reader accessible.
- The Handbook may be opened while paused and never consumes simulation time.
- Pattern comprehension must not depend on color alone; family icon, family label, tag phrase and slot shape remain redundant.

### 4.3.2 Election Outlook and Term Record ledger

The Office Election Outlook is a React-rendered office planning surface, not a campaign-style poll graphic.

- Header: **Simulated outlook — not polling**.
- Show the revealed opponent as Weak, Moderate or Strong beginning in Week 1.
- Show the current range, Favored/Toss-up/Trailing status and expandable line items in plain language.
- Use the amber Simulated badge on the whole module and each final Term Record line item.
- Avoid horse-race television graphics, red-versus-blue map fills, polling needles, probability dials and celebratory casino motion.
- When an authored choice changes the outlook, pulse the affected line once and show the signed contribution with its cause.
- The final binder shows the exact one-decimal simulated vote share and a running-total ledger. Official district facts remain in a separate sourced section.
- Color never carries direction alone: every positive or negative change includes a sign, label and screen-reader announcement.

### 4.4 Stack behavior

When cards overlap, the family band, family label and card title remain visible. A selected stack can fan its contents. A resolved stack may collapse into a summary card.

The player's recognition order should be:

1. Family color and silhouette
2. Family icon
3. Card title
4. Information class
5. Cost

### 4.5 Member-office card anatomy

A real-lawmaker Coalition card uses:

- Neutral Illustrated Civic Desk office motif
- Name
- State and district
- Party badge
- Official committee or public-record context in the inspector
- A separate amber simulated-relationship layer for Interested, Conditional or Committed

The office identity and public-record block never change during the run. The relationship layer may change, but always remains labeled Simulated. No portrait, face, silhouette intended as a likeness or AI-generated approximation of the member appears in the housing vertical slice.

## 5. Card-Family System

| Family | Color | Hex | Icon | Function |
| --- | --- | --- | --- | --- |
| Staff | Violet | `#6A5485` | Person | Performs timed work |
| Policy | Coral | `#B6503A` | Document | Constructs the bill |
| Evidence | Teal | `#267783` | Chart | Supports or challenges provisions |
| Coalition | Ochre | `#9A6816` | Handshake | Builds legislative support |
| Constituency | Green | `#3D754E` | People | Expresses plural district interests |
| Institution | Navy | `#254F78` | Building | Controls procedure and access |
| Political | Plum | `#844263` | Megaphone | Changes momentum, attention and risk |
| Tactic | Slate | `#58636B` | Puzzle | Unlocks reusable combinations |

Colors may be adjusted slightly after contrast testing, but their hue families and relative distinction should remain stable.

### 5.1 Information-class system

> **Label change, August 25 2026.** The middle class was called *Derived context*.
> That phrase was a project coinage rather than civic vocabulary, so it taught a
> newcomer nothing. The three labels now read as a ladder of distance from the
> source. The internal identifier stays `derived`, so icons, manifests and saved
> files are unaffected. See `docs/decisions/007-plain-labels-for-the-middle-class.md`.

| Class | Color | Shape | Icon | Required label |
| --- | --- | --- | --- | --- |
| Official record | Blue `#2878A8` | Rounded square | Check | Official record |
| Based on records | Teal `#267783` | Diamond | Formula/sigma | Based on records |
| Simulated | Amber `#9A6816` | Hexagon | Spark | Simulated |

Information-class styling is independent of card-family styling. A teal Evidence card can still carry a blue Official-record badge or amber Simulated badge.

### 5.2 Party badges

Party appears in a compact circular badge containing `D` or `R` plus an accessible label. The badge is never the largest color area on a card.

## 6. Illustration System

### 6.1 Composition

- Use one focal subject or action.
- Keep the focal silhouette recognizable at approximately 90 × 126 pixels.
- Use a foreground, optional supporting object and restrained background.
- Avoid crowds unless plural community representation is the subject.
- Avoid detailed room renderings that become noise at card scale.
- Keep essential visual information away from the outer 8% crop-safe boundary.
- Use perspective consistently within an asset family; mild three-quarter and top-down desk views are preferred.

### 6.2 Line and texture

- Use warm dark-navy ink rather than pure black.
- Use consistent medium-weight contours.
- Use one lighter interior detail weight.
- Limit shadows to one simple shape.
- Apply subtle paper grain after color, not high-frequency photographic noise.
- Do not add distressed texture to faces.

### 6.3 Character treatment

- Use natural proportions with mild simplification.
- Avoid exaggerated heads, mouths, noses, hair or body shapes.
- Show a range of ages, skin tones, body types, mobility aids and professional roles.
- Use neutral or task-focused expressions for routine work.
- Reserve strong emotion for fictional events where the context supports it.
- Do not assign personality traits through clothing or physical features.

### 6.4 Environment treatment

District environments draw from documented:

- Architecture
- Geography
- Transit and street patterns
- Local institutions
- Housing types
- Major industries
- Public spaces
- Tribal nations and civic organizations where relevant

Environmental details provide specificity without becoming a claim about every resident.

## 7. Representation Standard

### 7.1 General rules

- Constituencies are plural and may contain competing documented interests.
- One person never serves as the symbolic representation of an entire racial, ethnic, geographic or economic community.
- Demographic conditions never determine simulated political behavior.
- Economic hardship is contextual information, not a community's visual identity.
- Cultural imagery must be specific, sourced and relevant.
- Missing cultural knowledge is treated as a research need, not permission to improvise.

### 7.2 Black and Latino communities

Depict contemporary civic and everyday life, including residents as professionals, renters, homeowners, organizers, parents, business owners, students and public servants. Avoid imagery that frames poverty, crime, protest or cultural performance as the community's defining condition.

### 7.3 Tribal and frontier communities

Identify specific tribal nations when the content concerns them. Use tribal-government, cultural-office or other reviewed local sources. Do not use generalized Indigenous motifs, pan-tribal visual symbols or ceremonial imagery without documented relevance and review.

### 7.4 Rural and agricultural communities

Show housing, infrastructure, services, work and distance as contemporary systems. Avoid nostalgic or backward-looking visual shorthand.

### 7.5 Review requirement

Every community-facing asset receives a representation review that asks:

- Is the scene specific without claiming universality?
- Does the visual imply a political opinion not supported by the content?
- Is humor directed at a system rather than a person or group?
- Are cultural elements sourced and accurately named?
- Are multiple interests visible across the district's total card set?

## 8. Member-Office Identity and Deferred Photography Policy

### 8.1 Vertical-slice approach

Use portrait-free member-office cards for every curated real lawmaker in the housing vertical slice. Each treatment combines the member's name, state and district, party badge and a neutral office illustration. The Sourcebook retains the cited public record; the simulated relationship layer remains visually independent.

Do not acquire, process or ship lawmaker photographs during the vertical-slice build. This is a deliberate scope decision, not a temporary missing-asset state.

### 8.2 Post-validation portrait decision

Portraits are outside this specification's implementation scope. After the complete vertical slice is validated, recognizability research may test whether portraits materially improve play. Any decision to add them requires a separate approved specification covering file-specific rights, credits, alterations, source retention, accessibility and likeness safeguards. Until that specification exists, the member-office treatment remains the production standard.

## 9. Asset-Production Strategy

### 9.1 Approved model

The vertical slice uses an **AI-assisted prototype with human cleanup and review**.

AI may support:

- Composition studies
- Object and room variations
- Temporary card art
- Background exploration
- Palette and lighting alternatives

AI may not independently finalize:

- Real-lawmakers' likenesses
- Culturally specific community imagery
- Official seals or source marks
- Factual charts or maps
- Legal or policy text
- Any image that has not received human consistency and representation review

### 9.2 Asset allocation

| Asset group | Target |
| --- | ---: |
| Bespoke hero illustrations | 20–25 |
| Modular scene combinations | 30–35 |
| Icon-led procedural/tactic illustrations | 15–20 |
| Member-office illustrated treatments | 10 |
| Family icons | 8 |
| Information-class icons | 3 |
| Core resource icons | 6 |

The totals overlap because member-office treatments and shared icons are not additional playable definitions.

### 9.3 Fun-first interaction spike

Before cleaned pilot illustrations are produced, the 10-minute interaction spike uses simple provisional card treatments and the approved icon kit. Its purpose is to test pickup, hover, snap, transformation, visible pressure and result comprehension—not illustration finish.

The spike must remain understandable at three-card overlap and in grayscale, but no bulk asset decision follows from it. Family colors, provenance badges and timing values are promoted to production constraints only after the interaction gate demonstrates that players can recognize outcomes without opening the inspector.

### 9.4 Eight-card pilot

Before producing the library, finish one representative asset for each playable family:

1. Policy Aide
2. Housing Choice Voucher
3. Rent Burden Report
4. Potential Cosponsor
5. Urgent Renter Concern
6. Committee Hearing
7. Media Attention
8. Bipartisan Working Group

The eight-card pilot must pass the quality gate before bulk production begins.

The pilot review also evaluates ten representative lines of restrained process-based microcopy. Reviewers must confirm that humor is understandable, does not target a lawmaker or community and remains optional to comprehension.

### 9.5 Modular kit

The reusable kit should include:

- Desks and work surfaces
- Folders, reports, envelopes and bill pages
- Pens, phones, laptops, calendars and microphones
- Office seating and hearing-room furniture
- Windows and simple district-background panels
- Neutral body poses and hand gestures
- Reusable crowd groupings with reviewed variation
- Resource symbols and status marks
- Paper shadows, stack edges and stamped labels

The modular kit is a starting grammar, not a substitute for specific cultural or geographic research.

### 9.6 Civic Illustration Kit

The starter package includes a deterministic SVG library at:

```text
art/masters/modular-kit/civic-illustration-kit/
```

The kit contains eight family icons, three provenance icons, six resource icons, six status icons, six institution/desk-zone icons and twelve issue-module illustrations. Its Python builders resolve all paths relative to the kit directory and regenerate a checksum manifest plus a review sheet.

The kit follows three independent taxonomies:

1. **Card family** describes a card's mechanical role.
2. **Provenance** distinguishes Official record, Based on records and Simulated information.
3. **Issue** identifies the policy subject.

Evidence remains a card family and is never treated as a provenance class. Issue colors are secondary navigation cues and may not replace the family band, family icon or family label on a card.

Runtime SVGs contain no visible semantic text, font dependency, external image reference or real-person likeness. Phaser or React renders all labels so localization, text scaling and screen-reader equivalents remain available. The review-only contact sheet may contain labels because it is not shipped as a runtime asset.

The issue set separates Public Safety from Justice and Immigration from Civil Rights. These subjects require distinct symbols and, when they become playable modules, separate research and representation review.

The kit may be used for card-family, provenance, resource, status and desk-zone icons; housing issue-selection and Sourcebook thumbnails; and icon-led procedural or tactic treatments. It does not replace the cleaned 1024 x 768 illustrations required by the eight-card pilot, bespoke hero art, reviewed community scenes or member-office treatments. Non-housing issue assets remain source-kit references and are not copied into the vertical-slice runtime.

Run the following commands before using or changing the kit:

```bash
python art/masters/modular-kit/civic-illustration-kit/build_kit.py
python art/masters/modular-kit/civic-illustration-kit/build_sheet.py
python art/masters/modular-kit/civic-illustration-kit/validate_kit.py
```

The validator requires exactly eight families, three provenance classes and six resources; verifies stable IDs, relative paths, checksums and alt text; and rejects baked-in visible text, font dependencies, scripts, foreign objects and external SVG dependencies.

## 10. Asset Technical Standard

### 10.1 Formats

| Asset | Master | Runtime export |
| --- | --- | --- |
| Card illustration | Layered 1024 × 768, 4:3 | WebP; PNG fallback if transparency requires it |
| Card frame | SVG or component geometry | SVG/Phaser vector or atlas |
| Family and resource icons | SVG | SVG or texture atlas |
| Member-office treatment | SVG or 1024 × 768 source illustration | Optimized SVG or WebP without a real-person likeness |
| Texture | Seamless high-resolution master | Optimized WebP |

### 10.2 Naming

Asset filenames use stable content IDs:

```text
card-policy-housing-choice-voucher.webp
card-evidence-rent-burden-report.webp
card-coalition-member-<bioguide-id>.webp
icon-family-evidence.svg
icon-source-official.svg
```

No filename depends on display order or a temporary title.

### 10.3 Suggested source structure

```text
art/
├── masters/
│   ├── cards/
│   ├── member-offices/
│   ├── modular-kit/
│   │   └── civic-illustration-kit/
│   │       ├── svg/{families,provenance,resources,statuses,institutions,issues}/
│   │       ├── build_kit.py
│   │       ├── build_sheet.py
│   │       ├── validate_kit.py
│   │       ├── manifest.json
│   │       └── kit-sheet.svg
│   └── textures/
├── references/
│   ├── districts/
│   ├── institutions/
│   └── member-offices/
├── manifests/
│   └── art-assets.json
└── exports/
    ├── cards/
    ├── icons/
    └── atlases/
```

Only runtime exports belong under `web/public/assets/`. Editable masters remain separate from the web bundle.

### 10.4 Asset manifest

Each exported asset records:

```ts
interface ArtAssetRecord {
  assetId: string;
  cardDefinitionIds: string[];
  runtimePath: string;
  masterPath: string;
  width: number;
  height: number;
  altText: string;
  credit?: string;
  referenceUrls: string[];
  aiAssisted: boolean;
  containsSemanticText: false;
  humanEditor: string;
  representationReview: 'not-required' | 'pending' | 'approved';
  rightsReview: 'not-required' | 'pending' | 'approved';
  reviewedAt: string;
  checksumSha256: string;
}
```

Published builds reject an asset whose required review status is pending.

## 11. Tactile Motion Language

The motion system makes handling paper satisfying without using casino-like spectacle.

| Interaction | Motion | Target duration |
| --- | --- | ---: |
| Pickup | Rise 4–6 pixels; shadow deepens | 90 ms |
| Valid hover | Any target satisfying an active pattern leans or outlines | 100 ms |
| Valid stack | Magnetic snap and paper tap | 140 ms |
| Invalid stack | Small separation and lateral shake | 160 ms |
| Stack fan | Cards spread while titles remain aligned | 180 ms |
| Recipe start | Universal progress strip appears | 120 ms |
| Transformation | Inputs compress; result slides out | 260 ms |
| Tactic expansion | Handbook rule receives a restrained stamp; newly compatible targets briefly outline | 300 ms |
| Election outlook change | Affected simulated line item pulses once; range redraws without sweeping motion | 180 ms |
| Resource change | One pulse plus reason text | 180 ms |
| Card file/archive | Slide toward physical destination | 220 ms |
| Briefing reveal | One card leaves envelope at a time | 300–450 ms per card |
| Major vote | Tally and stamp sequence | 1.0–1.5 s |
| Final election | Binder ledger resolves line by line; no spinner, hidden roll or confetti burst | 1.0–1.5 s |

### 11.1 Briefing Packs

Briefing Packs appear as congressional envelopes, document wallets or briefing folders. The category is visible before opening; exact contents remain hidden. Cards emerge individually.

### 11.2 Story events

Story Director events arrive through plausible media:

- District message
- Committee notice
- Chief-of-staff memo
- Party whip note
- Local-media brief
- Policy-adviser update

They do not appear as magical or unexplained random-event cards.

### 11.3 Political tests

Committee and chamber decisions use clerk-like tally sheets, stamps, folders and calendars. Avoid wheels, slot reels, confetti storms or other gambling metaphors.

### 11.4 Reduced motion

Reduced-motion mode replaces transforms with:

- Instant position changes
- Outline-state changes
- Short opacity changes
- Text status announcements
- Static progress indicators

No essential result depends on movement.

## 12. Sound Relationship

Although sound is specified separately from illustration, state feedback should align with the paper metaphor:

- Paper tap for accepted stacks
- Soft slide for filing
- Brief dry shake for invalid stacks
- Folder or envelope sound for Briefing Packs
- Pencil/tally sound for vote counting
- Restrained stamp sound for a resolved procedural stage

Do not use coin showers, jackpot sounds or exaggerated failure alarms.

## 13. Accessibility Requirements

- Family identity must remain understandable without color.
- Information class must remain understandable without color.
- Card names and essential values remain legible at minimum supported scale.
- Text is rendered as interface text, not embedded in raster art.
- Every asset has concise functional alt text.
- Decorative details are omitted from screen-reader descriptions unless they convey state.
- Member-office treatments use the member's name and office as alt text; do not describe inferred mood, appearance or political intent.
- Reduced motion preserves all state information.
- At 200% text scaling, the inspector may expand independently while the card illustration remains fixed.

## 14. Quality Gates

### 14.1 Eight-card pilot gate

This gate begins only after the fun-first interaction spike passes. The current family and provenance tokens remain provisional until this review.

The eight representative cards must pass:

- Recognition at gameplay size
- Recognition at 65% scale
- Three-card overlap test
- Grayscale test
- Color-vision simulation test
- Family icon and label test
- Information-class distinction test
- Inspector/source test
- Representation review
- Identity and simulated-layer separation review
- Reduced-motion interaction test

### 14.2 Per-asset review

- Is there one dominant subject or action?
- Can the card be identified before reading detailed text?
- Does the illustration remain clear when cropped inside the card window?
- Is the family label independent of color?
- Is factual or simulated status unmistakable?
- Is any cultural or geographic specificity sourced?
- Does the asset avoid visual claims that are not in the content record?
- Has AI output received human cleanup?
- Are references, credits and rights recorded?
- Does alt text describe function without inference?

### 14.3 Library-wide review

Review the complete set as a contact sheet. Check for:

- Repeated composition
- Overuse of Capitol imagery
- Overrepresentation of any demographic group in negative events
- Underrepresentation of people in authority or expertise roles
- Excessive red/blue party coding
- Cards whose silhouette is too similar
- Inconsistent line weight or texture
- Family colors that drift between assets
- Humor concentrated on particular communities

## 15. Phaser and React Responsibilities

Phaser renders:

- Card body and illustration
- Stack position and fanning
- Drag states
- Drop targets
- Progress strip
- Transformations
- Filing and pack-opening motion

React renders:

- Card Inspector
- Sourcebook
- Full citations and rights credits
- Accessible card controls
- Decision dialogs
- Preferences
- Term Record

Card illustrations must not contain rules that React or Phaser would need to parse.

## 16. Vertical-Slice Art Completion Criteria

Art and card design are complete for the vertical slice when:

1. The fun-first interaction spike passes before cleaned production art begins.
2. The eight-card pilot passes the quality gate.
3. All 77 playable definitions have an approved runtime treatment.
4. All eight family icons and three information-class icons are complete.
5. Each resting card remains readable at normal and minimum zoom.
6. Every card has alt text and manifest metadata.
7. Every culturally specific image passes representation review.
8. Every real-lawmaker card uses an approved portrait-free member-office treatment.
9. No real lawmaker's likeness is generated, altered or shipped in the vertical slice.
10. Simulated relationship states are visually separate from official identity.
11. Pack, stack, invalid-drop, transformation, vote and filing feedback are implemented.
12. Reduced motion communicates every result.
13. The final contact-sheet review identifies no unresolved family, representation, identity or consistency issue.

## 17. Reference Mockups

- `art-direction-comparison.svg`
- `card-anatomy-proposal.svg`
- `card-family-color-system.svg`

These mockups establish direction and hierarchy. They are not final production assets.
