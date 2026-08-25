# Paper Majority: Approved Design Specification

**Date:** August 23, 2026  
**Status:** Approved for implementation  
**Initial platform:** Desktop-first web  
**Game engine:** Phaser 4 with TypeScript  
**Development assistant:** Claude Code with Phaser Game Agent MCP  
**Product name:** **Paper Majority**  
**Subtitle:** *A Congressional Strategy Game*  
**Marketing tagline:** *Build the bill. Hold the coalition. Face the vote.*
**Revision:** August 24, 2026 — Added the fun-first interaction gate, staged content scope, visible-pressure rules, office-card treatment for real lawmakers and measurable playtest thresholds. Revised the recipe system from exact-ID lookup to deterministic card-pattern matching, added Tactic rule expansions, per-run and lifetime discovery state, a Staff Handbook and recipe-density validation. Added the Teased → Discovered → Expanded onboarding story and a transparent simulated election with a Week 1 opponent reveal, narrowing outlook and no hidden final roll.

## 1. Purpose

This document defines a card-based strategy game about the United States Congress. The game draws its tactile interaction model from Stacklands and its event pacing from RimWorld, while remaining an original civic game with its own player fantasy, economy, progression and data-integrity rules.

The player is a fictional freshman member of the House of Representatives serving a real congressional district. During one compressed two-year term, the player constructs a bill around a real public issue, manages a congressional office, builds a coalition, navigates legislative procedure, responds to district concerns and faces reelection.

The primary design objective is not factual recall. It is to create policy curiosity through consequential trade-offs. Players should become interested in a real issue because they experienced how provisions, constituencies, institutions and political compromises interact.

## 2. Product Definition

### 2.1 Genre

- Pausable real-time card strategy game
- Legislative management simulation
- Political story generator
- Civic learning game for a general adult audience

The housing vertical slice is presented as a **narrative strategy simulation**, not as a roguelike or an infinitely replayable sandbox. Seeded variation supports repeated runs, but additional issues and districts are the long-term source of breadth.

### 2.2 Player promise

> Can you pass a version of your signature bill that you still believe in before political time and public trust run out?

### 2.3 Intended audience

The initial game is designed for civic-curious adults who enjoy accessible strategy games but may have limited prior knowledge of Congress. The interface must make congressional cause and effect understandable without requiring a civics textbook or familiarity with legislative terminology.

### 2.4 Tone

The tone is grounded and lightly humorous. The game may make restrained observations about scheduling, procedural complexity and competing demands, but Congress, public service and constituent concerns are not treated as jokes. Humor should humanize the institution without reducing politics to cynicism.

## 3. Design Pillars

### 3.1 One gesture, many congressional verbs

Dragging and stacking cards powers research, drafting, staffing, persuasion, negotiation, constituent response and procedural action. Separate interfaces are used only when accessibility, reading density or a consequential decision makes them necessary.

### 3.2 Policy is constructed, not selected

The player begins with a real issue rather than a finished bill. Policy provision cards are based on real legislative precedents. Combining provisions creates a fictional bill whose political and community consequences emerge from its contents.

### 3.3 Growth creates obligations

More staff, allies, visibility and issue commitments create additional actions, but also increase workload, relationship maintenance, scrutiny and district expectations. The player can become overextended through their own ambition.

### 3.4 Compromise has more than one cost

An amendment may increase votes while reducing policy integrity, district trust or support from another constituency. There is rarely one objectively correct bill. The central question is which version can survive Congress and whether the player can still defend it.

### 3.5 Failure continues the story

Most setbacks create alternate paths rather than immediate game-over states. A committee defeat may produce a revision opportunity. A lost ally may force a different coalition. A bill may fail while some provisions survive in another package.

### 3.6 Facts and simulation never blur

Official records, derived context and simulated events are visually and structurally distinct. The game does not present simulated motives, negotiations, support or outcomes as factual claims about real people.

## 4. Scope and Non-Goals

### 4.1 Initial vertical slice

The first playable slice includes:

- One issue module: housing affordability
- Six contrasting real congressional districts
- One fictional freshman representative per run
- Democratic or Republican affiliation and two player-selected governing values
- Three staff roles
- Approximately 60–80 cards
- Approximately 20 Legislative Tactics
- Approximately 25–30 Story Director events
- One House committee path
- One complete House vote
- A simplified Senate and enactment resolution
- One reelection resolution
- A complete Term Record
- A 45–60 minute term

The complete slice remains the destination, but production is staged so content scale cannot conceal a weak central interaction:

| Gate | Scope | Decision |
| --- | --- | --- |
| Fun-first interaction spike | Eight distinct card definitions, 12–16 instances, three transformation patterns and one visible pressure cycle | Does pattern matching produce at least four to six understandable valid stacks without Sourcebook reading? |
| Six-week playable core | Exactly 30 playable definitions and 12 Story Director events | Do repeated weekly choices create understandable pressure and consequences? |
| Complete vertical slice | Up to 77 playable definitions and 30 Story Director events | Does the 24-week term sustain interest and produce memorable stories? |

Only the housing-affordability issue is implemented or exposed at runtime before the complete vertical slice is approved. Future-issue icons may remain in the source art kit as non-runtime reference assets; they do not authorize content, rules or navigation for those modules.

The six districts are selected and frozen as part of the validated scenario snapshot rather than hard-coded into game rules. The set must include an urban majority-Black district, a Latino community with substantial housing pressure, a rural agricultural district, a post-industrial mixed district, a fast-growing suburban district and a geographically large district with meaningful tribal or frontier communities. The set should balance party control while avoiding the implication that demographic identity determines policy behavior.

For the housing vertical slice, the player selects two governing values from Fiscal Stewardship, Local Control, Market Competition, Public Investment, Tenant Stability, Housing Supply, Environmental Resilience and Fair Access.

### 4.2 Explicit non-goals for the vertical slice

- Multi-term career progression
- Full simulation of all 535 congressional offices
- Real-time dependence on government APIs
- Campaign fundraising and donor simulation
- Lobbying disclosure or individual contribution mechanics
- Multiplayer or competitive elections
- Mobile-first layout
- User-authored policy text
- Unreviewed generative policy content
- Prediction of actual member votes
- Real-money card packs or retention systems

## 5. Run Structure

### 5.1 Term format

One run represents a compressed two-year congressional term divided into 24 Legislative Weeks.

- Weeks 1–5: establish the office and define the bill
- Weeks 6–11: gather evidence and secure committee attention
- Weeks 12–17: negotiate provisions and assemble a House coalition
- Weeks 18–21: navigate Senate consideration and resolve differences
- Weeks 22–24: pursue enactment and face reelection

On standard pace, each week contains approximately 90–120 seconds of active real time. Relaxed pace may extend that window to 150 seconds. Planning pauses are unlimited, consequential decisions automatically pause the clock, and the game saves after every weekly resolution. The 45–60 minute term target applies to standard pace.

### 5.2 Core loop

**Draw → assign → stack → negotiate → advance → survive**

1. **Draw:** Open a Weekly Briefing Pack containing district concerns, evidence opportunities, relationships and political developments.
2. **Assign:** Place staff cards on research, outreach, drafting or coalition work.
3. **Stack:** Combine evidence, provisions, staff expertise and relationships into stronger legislative assets.
4. **Negotiate:** Respond to conditional support, amendment requests and competing interests.
5. **Advance:** Move the bill through temporary procedural zones.
6. **Survive:** Resolve workload, district attention, coalition upkeep, deadlines and a Story Director event.

The next week begins with a changed board, incomplete work and a new Briefing Pack.

### 5.3 Outcomes

A complete victory requires:

- Enactment of the signature bill
- Sufficient District Trust
- Reelection

The game also recognizes meaningful partial outcomes:

- Bill enacted, reelection lost
- Reelection won, signature bill failed
- Bill passed one chamber
- Provisions absorbed into another package
- Bill enacted after a compromise that conflicts with governing values
- Narrow defeat that creates a future policy legacy

Every ending produces a Term Record rather than a generic failure screen.

## 6. Open Desk Tableau

### 6.1 Defining interaction rule

> If an action cannot be communicated through moving, stacking, separating or transforming cards, it probably does not belong in the initial game.

### 6.2 Board layout

Approximately 80 percent of the game view is a freeform congressional desk. Permanent anchors occupy the edges:

| Element | Purpose |
| --- | --- |
| Open Desk | Freeform research, drafting, staffing and coalition stacks |
| Briefing Tray | Stores unopened weekly packs |
| District Inbox | Receives constituent and local-development cards |
| Bill Docket | Holds the current signature-bill version |
| File Cabinet | Preserves useful cards without consuming desk capacity |
| Archive | Removes expired or unwanted cards |
| Term Clock | Shows the legislative week and major deadlines |
| Sourcebook | Holds definitions, civic explanations and citations |
| Staff Handbook | Records discovered card patterns and gives partial hints for undiscovered patterns |

Committee, House and Senate zones are temporary destination areas that appear when the bill reaches the relevant stage. They do not convert the entire game into a fixed procedural pipeline.

### 6.3 Card interaction

Valid combinations snap together and either transform immediately or begin a timed action. A universal progress indicator appears above any active stack. Invalid combinations separate with a short visual and audio cue; they do not open an error dialog.

Players may pause at any time and continue moving, separating, filing and inspecting cards while the simulation clock is stopped.

The basic result of a valid combination must be understandable from the card transformation, animation, sound and one short result phrase. The inspector explains why the result occurred; it is not required to recognize that it occurred.

### 6.4 Camera and organization

- Pan and zoom across the desk
- Select a stack and fan its contents
- Collapse a resolved stack into a summary card
- Pin the signature bill and urgent district concern
- Send cards to limited filing space
- Use keyboard-accessible move and combine actions

The board should become politically crowded without becoming physically unusable.

## 7. Card System

### 7.1 Card families

| Family | Examples | Function |
| --- | --- | --- |
| Staff | Policy aide, legislative counsel, district director | Perform timed work |
| Policy | Tax credit, grant, eligibility rule, enforcement mechanism | Construct the bill |
| Evidence | Fiscal estimate, testimony, district statistic, study | Strengthen or challenge provisions |
| Coalition | Potential cosponsor, committee ally, caucus, leadership | Build legislative support |
| Constituency | Renters, veterans, manufacturers, hospitals | Express documented community interests |
| Institution | Committee, caucus, chamber calendar | Control procedural access |
| Political | Endorsement, controversy, media attention, capital | Change momentum and risk |
| Event | Scheduling shift, local closure, leadership request | Apply Story Director pressure |
| Tactic | Pilot program, offset, manager's amendment | Unlock reusable combinations |

### 7.2 Card face

At rest, each card shows only:

- Illustration or identifying symbol
- Card name
- Family marker
- One high-frequency value
- Official, derived or simulated classification

Hover, tap or keyboard inspection reveals:

- Mechanical effect
- Compatibility hints
- Workload or cost
- Source and date
- Relevant district or congressional context
- Information classification

### 7.3 Pattern-based transformations

Card combinations are authored as deterministic patterns rather than lists of exact card IDs. A pattern contains two to four order-independent slots. Each slot may require a card family, required tags, one-of-several accepted tags, an allowed information class and a quantity.

Examples:

- Policy-focused Staff + housing Evidence → Evidence Summary
- District-focused Staff + Constituency concern → District Priority
- Legislative Counsel + housing Evidence + Policy Provision → Drafted Provision
- Drafted Provision + Bill Docket → Revised Bill
- Working Bill + Coalition office → Outreach Assignment
- Working Bill + committee-relevant Coalition office + Evidence → Hearing Request
- Negotiation Staff + conflicting Policy cards → Compromise Proposal
- Coalition stack + whip Tactic → Vote Count

One authored pattern can therefore accept several concrete card combinations. A Policy Aide might summarize a Census report, a tenant survey or committee testimony when the tags satisfy the same pattern. The card selected still matters: evidence strength, constituency relevance, source class, workload and resource effects may change the derived result.

The complete housing slice targets approximately **35–40 authored patterns** that yield at least **200 valid concrete stacks** across the 77-card catalog. These are validation targets, not a reason to create shallow duplicates. Content review must count distinct outcomes and decision consequences as well as theoretical matches.

Pattern matching remains a pure deterministic function. When a stack satisfies multiple patterns, the engine ranks candidates by:

1. Number of required family, required-tag and one-of-tag constraints satisfied; adding alternatives to one one-of list does not increase specificity
2. Number of information-class constraints satisfied
3. Authored priority
4. Stable pattern ID as a runtime-only final tie-break

The content validator must reject two patterns that can accept the same stack with equal specificity and priority. Stable ID ordering prevents nondeterminism but is not permission to publish an ambiguous catalog.

Tags come from a controlled housing taxonomy. Near-duplicates such as `renter`, `tenant` and `renter-focused` cannot be introduced without an explicit taxonomy change and migration.

Relational tags such as `same-party` and `opposing-party` are calculated by a pure selector from the player's party and the office's official party field. They are not stored as claims in factual card content and remain deterministic for the same term state.

Pattern outputs are declarative:

- **Fixed output:** produces a named card definition.
- **Derived output:** calls a versioned engine resolver such as `summarize-evidence` or `strengthen-provision` with JSON parameters.

Scenario JSON never contains executable functions. This preserves serialization, validation, save compatibility and deterministic replays.

### 7.4 Legislative Tactics as rule expansions

Legislative Tactics modify reusable rules rather than serving as one-use keys for one exact recipe. Playing a Tactic deliberately activates a declared slot expansion for the rest of the run and records the change in authoritative state.

For example, **Bipartisan Working Group** may expand the Coalition + Policy pattern so an opposing-party Member Office can participate when both cards share a district-interest tag. The visual result should make the newly legal relationship understandable: the relevant Handbook pattern updates, newly compatible cards receive the normal valid-hover cue and the event log records the rule change.

Tactics enter play through Briefing Packs, staff expertise, mentorship, experimentation and procedural milestones. The complete slice targets approximately 20 Tactics, with about ten directly widening existing patterns and the remainder changing cost, duration, output strength or procedural eligibility. Every expansion is declarative, bounded and validated; a Tactic cannot run arbitrary code.

### 7.5 Discovery and the Staff Handbook

The active term stores:

- Discovered pattern IDs
- Activated Tactic expansion IDs grouped by pattern

A pattern becomes discovered when the engine accepts a stack for the first time. Discovery is part of deterministic `TermState`, save files and replay logs. It resets when a new term begins.

A separate player profile may store lifetime discoveries and completion statistics. Lifetime data does not alter an active run's matching rules, seed or outcomes.

The React-rendered Staff Handbook provides the discovery interface. Each entry has one of three player-facing states derived from existing pattern and expansion state; no second recipe or unlock system is added:

- **Teased:** the pattern is undiscovered and appears as silhouettes with one authored directional hint, such as “Housing Evidence works with a policy-focused Staff card.” Exact inputs and outputs remain hidden.
- **Discovered:** the player has completed the pattern at least once. The entry shows its general family/tag slots, output and previously successful examples.
- **Expanded:** one or more activated Tactics have widened or modified the discovered rule. The entry retains the base rule and visibly annotates the exact change.

The number of undiscovered patterns is visible. Accessibility settings may reveal stronger hints without changing the underlying rules. The hint, valid-hover logic and actual engine constraints must always describe the same rule.

Studying a Tactic is a physical desk assignment: the player stacks an appropriate Staff card with the Tactic, spends the declared Staff Attention and waits for the short assignment to complete. Completion activates the existing declarative `TacticExpansionDefinition`, updates the Handbook and consumes or files the Tactic as authored. This interaction dispatches the normal assignment and Tactic commands; it is not a fourth pattern type, a `requiresUnlock` recipe or an executable rule embedded in content.

Invalid stacking remains free: the cards separate with the approved 160-millisecond feedback, no resources are spent and no simulation time is charged. This makes experimentation safe without making every pairing valid.

## 8. Resources and Political Pressure

| Resource | Role |
| --- | --- |
| Staff Attention | Limits simultaneous office work |
| Political Capital | Flexible currency for favors, briefings and procedural opportunities |
| District Trust | Measures perceived representation |
| Bill Momentum | Tracks progress against legislative deadlines |
| Policy Integrity | Tracks alignment with selected governing values |
| Staff Morale | Affects performance and retention |

District Trust and Policy Integrity cannot be purchased directly.

### 8.1 Growth trap

Additional staff and allies provide more actions, but generate recurring obligations. A broad coalition creates more amendment requests. Greater visibility increases scrutiny. More issue commitments create more correspondence. Staff overload can reduce morale or cause resignation.

### 8.2 Desk capacity

The desk has a visible card limit. At each weekly resolution, excess unfiled cards create an Overextended Office penalty. The player must use, delegate, summarize, file or archive information.

### 8.3 Weekly resolution

At the end of each week:

1. Assignments complete or carry forward.
2. Time-sensitive cards expire.
3. Staff workload and morale resolve.
4. Unanswered district concerns affect trust.
5. Neglected relationships may weaken.
6. Desk capacity is enforced.
7. The Story Director selects the next development.
8. The new Weekly Briefing Pack arrives.

### 8.4 Physical pressure language

Political pressure appears as board state before it appears as a number:

- District mail accumulates in the visible inbox.
- Time-sensitive cards gain restrained deadline stamps or edge wear.
- Overloaded staff cards remain visibly attached to unfinished assignments.
- Conditional coalition offices attach amendment-request slips to the bill.
- Missed procedural opportunities transform into revision, delay or expiration cards.
- Desk crowding, the Term Clock and urgent pins show what the player is about to lose.

HUD meters confirm and quantify these consequences, but they must not be the player's only warning. A setback should be attributable to a visible obligation or decision rather than an unexplained numerical loss.

## 9. Briefing Packs

The pack category is visible, but exact contents are not.

- Weekly Briefing Pack
- District Mail
- Policy Research
- Committee Intelligence
- Coalition Outreach
- Media Brief

Specialized packs consume Staff Attention or Political Capital. The player is allocating office capacity, not purchasing facts. Packs reveal cards sequentially to create anticipation.

No real-money packs, purchasable randomness or daily-login mechanics are permitted.

## 10. Negotiation and Political Tests

### 10.1 Support states

- Interested
- Conditional
- Committed

Before a vote, the player sees a forecast such as 211 committed, 12 conditional and 18 undecided. Preparation determines most outcomes; seeded uncertainty creates tension without invalidating strategy.

### 10.2 Political Tests

- Committee hearing
- Markup
- Hostile amendment
- Leadership negotiation
- Media controversy
- House vote
- Senate resolution
- Reelection

Major tests automatically pause for player decisions. Setbacks produce new state and possible recovery paths.

### 10.3 Transparent simulated election

The election is a strategic consequence ledger, not a surprise dice roll.

- At initial setup, the existing seeded random stream selects a **Weak**, **Moderate** or **Strong** opponent with weights of 25, 50 and 25 percent. The result is revealed in Week 1 and never rerolled.
- The Office Election Outlook appears after the reveal. It is explicitly labeled **Simulated outlook — not polling** and shows a range rather than false precision.
- The outlook range narrows as the term progresses: plus or minus 8 points in Weeks 1–8, 5 points in Weeks 9–16 and 3 points in Weeks 17–24.
- The final result contains no new random draw. It uses the same public calculation that powered the outlook and reports a one-decimal simulated vote share.
- Every contribution is shown when it changes and again in the Term Record under **What was simulated**.
- Race, ethnicity, income, geography and other demographic fields never enter the election calculation.

The provisional center score is:

| Line item | Contribution |
| --- | ---: |
| Starting baseline | `50` |
| Revealed opponent | Weak `+3`; Moderate `0`; Strong `-4` |
| District Trust | `clamp((District Trust - 50) × 0.30, -12, +12)` |
| Bill outcome | Enacted `+4`; absorbed into package `+1`; failed in committee `-3`; failed in House `-4`; failed in Senate `-3` |
| Governing consistency | `clamp((Policy Integrity - 50) × 0.04, -2, +2)` |
| Explicit election effects from authored choices | Sum of visible effects, capped from `-6` to `+6` |

Each contribution is rounded to one decimal before the running total is calculated, so the visible rows always add to the displayed result. The final score is clamped from 0 to 100; 50 or higher wins reelection. An outlook is **Favored** when its entire range is at least 50, **Trailing** when its entire range is below 50 and **Toss-up** otherwise.

These coefficients are provisional balance inputs, not claims about real voters. Staff Morale, coalition size and unresolved concerns do not receive separate final-election bonuses or penalties because they already affect District Trust, bill progress or explicit authored consequences during play. This avoids counting one decision twice. The 1,000-seed balance review may revise coefficients, but any approved formula remains versioned, deterministic and visible to the player.

## 11. Congressional Story Director

The director remains invisible during play. Events arrive through believable sources such as the Chief of Staff, District Director, committee clerk, party whip, local reporter or policy adviser.

### 11.1 State observed

- Bill Momentum
- Coalition size and breadth
- District Trust
- Staff workload and morale
- Political Capital
- Media attention
- Time remaining
- Recent opportunities and setbacks

### 11.2 Event rhythm

**Preparation → opportunity → pressure → decision → consequence → recovery → escalation**

Event classes:

- Opportunity
- Pressure
- Consequence
- Recovery

The director must avoid repeating the same pressure category too frequently and must provide recovery space after sustained setbacks.

### 11.3 Term styles

- **Regular Order:** steadily rising pressure and predictable recovery
- **District Pulse:** more local issues and constituent relationships
- **Breaking Cycle:** more volatile news and political developments

Term style changes pacing and event selection. Difficulty remains a separate setting.

### 11.4 Explainability

Every directed event includes an optional Why This Surfaced explanation. It cites the in-game conditions that made the event eligible without revealing random-number calculations.

## 12. Onboarding and Progression

The tutorial is a short story about learning that the desk contains reusable rules.

**Week 1 — A rule is teased and then discovered.** The Office Election Outlook reveals the seeded opponent and clearly labels itself as simulated, not polling. The first Briefing Pack produces a Rent Burden Report, an Urgent Renter Concern, a Housing Choice Voucher idea and a Committee Calendar Notice. The Handbook begins with a Teased silhouette: “Housing Evidence works with a policy-focused Staff card.” The player stacks Policy Aide with Rent Burden Report, receives an Evidence Summary and watches the same entry become Discovered.

**Week 2 — The player proves the rule is reusable.** A Tenant Survey arrives. Policy Aide + Tenant Survey satisfies the same pattern, but its derived result emphasizes district relevance while the official report emphasized committee credibility. The player learns to reason about families and tags rather than memorize card names.

**Week 3 — The game advertises a future possibility.** District Director + Local Housing Organization, a Constituency card, produces District Priority: Rental Stability. A separate Coalition entry remains Teased and says that a Tactic can expand it. It does not reveal an exact card or introduce a locked second recipe system.

**Week 8 — The visible rule changes.** Bipartisan Working Group arrives. The player stacks it with appropriate Staff to begin Study Tactic. When the assignment completes, the existing coalition pattern becomes Expanded and its note says that an opposing-party Member Office is now eligible when its policy-interest tags overlap the bill. Retrying the previously rejected stack succeeds.

The ten-minute interaction spike condenses this same Teased → Discovered → Expanded arc into one session so the pattern architecture can be validated before the six-week and 24-week content is built.

The opening objectives are:

1. Open the Weekly Briefing Pack and view the revealed opponent.
2. Open the Staff Handbook and read one Teased hint.
3. Assign the Policy Aide to a housing report.
4. Complete the first pattern and see it become Discovered.
5. Reuse that pattern with different housing Evidence.
6. Combine the resulting evidence with a provision.
7. Add the provision to the bill.
8. Respond to a constituent concern.
9. File or archive an unused card and complete the week.
10. Later, study a Tactic and see one discovered rule become Expanded.
11. Use the expanded coalition rule.
12. Request a committee hearing.

Three progression tracks reinforce one another:

| Track | Unlocks | Advances through |
| --- | --- | --- |
| Office Development | Staff specialization, capacity, assignments | Workload and district objectives |
| Legislative Tactics | New combinations and negotiation strategies | Experimentation and mentorship |
| Term Objectives | Packs, procedures and advanced events | Hearings, coalition growth and votes |

Long-term unlocks add options rather than permanent numerical superiority.

## 13. Difficulty and Accessibility

Run-start settings:

- Week length: relaxed, standard or brisk
- Process guidance: guided, standard or expert
- Term style: Regular Order, District Pulse or Breaking Cycle
- Vote information: broad hints or detailed counts
- Policy complexity: essential or advanced

Accessibility requirements:

- Unlimited pause
- Card movement while paused
- Keyboard equivalents for every drag action
- Mouse, touch and controller support
- Adjustable text
- Color paired with icons and labels
- Reduced-motion mode
- Screen-reader descriptions
- Sourcebook accessible outside the canvas
- Optional Spanish interface and translated summaries that preserve original source links

## 14. Real Data and Civic Integrity

### 14.1 Data flow

Official federal sources feed a normalized civic-data layer. Editors transform reviewed records into card content. The game publishes a dated Congressional Snapshot. A run remains pinned to that snapshot until completion.

### 14.2 Primary sources

- [Congress.gov API](https://api.congress.gov/): bills, actions, amendments, sponsors, cosponsors, committees, subjects, text and CRS summaries
- [House Clerk votes](https://clerk.house.gov/Votes): official House roll calls
- [Senate roll-call votes](https://www.senate.gov/legislative/votes_new.htm): official Senate votes
- [GovInfo API](https://api.govinfo.gov/docs/): Congressional Record and official documents
- [Census ACS five-year data](https://www.census.gov/data/developers/data-sets/acs-5year.html): district-level social, economic, housing and demographic context
- [OpenFEC API](https://api.open.fec.gov/developers/): reserved for a later campaign module

### 14.3 Information classes

| Classification | Meaning | Example |
| --- | --- | --- |
| Official record | Directly supported by an authoritative source | Committee referral |
| Based on records | Calculated or summarized from cited data | Housing pressure relative to a benchmark |
| Simulated | Exists only inside the player's run | Requested compromise |

### 14.4 Real lawmakers

Real lawmakers appear through curated **member-office Coalition cards**. The resting face uses the office name, state and district, party badge and a neutral Illustrated Civic Desk office motif rather than a photograph. Their public-record inspector section may include committee assignments, sponsorships and votes. Their simulated-term section contains relationship, interest, requested provision and support status.

The housing vertical slice does not use lawmaker photographs. This removes likeness and image-rights work from the fun-validation path while retaining factual identity and public-record context. Authorized photographs may be evaluated only after the vertical slice has passed its release gate.

The fictional freshman occupies the selected district's House seat only within the simulation; the game does not add a 436th voting member. The actual officeholder remains available in the Sourcebook as public-record context but does not act as a second representative for that district during the run.

The interface must say that a member may support a provision in this simulation. It must never assert that the real member supports the fictional bill.

### 14.5 Policy provisions

Each provision is prepared and reviewed before release. It contains:

- Plain-language description
- Mechanical combinations
- Simulated budget and political effects
- Governing-value tags
- Committee jurisdiction
- Legislative precedents
- Official links
- Editorial review date

Unreviewed model output cannot enter a published scenario.

### 14.6 Representation guardrails

- Demographics do not determine political behavior.
- Constituency cards represent multiple interests within a district.
- Community concerns rely on documented conditions rather than stereotypes.
- Aggregate estimates retain source year and appropriate uncertainty notes.
- Missing information is shown as unavailable rather than inferred.

## 15. Technical Architecture

### 15.1 Baseline stack

- Next.js web application shell
- React for menus, settings, Sourcebook and accessibility surfaces
- TypeScript throughout
- Phaser 4 for the interactive game canvas
- Pure TypeScript domain engine for rules
- Versioned JSON scenario snapshots
- Local browser saves for the vertical slice
- Seeded pseudorandom generation

The exact stable package versions are pinned when implementation begins.

### 15.2 Phaser scenes

| Scene | Responsibility |
| --- | --- |
| Boot | Configuration and minimum assets |
| Preload | Card art, audio and scenario bundle |
| Desk | Card-table play |
| Decision | Negotiations, amendments and event choices |
| Vote | Committee and chamber resolution |
| Term Record | Final legislative and election narrative |

### 15.3 Domain engine

The rules engine owns:

- Card definitions
- Pattern matching, stack validation and specificity ranking
- Tactic slot expansions and transformations
- Pattern discovery and Staff Handbook state
- Timed assignments
- Resources
- Weekly resolution
- Coalition state
- Story Director
- Vote calculation
- Endings

Phaser and React send commands to the engine. The engine validates each command, updates authoritative state and emits result events. Presentation layers animate or display only confirmed results.

Representative commands:

- STACK_CARD
- SEPARATE_STACK
- START_ASSIGNMENT
- ACCEPT_AMENDMENT
- FILE_CARD
- ADVANCE_WEEK
- RESOLVE_VOTE

Representative events:

- STACK_ACCEPTED
- STACK_REJECTED
- ACTION_STARTED
- CARD_TRANSFORMED
- RESOURCE_CHANGED
- EVENT_TRIGGERED
- WEEK_RESOLVED
- VOTE_RESOLVED

### 15.4 Save model

Each save includes:

- Schema version
- Congressional Snapshot identifier
- Random seed
- Current week and clock
- Player profile, party and values
- Office and staff state
- Resources
- Signature bill and provisions
- Cards and stack positions
- Coalition and relationship state
- Discovered pattern IDs and activated Tactic expansions
- Revealed election opponent, visible election-effect ledger and current outlook
- Story Director history
- Event log

Autosave occurs after every weekly resolution. Manual save is available while paused.

## 16. Phaser MCP Development Workflow

The project will use Claude Code with Phaser Game Agent MCP for development acceleration.

Official setup begins with:

    npx @phaserjs/game-agent

The developer signs in, completes MCP configuration and restarts Claude Code before verifying the Phaser account connection. Node.js 20 or later and Phaser credits are required for the hosted Game Agent.

Use the MCP for bounded development tasks:

- Prototype card dragging and snapping
- Scaffold Phaser scenes
- Test pack-opening interactions
- Generate temporary art and audio
- Produce previews and screenshots
- Explore animation and input alternatives

Do not make MCP services a runtime dependency. Accepted source, assets and configuration belong in the repository. Generated output receives the same review and testing as human-authored work.

Phaser Editor MCP is optional. It is useful only if the team adopts Phaser Editor for scene and prefab authoring.

## 17. Error Handling and Recovery

- Invalid commands do not mutate state.
- Invalid stacks separate with concise feedback.
- A failed save preserves the previous valid save.
- A corrupted save can recover from the prior weekly checkpoint.
- Missing assets use a labeled fallback card.
- Missing factual fields display unavailable.
- API outages do not affect published snapshots or active runs.
- A snapshot update never mutates an active term.
- Unsupported save versions fail with a clear recovery path.
- Story Director event selection falls back to a safe recovery event if no eligible normal event exists.

## 18. Testing and Validation

### 18.1 Automated tests

| Layer | Coverage |
| --- | --- |
| Unit | Pattern slots, specificity ranking, Tactic expansions, derived resolvers, resources, support states, deadlines, election ledger and values |
| Determinism | Identical seed and commands produce identical outcomes |
| Pattern validation | No ambiguous matches, unknown tags, invalid resolver IDs or expansion targets |
| Recipe density | Concrete valid-stack count, distinct outcomes and family coverage at each content gate |
| Story Director | Pacing, recovery, repetition and eligibility |
| Content | Citation, classification, dates and required fields |
| Interaction | Drag, stack, separate, pause and zones |
| Persistence | Save, reload, prior-week recovery and version checks |
| Accessibility | Keyboard equivalence and readable card details |
| Balance simulation | Win rates, stalls, dominant strategies and event repetition |
| Election transparency | Same seed produces the same revealed opponent and final ledger; no final random draw, demographic input or double-counted pressure |

### 18.2 Playtest questions

- Can a first-time player describe the loop without external explanation?
- Does the player understand why the bill changed?
- Does a setback feel consequential but recoverable?
- Does the desk become tense without becoming unreadable?
- Can the player identify committee, House, Senate and reelection stages?
- Does the player voluntarily inspect at least one source?
- Does the player remember a story rather than only a score?
- Are district interests presented as plural and credible?
- Can the player understand a successful transformation without opening the inspector?
- Can the player predict another valid stack from family and tag logic rather than memorizing exact card names?
- Does activating a Tactic make the rule expansion visible and understandable?
- Can the player explain the difference between a Teased, Discovered and Expanded Handbook entry?
- Can the player name the visible election factors and understand that the outlook is simulated rather than polling?
- Can the player point to the visible obligation that caused a setback?
- Does the player choose to begin another short run after the interaction spike?

### 18.3 Provisional validation targets

- The eight-definition interaction spike supports at least four and no more than six intended valid concrete stacks across its 12–16 instances, including one chained transformation and one Tactic expansion.
- At least 80 percent of first-time interaction-spike testers correctly predict three valid combinations after one demonstration.
- At least 70 percent discover two valid patterns without opening the Staff Handbook; at least 80 percent can explain what the pilot Tactic changed.
- At least 90 percent correctly identify card family and information class after onboarding without opening the inspector.
- At least 70 percent voluntarily begin another interaction-spike run.
- Pickup or hover feedback begins within 100 milliseconds, and a completed transformation communicates its result within one second.
- At least 75 percent of first-time testers complete the opening five objectives without outside help.
- At least 70 percent complete one full vertical-slice term.
- At least 60 percent inspect one or more real policy sources.
- Median perceived-fairness rating reaches 4 of 5.
- At least 80 percent of full-term testers can identify the revealed opponent, name two election line items and correctly state that no hidden roll occurs at the end.
- No tested seed produces an unrecoverable stalled state before the final phase.
- Every published factual or derived card passes automated provenance validation.

These targets are hypotheses for playtesting, not claims about expected player behavior.

## 19. Vertical-Slice Completion Criteria

The vertical slice is complete when:

1. A player can select one of six districts, a party and two values.
2. A player can construct a housing bill through card combinations.
3. Staff assignments resolve through pausable real time.
4. The weekly loop operates for 24 compressed weeks.
5. District Trust, Bill Momentum, Policy Integrity and Staff Morale affect decisions.
6. The Story Director produces a paced sequence of opportunities, pressure, consequences and recovery.
7. The bill can reach committee, the House floor and simplified final resolution.
8. The player reaches a reelection outcome calculated without a hidden final roll.
9. The Term Record explains major decisions, shows the complete election ledger and distinguishes fact from simulation.
10. Every factual card includes a valid citation and date.
11. Every drag interaction has a keyboard-accessible equivalent.
12. Saves reload deterministically.
13. A complete term fits the 45–60 minute target in playtesting.
14. The fun-first interaction spike passed before production of the six-week catalog.
15. Every real-lawmaker card uses the approved member-office treatment without a portrait.
16. The published catalog contains approximately 35–40 validated patterns, no ambiguous matches and at least 200 concrete valid stacks with meaningful outcome variation.
17. Pattern discovery, Tactic expansions, save/reload and lifetime discovery separation behave as specified.
18. The Week 1 opponent, current election outlook and final line-item result are deterministic, visible and labeled simulated.

## 20. Post-Validation Expansion

Only after the vertical slice is validated:

- Add healthcare access and infrastructure issue modules.
- Expand Senate procedure.
- Add historical legislation scenarios.
- Add additional district and staff backgrounds.
- Consider account synchronization.
- Consider a multi-term career mode.
- Consider classroom objectives and educator reporting.
- Evaluate authorized lawmaker photographs only if recognizability testing demonstrates a benefit that justifies the rights-management cost.
- Package the web game for desktop distribution if commercial validation supports it.

## 21. Reference Influences

- [Stacklands](https://store.steampowered.com/app/1948280/Stacklands/): single-gesture card interaction, randomized packs, recurring survival checks and an expandable tabletop
- [How Stacklands uses simplicity to create a compelling card-based village builder](https://www.gamedeveloper.com/business/how-stacklands-uses-simplicity-to-create-a-compelling-card-based-village-builder): unified mechanics and randomized progression
- [Stacklands and the UX of Cards](https://jboger.substack.com/p/stacklands): physical metaphors, sparse card faces and reusable feedback
- [RimWorld](https://rimworldgame.com/): event direction and story-generating pacing
- [Phaser input documentation](https://docs.phaser.io/phaser/concepts/input): browser input, dragging and interaction
- [Phaser Game Agent MCP](https://phaser.io/agent/mcp): Claude Code development integration

This design borrows principles rather than content, names, art, progression or exact rules from its reference games.
