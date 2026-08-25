# Game Mechanics & Core Loop Template

*A reusable framework for breaking down (or designing) the mechanics and core loop of any game idea — political sims, historical strategy games, music games, city builders, anything.*

How to use this: copy the section headers below into a new doc for each game idea. Each section has a prompt (what to figure out) and a fill-in-the-blank format. Sections 1–11 mirror how you'd reverse-engineer an existing game (like we just did with Stacklands); Section 12 is a design-quality checklist you run at the end. Two worked examples — a political sim and a historical strategy game — are included after the template so you can see it applied to unfamiliar genres.

---

## 1. High-Level Concept

*Prompt: In 2-3 sentences, what is the game and what single mechanic or fantasy is it built around?*

- **Working title:**
- **Genre / closest comparisons:**
- **Core fantasy** (what does the player feel like they're doing?):
- **The one mechanic everything else is built on top of** (Stacklands: card-stacking. Yours: ___):

## 2. The Core Game Loop

*Prompt: What's the shortest sequence of player actions that repeats, and what changes each time it repeats?*

Fill in the verbs (aim for 4-7 steps):

1. **[Verb]** — what the player does first, and what triggers it
2. **[Verb]** —
3. **[Verb]** —
4. **[Verb]** —
5. **[Verb]** —
6. **[Return to step 1, changed how?]** — what's different about the board/state the next time through?

Then draw it:

```
 ┌─────────────┐      ┌──────────┐      ┌────────────┐
 │   Step 1     │ ───► │  Step 2  │ ───► │   Step 3   │
 └─────▲───────┘      └────┬─────┘      └─────┬──────┘
       │                    │                  │
       │                    ▼                  ▼
       │              ┌──────────┐      ┌────────────┐
       └──────────────┤  Step 5  │◄─────┤   Step 4   │
                       └──────────┘      └────────────┘
```

*Test it:* can you say the loop in one sentence, the way "gather → craft → sell → buy → expand → survive" describes Stacklands? If not, the loop is probably too complicated or not yet found.

## 3. The Core Interaction (Input Layer)

*Prompt: What is the one physical/UI action the player performs most often, and how many systems does it touch?*

- **The interaction:** (drag-and-drop, click-to-select, card play, dice roll, dialogue choice, vote allocation, unit order, etc.)
- **What it means in this game's fiction:** (a "stack" in Stacklands = an action space; what's the equivalent here?)
- **How many separate systems does this one interaction serve?** (List them — crafting, movement, combat, negotiation, persuasion...) The fewer distinct interactions needed to run the whole game, the more legible it will feel.
- **What does the game do while the player waits?** (Real-time countdown, turn resolution, animation, nothing?)

## 4. Recipes / Rules / Tech-Tree System

*Prompt: What is the equivalent of Stacklands' "Ideas" — the thing that tells players what combinations or choices are valid, and how do players learn it?*

- **What is being combined or decided?** (resources+worker → building; policy+coalition → bill passed; army+terrain → battle outcome; era+invention → new unit)
- **How many "recipes"/rules exist at launch, roughly?**
- **How are new ones unlocked?** (drawn randomly, researched, discovered by trial, negotiated, voted in)
- **Is blind discovery possible** (can a player stumble into the right combo without being told), or must the rule be explicitly known first? Either is valid — pick deliberately.

## 5. The Economy

*Prompt: What is convertible into what, and what's the "coin" that has no other purpose but purchasing power?*

- **What resources exist?** (list 3-8: raw materials, political capital, reputation, votes, supplies, morale...)
- **What is the pure currency** (useful only for buying/trading, never consumed directly)?
- **What can be sold/converted, and at what rate?**
- **Is there a slow-for-more-value option** (Stacklands' Market: 2x value for 60s delay)? Fast/cheap vs. slow/valuable trade-offs are a reliable way to add depth without new mechanics.
- **What's the randomized/gamble element**, if any (packs, card draws, dice, random events)?

## 6. Turn Structure / Time Pressure

*Prompt: What is this game's "Moon" — the recurring deadline that forces the player to convert in-progress work into banked value?*

- **Unit of time:** (turn, round, season, election cycle, fiscal quarter, real-time interval)
- **What happens automatically at the end of each unit?** (feeding, upkeep, elections, disasters, decay)
- **What are the failure conditions checked at that boundary?** (starvation, bankruptcy, no-confidence vote, capacity overflow)
- **Is time real-time, turn-based, or turn-based-with-a-clock (like Stacklands' pausable real-time)?**
- **What difficulty knob controls this?** (equivalent of Moon Length: short/normal/long)

## 7. Population / Agent System

*Prompt: What are the countable "units" the player is responsible for keeping alive/functional, and how do they multiply?*

- **The agent type(s):** (villagers, citizens, soldiers, legislators, voters, factions)
- **How do new agents enter the game?** (birth, recruitment, immigration, election, hiring)
- **Is there a hard cap, or a soft cap created by an economy** (Stacklands has no housing cap — food is the real brake)?
- **What does losing an agent cost the player**, and is it permanent?
- **What's the tension**: growth = more actions/turn, but also more upkeep. What's the upkeep here?

## 8. Conflict / Challenge System

*Prompt: What is this game's "combat" — the system that can end a run, agent, or plan, and how automatic vs. manual is it?*

- **What form does conflict take?** (military combat, legal challenge, election, negotiation, scandal, budget crisis, public opinion swing)
- **Is resolution automatic (triggered by proximity/conditions) or does the player make active choices during it?**
- **What stats/gear/prep affect the outcome?** (weapons/armor equivalent: policy positions, alliances, funding, propaganda, evidence, troops)
- **Is there an escape/retreat option**, and what does it cost?
- **What's the loot/outcome** of winning or losing (resources, reputation, territory, seats)?

## 9. Progression Systems

*Prompt: What 2-3 tracks gate content, and how do they reinforce each other?*

| System | What it gates | How it advances |
|---|---|---|
| (e.g., Quests/Objectives) | | |
| (e.g., Tech/Rules/Ideas) | | |
| (e.g., Packs/Draws/Unlocks) | | |

*Test it:* does completing track A make track B easier to advance, and vice versa? That feedback loop is what keeps players engaged between big beats.

## 10. Expansion / Late-Game Content

*Prompt: What's the equivalent of Stacklands' Island, Dark Forest, and Demon fight — content that only appears once the player has proven basic mastery?*

- **Mid-game exploration/discovery beat:**
- **Optional side content / alternate map or mode:**
- **The "final boss" or capstone challenge**, and what quest chain gates access to it:
- **Achievements / external recognition tied to milestones:**

## 11. Settings That Reshape Difficulty

*Prompt: What 2-3 toggles change the game's tempo or content without changing its rules?*

- **Pace toggle** (equivalent of Moon Length):
- **Content toggle** (equivalent of Peaceful Mode — removes a whole system):
- **Discovery toggle** (equivalent of Strict Mode — changes how much is told to the player upfront):

---

## 12. Design-Quality Checklist

Run this after drafting Sections 1–11. These are the patterns that made Stacklands' loop work — check whether your idea has an equivalent, and if not, decide if that's intentional.

- [ ] **One mechanic, many systems.** Can your core interaction (Section 3) plausibly run crafting, movement, AND conflict, or do you need 3 separate UIs? Fewer is usually more legible.
- [ ] **Randomized unlocks break linear dependency chains.** Is there a shuffle/gamble element (Section 5) that forces players to reorder strategy instead of following one fixed path every run?
- [ ] **Tension is a tug-of-war, not a wall.** Is your main difficulty (Section 7/8) a soft trade-off the player creates for themselves (grow too fast vs. sustain), rather than a hard gate that just says "no"?
- [ ] **One deadline, two pressures.** Does your turn boundary (Section 6) check more than one failure condition at once (e.g., resource AND capacity), so a single timer does double duty?
- [ ] **Pausing/planning is part of the design.** Can the player think without being punished for taking time, even in a real-time or time-pressured system?
- [ ] **The loop fits in one sentence.** Can you describe Section 2 the way "gather → craft → sell → buy → expand → survive" describes Stacklands?

---

## Worked Example A: Political Campaign Sim

*Quick pass to show the template flexes to a non-survival genre.*

1. **Concept:** You run a long-shot candidate's campaign from launch to election night; the fantasy is stretching a small war chest into a winning coalition.
2. **Core loop:** Recruit volunteers → run canvassing/ad/fundraising actions → convert results into Voter Support and Donations → spend Donations on Ad Packs / Consultant hires → expand into new districts → survive the weekly Poll Check.
3. **Core interaction:** Drag a Volunteer card onto a District card to canvass it; drag Donations onto an Ad Pack to buy media.
4. **Recipes/rules:** "Strategy" cards (equivalent of Ideas) — e.g., 2 Volunteers + 1 Data Analyst → Field Office; unlocked via consultant hires or discovered by trying combos.
5. **Economy:** Voter Support and Donations are resources; Donations are the pure currency; a Super PAC action doubles ad reach but takes a full week and risks a Scandal event.
6. **Turn structure:** Weekly Poll Check (the "Moon") — undersupported districts flip to the opponent; campaign-capacity cap (staff burnout) forces trimming initiatives if over the limit.
7. **Population/agents:** Volunteers and Staff; recruited via events or hired with Donations; no hard cap, but Payroll (upkeep) is the real brake on headcount.
8. **Conflict system:** Scandals and opposition attack ads trigger automatically when Support crosses certain thresholds in contested districts; Rapid Response staff and pre-built narrative cards mitigate damage; losing a news cycle costs Support instead of HP.
9. **Progression:** Endorsement quests unlock new Strategy Packs; Strategy cards unlock new district actions; district wins unlock general-election content.
10. **Late game:** Primary run → General Election map → Election Night capstone event gated behind securing your party's nomination.
11. **Settings:** Poll Check frequency (weekly/biweekly/monthly), "Landslide Mode" (removes Scandal events), "Insider Mode" (removes auto-discovery of Strategy combos).

## Worked Example B: Historical Empire Sim (e.g., Bronze Age city-state)

1. **Concept:** You steward a single city-state from founding to regional dominance; the fantasy is turning scarce farmland into an empire before a rival civilization or environmental collapse ends you.
2. **Core loop:** Assign Citizens to land/resource tiles → craft goods via Trade Recipes → sell surplus at the Market for Grain/Bronze → spend on Expedition Packs (new tiles, tech, or trade routes) → grow population → survive the Harvest Season food check.
3. **Core interaction:** Drag a Citizen card onto a Tile or Workshop card to work it.
4. **Recipes/rules:** "Craft" cards — e.g., 2 Clay + 1 Citizen → Pottery; unlocked via Scribe research or found by trial.
5. **Economy:** Grain (food/currency-adjacent) and Bronze (pure currency) — Grain feeds citizens AND buys Expedition Packs, deliberately creating a feed-vs-invest tension every Harvest.
6. **Turn structure:** Harvest Season (the "Moon") every N real-time minutes — feeds Citizens, checks Granary capacity overflow, and rolls for Drought/Flood events.
7. **Population/agents:** Citizens, born via Household buildings; no population cap, but Grain upkeep and disease-from-overcrowding are the soft brakes.
8. **Conflict system:** Raiders and rival city-states trigger automatic skirmishes when scouted or when your Prestige crosses a threshold; Bronze weapons and Wall buildings improve odds; losing a skirmish costs Citizens and stored goods, not an instant game-over.
9. **Progression:** Founding Quests unlock Expedition Packs; Craft recipes unlock new buildings; buildings unlock new Quests (temple, ziggurat, etc.).
10. **Late game:** Discovering the River Delta region → Trade League diplomacy content → capstone Coronation event gated behind uniting three city-states.
11. **Settings:** Harvest Season length, "Golden Age Mode" (no raiders), "Oral Tradition Mode" (no auto-discovery of Craft recipes — must find the Scribe tablet first).

---

Use this the same way for a music game, a event-discovery app, or anything else: fill Sections 1–11 with your idea's nouns and verbs, then run the Section 12 checklist to see where the loop still needs sharpening.
