# Stacklands: Game Mechanics & Core Loop Breakdown

*Developer: Sokpop Collective (Kobezmen) · Publisher: Raw Fury · Genre: Card-based village builder / survival management*

## 1. High-Level Concept

Stacklands takes every system a normal village-builder would need — resource nodes, buildings, workers, a tech tree, combat, an economy — and collapses all of them into a single physical object: the card. There is no map grid, no menus, no separate crafting UI. Everything happens by dragging cards on top of other cards on one small tableau. If a combination is valid, it produces a new card or starts a timed action; if it isn't, nothing happens ([Steam store page](https://store.steampowered.com/app/1948280/Stacklands/); [Wikipedia](https://en.wikipedia.org/wiki/Stacklands)).

This single mechanic — stacking — is simultaneously the game's input method, its crafting system, its worker-placement system, and its combat trigger. That unification is why the design is frequently cited as a masterclass in doing more with less ([Game Developer interview with the creator](https://www.gamedeveloper.com/business/how-stacklands-uses-simplicity-to-create-a-compelling-card-based-village-builder)).

## 2. The Core Game Loop

At the macro level, Stacklands runs on a tight, repeating loop:

1. **Gather** — Drag a Villager onto a resource card (tree, berry bush, rock) to slowly convert it into raw materials.
2. **Craft** — Stack raw materials (and usually a Villager) together to satisfy an "Idea" recipe, producing tools, buildings, or food.
3. **Sell** — Drag excess cards onto the Sell slot for coins.
4. **Buy** — Spend coins on Booster Packs, which contain a random handful of new cards (resources, buildings, enemies, or Ideas).
5. **Expand** — New cards unlock new recipes and new production chains, which in turn need more Villagers and more food to sustain.
6. **Survive the turn** — At the end of every Moon (the game's turn/round), every Villager must be fed. Unfed Villagers starve and die permanently ([Wikipedia](https://en.wikipedia.org/wiki/Stacklands); [Gaming Nexus review](https://www.gamingnexus.com/Article/14023/Stacklands/)).

This "gather → craft → sell → buy → expand → survive" cycle repeats every Moon, and each pass through it is meant to leave the village slightly larger and more efficient than before — the classic "one more turn" hook, here reframed as "one more Moon" ([Gaming Nexus](https://www.gamingnexus.com/Article/14023/Stacklands/)).

### The loop as a diagram

```
 ┌─────────────┐      ┌──────────┐      ┌────────────┐
 │  Gather raw │ ───► │  Craft   │ ───► │ Sell excess│
 │  resources  │      │  via     │      │  for coins │
 │ (stack a    │      │  Ideas   │      └─────┬──────┘
 │  Villager)  │      │ (recipes)│            │
 └─────▲───────┘      └────▲─────┘            ▼
       │                   │            ┌────────────┐
       │                   └──────────  │  Buy Packs │
       │                                │ (new cards)│
 ┌─────┴───────┐                        └─────┬──────┘
 │  Feed        ◄──────────────────────────────┘
 │  Villagers   │      end of Moon: unfed Villagers starve
 │  at Moon end │      → population shrinks → loop tightens
 └─────────────┘
```

## 3. The Stacking Mechanic (Input Layer)

- Every object on the board — Villagers, resources, tools, buildings, animals, enemies, and even ideas — is a card.
- Dragging one card onto another attempts an interaction. Examples: Villager + Berry Bush → Berries over time; Villager + Tree → Wood; 2 Wood + 1 Stone + 1 Villager → House ([Steam](https://store.steampowered.com/app/1948280/Stacklands/)).
- A "stack" of non-Villager cards (e.g., 2 Wood + 1 Stone sitting together) functions like an action space or a pending recipe — it only activates once a Villager is placed on top, effectively spending that Villager's action for the duration of the task ([Pixelated Playgrounds design analysis](https://www.pixelatedplaygrounds.com/sidequests/game-design-perspective-stacklands)).
- Most actions take real time to resolve (roughly 10–120 seconds depending on the action), during which the Villager is "locked in" to that job. The game can be paused at any time — importantly, cards can still be rearranged and sold while paused, which is the primary way players manage the real-time pressure without needing fast reflexes ([Indie Game Reviewer](https://indiegamereviewer.com/stacklands-review-stack-me-up/); [NamuWiki](https://en.namu.wiki/w/Stacklands)).

## 4. Ideas: The Recipe / Tech-Tree System

- "Ideas" are blue recipe cards that tell you what combination of cards produces a given result (e.g., 1 Wood + 1 Villager → Stick) ([Stacklands Wiki: Ideas](https://stacklands.fandom.com/wiki/Category:Ideas)).
- There are 60+ Ideas in the base game, covering nine categories such as farming, cooking, tools, and construction ([Steam](https://store.steampowered.com/app/1948280/Stacklands/)).
- Ideas can be discovered two ways: finding an explicit Idea card in a Booster Pack, or simply performing the correct combination "blind" — if a player happens to drag the right cards together, the recipe unlocks automatically even without owning the Idea card ([Stacklands Wiki](https://stacklands.fandom.com/wiki/Category:Ideas)).
- A "Strict Mode" option removes this auto-discovery, forcing players to find the actual Idea card before they're allowed to craft the recipe — a popular self-imposed difficulty challenge among the community.
- Functionally, Ideas are Stacklands' tech tree: they gate what production chains are available, and expanding them is one of the game's core long-term progression axes alongside population growth.

## 5. The Economy: Selling, Coins, and Packs

- Almost any card can be sold for coins by dragging it to the Sell slot (or the Backspace-click shortcut) ([Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2791179191)).
- Coins are themselves cards, but are not sellable — they exist purely to purchase Booster Packs.
- There are 13 different Card Packs, each themed around a focus (e.g., Cooking, Farming, Building, Logic and Reason) and unlocked progressively by completing quests ([Steam](https://store.steampowered.com/app/1948280/Stacklands/); [chaptercheats.com pack list](https://www.chaptercheats.com/cheat/pc/553534/stacklands/hint/167475)).
- A **Market** building (crafted from Brick + Plank + Coins + a Villager) sells any card for double its normal value, but takes ~60 real-time seconds to complete the sale — introducing a classic economic trade-off between speed and yield that becomes central to late-game automation setups ([Steam discussion](https://steamcommunity.com/app/1948280/discussions/0/3390660679622215946/); [SteamDeal automation guide](https://www.steamdeal.co.kr/en/guides/1948280/3366980865)).
- Because packs are randomized, the economy loop also functions as the game's "randomizer"/loot mechanic — spending coins is simultaneously an investment decision and a gamble on what new systems you'll unlock next ([Game Developer interview](https://www.gamedeveloper.com/business/how-stacklands-uses-simplicity-to-create-a-compelling-card-based-village-builder)).

## 6. Turn Structure: The Moon Cycle

- Time in Stacklands is divided into **Moons** — a fixed real-time interval (Short = 90s, Normal = 120s, Long = 180–200s, selectable at run start) that functions as the game's "turn" ([Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2791179191); [NamuWiki](https://en.namu.wiki/w/Stacklands)).
- At the end of every Moon, all Villagers must be fed: adults consume 2 food, babies consume 1 food, automatically drawn from whatever food cards are on the board ([Stacklands Wiki](https://stacklands.fandom.com/wiki/Quests); [Backloggd review](https://backloggd.com/reviews/everyone/eternity/liked/stacklands/)).
- Any Villager who doesn't get fed starves and dies, leaving behind a Corpse card (itself usable in some recipes, like Graveyards).
- A second end-of-Moon constraint is the **card cap**: the board has a maximum number of non-coin cards allowed. If you exceed it at Moon's end, you're forced to sell down to the limit before play continues — this cap can be raised by building storage structures like barns/warehouses ([NamuWiki](https://en.namu.wiki/w/Stacklands); [Gaming Nexus](https://www.gamingnexus.com/Article/14023/Stacklands/)).
- Random events, enemy portals, or raids can also trigger around Moon transitions, adding a layer of unpredictability on top of the deterministic food/cap checks ([Wikipedia](https://en.wikipedia.org/wiki/Stacklands)).

The Moon is effectively Stacklands' "round" — a soft real-time deadline that forces players to convert ongoing actions into finished, storable value before the clock resets the pressure.

## 7. Population System

- The starting pack always includes exactly one Villager.
- New adult Villagers are produced by stacking two adult Villagers on a House — this spawns a Baby, which matures into an adult after enough time passes ([Pixelated Playgrounds](https://www.pixelatedplaygrounds.com/sidequests/game-design-perspective-stacklands)).
- There is deliberately no hard population cap tied to housing count — a single House can theoretically support the whole run. The real brake on growth is the food economy: every new Villager (and every baby) adds recurring food demand at the next Moon ([Pixelated Playgrounds](https://www.pixelatedplaygrounds.com/sidequests/game-design-perspective-stacklands)).
- Death is permanent. Villagers can die from starvation or from losing a fight. If every Villager dies, the run ends ([Wikipedia](https://en.wikipedia.org/wiki/Stacklands)).

This is the game's central risk/reward lever: growing your Villager count grows your available "actions per Moon," but growing too fast without a matching food engine is the single most common way runs collapse ([Pixelated Playgrounds](https://www.pixelatedplaygrounds.com/sidequests/game-design-perspective-stacklands)).

## 8. Combat System

- Combat triggers automatically: if a Villager (or enemy) is close enough to a hostile creature card (Rat, Bear, Goblin, etc.), a sword icon appears and an automatic fight begins ([Steam](https://store.steampowered.com/app/1948280/Stacklands/); [Indie Game Reviewer](https://indiegamereviewer.com/stacklands-review-stack-me-up/)).
- Fights resolve turn-by-turn between the units in each stack using a defined resolution order (initiator first, then units by creation order) ([Stacklands Wiki: Combat Mechanics](https://stacklands.fandom.com/wiki/Combat_Mechanics)).
- Each attack resolves through several steps: hit-chance roll → special-hit check (e.g., stun/heal from equipment) → target selection (proportional position in the enemy stack) → damage roll (50% chance of +1) → defense mitigation (1 damage blocked per 2 Defense) → an attack-type effectiveness triangle (Ranged beats Melee, Melee beats Magic, Magic beats Ranged, granting +40% damage) → critical-hit doubling ([Stacklands Wiki: Combat Mechanics](https://stacklands.fandom.com/wiki/Combat_Mechanics)).
- Players can improve odds by equipping weapons/armor, grouping multiple Villagers into one stack before engaging, or manually dragging Villagers out of a losing fight to save them, since player-initiated fights can be retreated from ([Stacklands Wiki: Combat Mechanics](https://stacklands.fandom.com/wiki/Combat_Mechanics)).
- Defeated enemies frequently drop loot cards, turning combat into another resource-acquisition path alongside gathering and crafting.
- The endgame's climactic fight (the Demon) is deliberately gated behind a specific quest chain — finding a Goblet and bringing it to a built Temple — making combat mastery a required, not optional, part of finishing a run ([Steam guide: 100% walkthrough](https://steamcommunity.com/sharedfiles/filedetails/?id=2791179191)).

## 9. Progression Systems

Stacklands layers three progression tracks on top of the core loop:

| System | What it gates | How it advances |
|---|---|---|
| **Quests** (50+) | Which Booster Packs are available to buy | Completing in-game milestones (e.g., "Sell a Card," "Get 3 Villagers," "Build a Temple") ([Steam](https://store.steampowered.com/app/1948280/Stacklands/); [Stacklands Wiki: Quests](https://stacklands.fandom.com/wiki/Quests)) |
| **Ideas** (60+) | What can be crafted | Finding Idea cards in packs, or crafting the combo blind ([Stacklands Wiki](https://stacklands.fandom.com/wiki/Category:Ideas)) |
| **Card Packs** (13) | What raw content enters the game | Bought with coins once unlocked by quests; each has a themed pool of possible cards ([chaptercheats.com](https://www.chaptercheats.com/cheat/pc/553534/stacklands/hint/167475)) |

These three tracks are mutually reinforcing: quests unlock packs, packs contain Ideas and resources, and using those resources correctly completes more quests — a self-sustaining discovery loop layered on top of the moment-to-moment survival loop.

## 10. Expansions and Endgame Content

- **Catacombs / mysterious artifacts**: mid-game exploration content found via Forest, Mountain, or Graveyard cards, leading toward the Temple + Goblet + Demon boss sequence that represents the "main quest" climax ([Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2791179191)).
- **The Island**: a free content update adding a second map reached by boat, with its own currency (Shells instead of Coins) and Island-specific Idea cards ([chaptercheats.com](https://www.chaptercheats.com/cheat/pc/553534/stacklands/hint/167475); [Half-Glass Gaming quest guide](https://halfglassgaming.com/2022/04/stacklands-a-complete-guide-to-every-quest-in-the-game/)).
- **Dark Forest**: a shadowy end-game area accessed via randomly spawning Portals, culminating in a confrontation with a Witch; ignoring a spawned portal can let it release an enemy encounter into your base instead ([Gaming Nexus](https://www.gamingnexus.com/Article/14023/Stacklands/)).
- **Achievements** largely mirror the quest list one-to-one, giving external, Steam-level recognition for reaching Moon milestones (6/12/24/36), full Idea completion, and story beats like defeating the Demon ([Stacklands Wiki: Achievements](https://stacklands.fandom.com/wiki/Achievements)).

## 11. Settings That Change the Loop's Difficulty

- **Moon Length** (Short/Normal/Long): directly tunes how much real time you have per gather-craft cycle before the next food check — the single biggest difficulty lever in the game ([Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2791179191)).
- **Peaceful Mode**: removes hostile creature spawns entirely, turning the game into a pure economic/building puzzle.
- **Strict Mode**: disables blind-discovery of Ideas, forcing players to physically own the recipe card before crafting it, which slows the tech-tree side of progression considerably.

## 12. Design Takeaways for Loop Design

A few structural choices are worth calling out if you're studying Stacklands as a reference for your own city-builder/simulation loops:

- **One mechanic, many systems.** Drag-and-stack alone implements crafting, worker placement, combat, and even the "menu" for buying packs. Before building separate UI for each system, ask whether one physical interaction can carry several of them ([Game Developer interview](https://www.gamedeveloper.com/business/how-stacklands-uses-simplicity-to-create-a-compelling-card-based-village-builder)).
- **Randomized unlocks solve the "everything follows from one thing" problem.** The developer explicitly built Booster Packs to break the linear dependency chain of an early prototype, forcing players to reorder their strategy around whatever they happen to draw ([Game Developer interview](https://www.gamedeveloper.com/business/how-stacklands-uses-simplicity-to-create-a-compelling-card-based-village-builder)).
- **The real difficulty is a tug-of-war, not a wall.** There's no hard cap on population growth — the tension is entirely self-inflicted, between how fast you expand and how fast your food/defense engines can catch up. This produces the classic "outran my own economy" failure state rather than an artificial gate ([Pixelated Playgrounds](https://www.pixelatedplaygrounds.com/sidequests/game-design-perspective-stacklands)).
- **A single hard deadline (the Moon) does double duty.** It forces both a resource check (food) and a space check (card cap) at the same moment, so a single timer creates two distinct pressures instead of needing two separate systems.
- **Pausing is part of the design, not a concession to accessibility.** Because rearranging and selling cards is allowed while paused, the game preserves "puzzle-solve at your own pace" even inside a real-time engine — a useful pattern if you want tactile, real-time-feeling systems without punishing reflex speed.

## Sources

- [Stacklands on Steam — official description and features](https://store.steampowered.com/app/1948280/Stacklands/)
- [Stacklands — Wikipedia](https://en.wikipedia.org/wiki/Stacklands)
- [Game Design Perspective: Stacklands — Pixelated Playgrounds](https://www.pixelatedplaygrounds.com/sidequests/game-design-perspective-stacklands)
- [How Stacklands uses simplicity to create a compelling card-based village builder — Game Developer](https://www.gamedeveloper.com/business/how-stacklands-uses-simplicity-to-create-a-compelling-card-based-village-builder)
- [Combat Mechanics — Stacklands Wiki (Fandom)](https://stacklands.fandom.com/wiki/Combat_Mechanics)
- [Quests — Stacklands Wiki (Fandom)](https://stacklands.fandom.com/wiki/Quests)
- [Category: Ideas — Stacklands Wiki (Fandom)](https://stacklands.fandom.com/wiki/Category:Ideas)
- [Achievements — Stacklands Wiki (Fandom)](https://stacklands.fandom.com/wiki/Achievements)
- [Stacklands Review — Stack Me Up, Indie Game Reviewer](https://indiegamereviewer.com/stacklands-review-stack-me-up/)
- [Stacklands Review — Gaming Nexus](https://www.gamingnexus.com/Article/14023/Stacklands/)
- [Stacklands — Backloggd reviews](https://backloggd.com/reviews/everyone/eternity/liked/stacklands/)
- [(Original) Stacklands Information — Steam Community Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2791179191)
- [100% Cardopedia and Some game mechanisms — chaptercheats.com](https://www.chaptercheats.com/cheat/pc/553534/stacklands/hint/167475)
- [Stacklands — A Complete Guide to Every Quest — Half-Glass Gaming](https://halfglassgaming.com/2022/04/stacklands-a-complete-guide-to-every-quest-in-the-game/)
- [Stacklands — NamuWiki](https://en.namu.wiki/w/Stacklands)
- [Late Game Automation guide — SteamDeal](https://www.steamdeal.co.kr/en/guides/1948280/3366980865)
