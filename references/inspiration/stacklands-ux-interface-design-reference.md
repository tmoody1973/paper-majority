# Stacklands: UX & Interface Design Reference

*A reference doc on how Stacklands' interface, feedback, and interaction design work — for reuse when designing UX for your own card/simulation-style games.*

This is a companion to the mechanics/loop breakdown — that doc covers *what the systems are*; this one covers *how the interface communicates those systems to the player*. Where the mechanics doc explains the Moon cycle or the Idea system, this doc explains how the game gets you to understand those systems without a tutorial wall of text.

## 1. Design Philosophy: One Interaction, Many Verbs

The single biggest UX decision in Stacklands is unifying every possible player action — crafting, harvesting, combat, trading, cooking, growing — under one gesture: drag a card onto another card ([Stacklands and the UX of Cards, JB Oger](https://jboger.substack.com/p/stacklands)).

Why this matters for UX, not just mechanics:
- The player only has to learn **one input pattern** for the entire game. Once you know "drag card onto card," you already know how to attempt every action that exists.
- There's exactly **one way to test a hypothesis.** If a player wonders "can I cook a berry on a campfire?", the only way to find out is to try it — there's no separate menu, recipe browser, or crafting grid that could give a different (and confusing) answer. The interaction *is* the query system ([JB Oger](https://jboger.substack.com/p/stacklands)).
- This collapses what would normally be 5-6 separate UI systems (a crafting menu, a combat targeting UI, a trading screen, a farming interface, a cooking interface) into a single, consistent motion.

**Takeaway for your own design:** before you design five different screens for five different verbs, ask whether a single object-manipulation gesture (drag, stack, connect, swipe) could stand in for all of them. Players learn the *gesture* once; the *content* of what they discover is where your game's depth should live.

## 2. Card Layout & Information Hierarchy

Stacklands keeps individual card layouts deliberately sparse, which is a specific, defensible UX choice rather than a limitation:

- Each card shows only the essentials at rest (illustration, name, and typically a price value in a fixed corner position). Deeper information — stats, recipe requirements, flavor text — lives in a **hover tooltip**, not on the card face ([JB Oger](https://jboger.substack.com/p/stacklands)).
- This follows the **law of Prägnanz** (simple, orderly forms are easier for the brain to process): rather than cramming a card with 16 data points the way a game like *Marvel Champions* does, Stacklands asks the player to memorize almost nothing and look up the rest on demand ([JB Oger](https://jboger.substack.com/p/stacklands)).
- Consistency matters more than density: because the price is always in the same corner on every card type, players can retrieve that specific piece of information from any card without conscious effort, freeing attention for the parts of the card that actually vary (the illustration, which is the fastest way to recognize a card at a glance) ([JB Oger](https://jboger.substack.com/p/stacklands)).

**Takeaway:** decide, per data point, whether it needs to be always-visible (high-frequency, low-effort lookups — put these in a fixed position on every card/unit) or on-demand (low-frequency or advanced info — put these behind a hover/tap reveal). Don't let "more information" default to "always-visible information."

## 3. Feedback for In-Progress Actions

When a card is stacked and an action begins, a **progress bar appears above the stack** — this is the game's universal signal that "something is happening here, wait for it" ([JB Oger](https://jboger.substack.com/p/stacklands)).

- The bar itself doesn't need to explain *what* will happen — players learn by watching the outcome once (Villager + Berry Bush → progress bar → Berries appear, bush eventually depletes and disappears).
- Because every card is the same physical size and shape, the animations riding on top of that shape (the bar filling, a card fading out when consumed) are easy to read at a glance regardless of what the underlying object represents ([JB Oger](https://jboger.substack.com/p/stacklands)).
- This is also a production-efficiency win worth noting for your own project: a uniform object shape means you can build one feedback system (one progress-bar component, one spawn animation, one depletion animation) and reuse it across every card type in the game, instead of custom animation work per asset.

**Takeaway:** a single, reusable "this is in progress" indicator (a bar, a spinner, a glow) that attaches to *any* object in your game is far more scalable than bespoke feedback per system, and it teaches players a pattern they can apply to unfamiliar content immediately.

## 4. Physical Metaphors Make Abstract Rules Legible

This is arguably the most transferable insight in the whole game: hard, punishing rules feel fair when the medium makes the rule visually self-evident.

- The end-of-Moon **card cap** — you must sell down to a maximum board count or the game won't let you proceed — is a genuinely restrictive rule. But because every object is a discrete, countable card, the player can *see* they have too many cards the same way they'd see too many physical objects on a table. There's no ambiguity about whether they're over the limit ([JB Oger](https://jboger.substack.com/p/stacklands)).
- The article makes a sharp comparison: in a 3D game with a similar cap, how would a tree count against your inventory? Why would an egg count the same as a house? Those questions don't have obvious answers in most 3D game UIs — but in Stacklands, "one card = one unit" is the whole rule, with no interpretation needed ([JB Oger](https://jboger.substack.com/p/stacklands)).
- The same logic applies to feeding Villagers at Moon's end: food cards are visibly consumed, accompanied by a short (~1 second), readable sequence — cards move, disappear, a "crunchy" sound plays, the camera pans to show it happening ([JB Oger](https://jboger.substack.com/p/stacklands)).

**Takeaway:** when you need to introduce a hard limit or penalty, look for a way to represent it using the same countable, physical unit the player is already tracking everything else with. If your "inventory" or "capacity" concept requires a separate mental model from the objects the player manipulates directly, expect friction — even if the rule is mechanically simple.

## 5. Turning Randomness Into a Familiar Object

Randomness is one of the hardest things to make feel fair in a UI — most players read unexplained RNG as arbitrary or unfair. Stacklands sidesteps this by wrapping its randomization in a **pre-existing real-world mental model**: the trading-card booster pack ([JB Oger](https://jboger.substack.com/p/stacklands)).

- Players already know, from real card games, that a "pack" means "a fixed number of items, contents unknown until opened, themed around a set." That expectation transfers instantly.
- Packs are opened one card at a time with a click-to-reveal interaction, rather than dumping all contents on screen at once — this paces the "reveal" moment the same way opening a physical pack does.
- Because the model is borrowed wholesale from a familiar object, the developers get the variance they need for replayability without having to build a bespoke "explain the RNG to the player" UI.

**Takeaway:** when your game needs randomization, look for an existing real-world object or ritual (a pack, a dice roll, a spin, a raffle draw) whose fairness/format is already culturally understood, instead of inventing a new abstract probability display.

## 6. Onboarding: Quests as a Forced-Action Tutorial

Stacklands has no separate tutorial mode. Instead, the first ~10-12 quests are written as literal, sequential instructions that double as the actual tutorial ([Stacklands Wiki: Quests](https://stacklands.fandom.com/wiki/Quests); [Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2791179191)):

- "Open the Booster Pack" → "Drag the Villager on top of the Berry Bush" → "Mine a Rock using a Villager" → "Sell a Card" → "Buy the Humble Beginnings Pack" → "Pause using the play icon" → "Build a House" → "Get a Second Villager" → "Create Offspring."
- Each instruction is phrased as an action verb plus a concrete target, not an explanation of a system — the player learns the mechanic by doing the exact motion once, with the quest log as a persistent checklist docked on the left side of the screen ([Stacklands Wiki: Quests](https://stacklands.fandom.com/wiki/Quests)).
- Quests are visible before completion (no mystery-box hidden objectives for the early tutorial set), which keeps the very first minutes low-friction; later, more advanced quests are deliberately hidden until their prerequisites are discovered, shifting the sidebar's role from "tutorial checklist" to "exploration hint system" as the player progresses ([Half-Glass Gaming quest guide](https://halfglassgaming.com/2022/04/stacklands-a-complete-guide-to-every-quest-in-the-game/)).
- Completing quests is the sole unlock mechanism for new Booster Packs, so the "tutorial" and the "progression system" are literally the same UI element — there's no separate reward structure for onboarding versus playing the actual game ([Steam](https://store.steampowered.com/app/1948280/Stacklands/)).

**Takeaway:** if you can phrase your tutorial steps as the same quest/objective format you use for regular progression, you avoid building (and maintaining) a separate onboarding system. The tutorial becomes just the first N rows of your real quest list.

## 7. The Sidebar as Extended Memory

As the card pool grows past what a player can memorize, Stacklands leans on a docked **encyclopedia panel** (toggled with the Q key) rather than repeating information on every card ([JB Oger](https://jboger.substack.com/p/stacklands); [Steam guide keybinds](https://steamcommunity.com/sharedfiles/filedetails/?id=2791179191)).

- This is a deliberate acknowledgment that intuitive controls don't eliminate the need for memorization — humans still need repeated exposure to internalize dozens of recipes, so the game gives them an always-available reference instead of pretending the interaction design alone will make everything permanently obvious ([JB Oger](https://jboger.substack.com/p/stacklands)).
- The sidebar also hosts the Quest log in the same dock, meaning "what should I do" and "what do I already know" live in one predictable screen region rather than being scattered across multiple menus.

**Takeaway:** don't rely purely on "intuitive design" to carry a large content library. Even a very legible interaction system benefits from a persistent, low-friction lookup panel once your content count passes what's reasonably memorizable (rule of thumb: once you're past ~15-20 distinct recipes/interactions).

## 8. HUD and Controls Inventory

A full accounting of Stacklands' on-screen and keyboard surface, useful as a checklist when scoping your own HUD ([Steam Community guide: keybinds](https://steamcommunity.com/sharedfiles/filedetails/?id=2791179191)):

| Element | Location / Trigger | Purpose |
|---|---|---|
| Sell slot | Fixed top-row UI | Drop any card here to convert to coins instantly |
| Moon timer | Top bar | Real-time progress bar toward the next feeding/food check |
| Quest log | Left sidebar, `Q` to toggle | Checklist of active objectives, doubles as tutorial |
| Cardopedia/encyclopedia | Left sidebar (same dock as quests) | Reference for discovered cards and Ideas |
| Booster Pack tray | Bottom/side of board | Where purchased packs sit before being opened |
| Camera pan | `W A S D` | Move the view across an expanding board |
| Speed toggle | `Tab` | Switch between normal and fast simulation speed |
| Pause / menu | `Esc` or the play-icon button | Freezes simulation time; card rearranging/selling still allowed while paused |
| Quick-sell | `Backspace` + click | Sells a card instantly without dragging it to the Sell slot |

Two details worth calling out specifically:
- **Pausing does not freeze the interface** — you can still drag, stack, and sell cards while paused. This turns "pause" into a planning tool rather than just an escape hatch, which matters a lot for a game that otherwise runs on a real-time clock ([Indie Game Reviewer](https://indiegamereviewer.com/stacklands-review-stack-me-up/)).
- **Run-start settings are chosen once, up front** (Moon Length: Short/Normal/Long; Peaceful Mode on/off), not buried in an in-run options menu — difficulty-shaping choices are surfaced at the moment they're most relevant (before you've invested in a run), not hidden in a settings icon you'd have to think to open ([Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2791179191)).

## 9. Art Direction as a Production and UX Strategy

The visual style is minimalist and consistent across all ~200+ cards, and that consistency is a stated production decision, not just a taste choice, per lead designer Aran Koning: *"The most important part of the art design was that the cards shouldn't be too different and that they should be easy to add... I just told her to draw the first thing that came to mind, without any revisions. That worked really well and I think that's why the game's art is fun & readable."* ([Game Developer interview](https://www.gamedeveloper.com/business/how-stacklands-uses-simplicity-to-create-a-compelling-card-based-village-builder))

- Deliberately skipping revision passes kept the art fast to produce at scale (needed for 200+ unique cards) *and* kept it visually uniform, since first-instinct sketches from one artist naturally share a consistent hand and level of detail.
- Sokpop's broader house style — minimalism, playful tone, systemic complexity emerging from simple visuals — is consistent across their whole catalog, which is part of why Stacklands reads as "a Sokpop game" on sight even to players unfamiliar with this specific title ([Visual Unity, Playful Spirit: The Sokpop Collective Way](https://www.gamedevpills.com/p/visual-unity-playful-spirit-the-sokpop)).

**Takeaway:** if you need a large content library (dozens/hundreds of unique items), an art brief that optimizes for *speed and consistency* over *individual polish* is a legitimate UX strategy — a uniform, slightly rough style often reads as more "readable" than a mix of highly detailed and rushed assets.

## 10. Sound as State Feedback, Not Decoration

The one specific audio beat called out in UX writeups on the game is the end-of-Moon feeding sequence: food cards move, get destroyed, and a **"crunchy" sound** plays in sync with a brief camera pan — the whole beat resolves in about one second ([JB Oger](https://jboger.substack.com/p/stacklands)).

- The sound isn't ambient texture — it's tied to a specific, mechanically important state change (resource consumed, Villager fed), giving the player an audio confirmation that a critical system just resolved correctly, without requiring them to read a status line.
- Keeping the sequence to roughly one second means it never interrupts the player's flow at a moment (turn transition) that repeats every single Moon for the entire run.

**Takeaway:** reserve distinct, memorable sound cues for state changes the player needs to track without looking (resource consumed, action completed, threshold crossed) — and keep those cues short enough that they don't become an interruption once the player has heard them hundreds of times.

## 11. UX Design Checklist for Your Own Game

Pulled from the patterns above — run through this when designing the interface layer of a new game idea, whatever its theme:

- [ ] **Single gesture, many verbs.** Is there one core interaction that could stand in for most of your different player actions, instead of a separate UI per system?
- [ ] **Fixed-position, low-density card/unit faces.** Are your always-visible data points limited to what players truly need every time, with everything else behind an on-demand reveal (hover/tap)?
- [ ] **One reusable "in progress" indicator.** Do you have a single feedback component (bar, glow, icon) that can attach to any object, rather than bespoke animations per system?
- [ ] **Hard rules use the same countable unit as everything else.** If you have a cap or limit, can players see they're over it using the same object type they already track, without needing a separate mental model?
- [ ] **Randomness borrows a familiar real-world object.** Does your RNG system map onto something players already trust the fairness of (a pack, a draw, a roll), rather than an invented abstract chance display?
- [ ] **Tutorial = first N rows of the real quest list.** Could your onboarding just be the actual progression system's opening steps, instead of a separate tutorial mode?
- [ ] **A persistent lookup panel exists once content passes ~15-20 items.** Is there an always-available reference so players aren't forced to memorize everything the interaction design surfaces?
- [ ] **Pausing supports planning, not just escaping.** Can players still think/rearrange/plan while paused, especially if your game runs on any kind of real-time clock?
- [ ] **Difficulty choices are front-loaded.** Are your major pace/difficulty settings presented once at the start of a run/session, rather than buried in a menu players have to remember exists?
- [ ] **Art brief optimizes for the content volume you actually need.** If you need a large content library, does your art style prioritize speed/consistency appropriately, rather than defaulting to maximum individual polish?
- [ ] **Sound cues are reserved for meaningful state changes.** Are your most memorable audio beats tied to mechanically important moments rather than spread evenly across ambient decoration?

## Sources

- [Stacklands and the UX of Cards — JB Oger, The Arcade Artificer (Substack)](https://jboger.substack.com/p/stacklands)
- [How Stacklands uses simplicity to create a compelling card-based village builder — Game Developer](https://www.gamedeveloper.com/business/how-stacklands-uses-simplicity-to-create-a-compelling-card-based-village-builder)
- [Visual Unity, Playful Spirit: The Sokpop Collective Way — Gamedev Pills](https://www.gamedevpills.com/p/visual-unity-playful-spirit-the-sokpop)
- [Quests — Stacklands Wiki (Fandom)](https://stacklands.fandom.com/wiki/Quests)
- [Stacklands — A Complete Guide to Every Quest — Half-Glass Gaming](https://halfglassgaming.com/2022/04/stacklands-a-complete-guide-to-every-quest-in-the-game/)
- [(Original) Stacklands Information — Steam Community Guide (keybinds, quest list)](https://steamcommunity.com/sharedfiles/filedetails/?id=2791179191)
- [Stacklands Review — Stack Me Up, Indie Game Reviewer](https://indiegamereviewer.com/stacklands-review-stack-me-up/)
- [Stacklands on Steam — official description and features](https://store.steampowered.com/app/1948280/Stacklands/)
