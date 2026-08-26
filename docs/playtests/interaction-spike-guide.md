# How to run the Paper Majority playtest

**For:** anyone running a session. You do not need to know anything about the game,
about Congress, or about how the game was built.

**Time:** about 15 minutes per person. Ten people.

**What you need:** a laptop, a browser, a quiet-ish room, and this document.

> **New to this?** Read [what-this-test-is.md](./what-this-test-is.md) first — five
> minutes, plain English, explains what the ten-minute run actually contains, what the
> test is for, and what it is deliberately *not* for.

---

## The one-page version

If you read nothing else, read this.

| | |
|---|---|
| **The question** | Can a stranger work out the rules by trying things — and does it feel good? |
| **Open** | `http://127.0.0.1:3001/?fixture=interaction-spike` — press **Cmd+Shift+R** (or **Ctrl+Shift+R** on Windows) before each new tester, so the cards reset |
| **Say** | *"You run a congressional office. Drag cards together."* Nothing more. |
| **Show** | Drag **Policy Aide** onto **Rent Burden Report**. Once. Don't explain it. |
| **Then** | Hand over the mouse. Say nothing for ten minutes. Don't rescue them. |
| **Write** | What they do, and what they say out loud, word for word. |
| **Ask** | The six questions in Part 6, in order, word for word. |

**The six things you're measuring:**

1. Can they guess which other pairs of cards will work?
2. Do they find rules on their own, without opening the **Staff Handbook** — the button
   at the top right that lists rules they have already found?
3. After they study **Bipartisan Working Group** — a card that teaches their office a
   new way of working — can they say what it changed?
4. Can they tell what kind of card something is at a glance, and whether it is real
   information or invented for the game?
5. When something goes wrong, do they blame something they saw on the desk, or just a
   number going down?
6. Do they want to play again?

**The one thing with no score:** watch for the moment they stop guessing and reach for
a specific card on purpose.

Everything below is the detail behind those seven lines.

---

## Part 1 — What is this thing?

### The game, in three sentences

**Paper Majority** is a card game about being a new member of Congress. You drag
cards around a desk, put them together to get new cards, and try to build a housing
bill that other members of Congress will support — before you run out of time,
staff, and the patience of the people back home.

It is not finished. What you are testing is a ten-minute slice of it.

### What a "slice" means here

The finished game will have about 77 different cards and last 45–60 minutes.

What exists today has **eight** kinds of card and takes about ten minutes. There is no
sound, the artwork is placeholder rectangles, and most of the game is missing on
purpose.

That is not laziness. It is the point of this test.

---

## Part 2 — Why this test exists

### The question

Everything in this game rests on one idea: **the player figures out the rules by
trying things.**

Nobody tells you "a staffer plus a housing report makes a summary." You try it, it
works, and now you understand a rule you can use again with *different* cards.

If that feels good, the game works and it is worth building the other 68 cards.

If it feels random or confusing, then adding 68 more cards makes a confusing game
bigger. Every card after that is built on a broken foundation.

**So the whole question is:**

> Can a stranger work out the rules by experimenting — and does doing that feel good?

Not "is it pretty." Not "is it finished." Not "did they win."

### Why ten people and not two

Two people can both happen to be confused, or both happen to be sharp. Ten is enough
to tell the difference between "this is hard to read" and "that one person was
distracted."

### What happens with the results

If the scores clear the bar, the team builds the next 30 cards.

If they don't, the team changes the wording, the hints, and the feedback — and runs
this test again. Nothing new gets built on top until it passes.

That is the only reason this test exists. It is a gate, not a survey.

---

## Part 3 — Before your first session

### Start the game

Open a terminal and paste this:

```
npm --prefix /Users/tarikmoody/projects/paper-majority/web run dev -- --hostname 127.0.0.1 --port 3001
```

Leave that window open. It has to keep running the whole time.

Then open a browser to:

```
http://127.0.0.1:3001/?fixture=interaction-spike
```

> **Note on the port number.** Something else on this machine already uses the usual
> port (3000). If you see a different app, check you typed **3001**.

### Check it looks right before a tester sits down

You should see:

- A bar across the top: **LEGISLATIVE WEEK 1**, **YOUR OFFICE — Democratic**, and six
  numbers (Staff Attention, Political Capital, District Trust, Bill Momentum, Policy
  Integrity, Staff Morale)
- **Twelve cards** on a beige desk, in three rows
- A panel on the right headed **Your office**
- Below that, a box headed **What the words mean**, already open

If any of that is missing, stop and get it fixed. Do not run a session on a broken build.

### Two things the game does that you should know about

**Resting the mouse on a card explains it.** The right-hand panel changes to describe
whatever card the pointer is over — what it is, where its content came from, and what
the office has learned to do with it. Move the mouse off the desk and the office brief
comes back. Clicking a card pins it open.

**The words explain themselves.** That **What the words mean** box lists every card
family, every badge and every number in plain English. It is always on screen. You do
not have to explain any vocabulary — and you shouldn't.

### Reset between testers

Press **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows). That reloads the page and
puts every card back. Every tester must start from the same board or you cannot
compare their answers.

### Ask permission

Before you start, say something like:

> "I'm testing a game, not you. There are no wrong moves. I'm going to write down
> what you do and say. Nothing has your name on it. Stop any time."

If you want to record audio or video, ask first and accept a no.

---

## Part 4 — Running a session

### Step 1 — Say exactly this, and nothing more

> **"You run a congressional office. Drag cards together."**

That is the whole briefing. Resist adding to it.

### Step 2 — Show one thing, once

Drag the **Policy Aide** card onto the **Rent Burden Report** card.

They snap together. A green bar appears at the bottom of the card. After the tester
presses **Resume**, the bar fills over about six seconds, and an **Evidence Summary**
card appears.

Do that once. Do not explain what happened.

### Step 3 — Hands off

Give them the mouse. Then stop talking for ten minutes.

This is the hard part. You will want to help. Don't.

**Do not:**
- point at anything
- mention the Staff Handbook
- explain what a card does
- say "try the other one"
- react when they get something right
- rescue them when they get stuck

**A stuck tester is the most useful data in the whole test.** If four people get stuck
in the same place, you have found the thing that needs fixing. If you rescue them, you
have found nothing.

The only thing you may say is: *"There's no wrong move — just try things."*

**The right-hand panel will keep changing as they move the mouse.** That is the game
explaining cards to them, not a glitch. Let it happen — learning the vocabulary is
allowed. What is *not* allowed is you explaining it.

### Step 4 — Watch and write

Keep the worksheet (`interaction-spike-results.md`) open and write as you go. Do not
trust your memory — by tester four they blur together.

Write down what they **say out loud**, word for word where you can. "Oh, so it's the
kind of card that matters" is worth more than any score.

### Step 5 — Ask the questions

When they stop, or when ten minutes is up, ask the questions in Part 6. In that order.
Word for word.

---

## Part 5 — What is supposed to happen

You do not need to know the rules to run the test. But you need to know what "going
well" looks like so you can see when it isn't.

There are three rules to find, and one method to learn.

| # | What works | What you get |
|---|---|---|
| 1 | A **Policy Aide** with **any housing evidence** — either the Rent Burden Report or the Tenant Survey | An **Evidence Summary** |
| 2 | An **Evidence Summary** with the **Housing Choice Voucher** | A **Drafted Provision** — actual bill language |
| 3 | The **Working Bill** with the **Hillcrest** member office | An **Outreach Result** — their answer |

Then the thing the whole test is really about:

| The method | What it changes |
|---|---|
| Drag a **Policy Aide** onto **Bipartisan Working Group** and wait about 8 seconds | Rule 3 now also accepts the **Ridgeline** office |

### Why Ridgeline is refused at first

The player is a **Democrat** (it says so in the top bar). Hillcrest is a Democrat —
same party, so rule 3 accepts it. Ridgeline is a Republican — the other party, so it
bounces off.

Studying **Bipartisan Working Group** widens rule 3 to accept the other party too.

**This is the single most important thing the test measures.** The player is supposed
to end up understanding that a *rule got wider* — not that they "unlocked" something.

### The chain stops at Drafted Provision

Rule 2 makes a **Drafted Provision** — the card says *"Bill language — end of the chain."*
There is nothing more to do with it in this practice run.

That is deliberate. The finished game has a step for adding a provision to your bill;
the ten-minute slice does not. Hovering the card says so.

Testers *will* try to drag it onto the Working Bill. It bounces. That is correct — but
note it if they seem annoyed, because it is the most natural thing to try.

### Three things that are meant to happen, and are not bugs

- **Cards that don't go together bounce apart.** That is correct. It costs the player
  nothing — no time, no resources. Experimenting is meant to be free.
- **Nothing progresses until they press Resume.** The game starts paused. If a card
  is stuck at zero progress, the top bar says so in bold.
- **The Drafted Provision has nowhere to go.** See above — end of the chain, on purpose.

### If something looks genuinely broken

Write down exactly what happened and carry on if you can. Do not debug in front of the
tester. Note it in the free-notes box.

---

## Part 6 — The six things you are measuring

Ask these in order. Write the answers down.

---

### 1. Can they guess what else will work?

**When:** right after your one demonstration, before they do anything.

**Ask:** *"Name three other pairs of cards you think will work."*

| | |
|---|---|
| ✅ **Good** | "The other report with the aide?" — they spotted the *kind* of card |
| ❌ **Bad** | "The aide and the bill?" — random guessing, or copying your example |

**Why it matters:** this is the difference between learning a rule and memorising one
example. The whole design depends on the first.

**Bar:** 8 of 10 get all three right.

---

### 2. Do they find rules without help?

**When:** just watch. No question.

**Write down:** whether they opened the **Staff Handbook** button, and at what point.

| | |
|---|---|
| ✅ **Good** | Tries things, gets two rules working, opens the Handbook late or never |
| ❌ **Bad** | Opens the Handbook in the first thirty seconds because nothing worked |

**Why it matters:** the Handbook is a safety net. If everyone needs it immediately, the
cards are not readable on their own.

**Bar:** 7 of 10 find two rules before opening it.

---

### 3. Do they understand what the method changed?

**When:** after they study **Bipartisan Working Group**.

**Ask:** *"What changed?"*

| | |
|---|---|
| ✅ **Good** | "I can talk to the other party now" — they understand a *rule* got wider |
| ❌ **Bad** | "I unlocked something" — they think they got a key |

**Why it matters:** this is the heart of the design. A key opens one door. A wider rule
changes what is possible everywhere. If people hear "unlock," the design has failed at
the thing it is trying to be.

**Also write down:** did they find Study Tactic on their own? Did they go back and retry
the office that refused them?

**Bar:** 8 of 10 explain it as a rule change.

---

### 4. Can they read a card at a glance?

**When:** near the end.

> **Do this first, or the answer is handed to them.** Ask them to move the mouse off
> the desk — down to the bottom of the screen, or onto the right-hand panel. The panel
> must be showing **Your office**, not a card. Then point at a card *with your finger,
> not the cursor*.

**Ask:** *"What kind of card is this? And is that a real fact, or made up for the game?"*

| | |
|---|---|
| ✅ **Good** | "It's Evidence, and it says Official Record" — read off the card itself |
| ❌ **Bad** | They move the mouse onto it, or click it, before they can answer |

**Why it matters:** on a crowded desk, players must read cards at a glance. Also — this
game mixes real public information with invented story, and it must always be obvious
which is which.

**The in-game key is not cheating here.** It explains what "Evidence" *means*. It does
not tell them which family *this* card is. Reading the card and then checking the key
is exactly what it is for.

**Also write down:** whether they had been using the hover panel a lot during play.
That is allowed and expected — it just must not be the only way they can answer.

**Bar:** 9 of 10 get both.

---

### 5. Do they blame a card, or a number?

**When:** after something goes against them. The clearest one: if they take the
**Ridgeline** office's counteroffer, their **Policy Integrity** number drops — they
traded away part of what they promised to get the other party on board. Running out of
staff is the other one.

**Ask:** *"What caused that?"*

| | |
|---|---|
| ✅ **Good** | "I took their amendment to get their vote" / "both my aides were busy" — something they *saw* |
| ❌ **Bad** | "Policy Integrity went down" — that is the symptom, not the cause |

**Why it matters:** if setbacks only ever show up as numbers dropping, the game feels
arbitrary and unfair. Every bad thing is supposed to be traceable to something visible
on the desk.

**Bar:** 8 of 10 name a card, a deadline, or an unfinished job.

---

### 6. Do they want another go?

**When:** last question.

**Ask:** *"Want to run it again?"*

| | |
|---|---|
| ✅ **Good** | "Yes — I want to try the survey instead this time" |
| ❌ **Bad** | A polite yes with no reason, or a no |

**Why it matters:** a yes with a reason means they have a plan. That is the clearest
sign the rules landed.

**Bar:** 7 of 10 say yes.

---

## Part 7 — The thing to watch for that has no score

Somewhere in the ten minutes, watch for **the click**.

It looks like this: the tester stops dragging things at random, pauses, and then
reaches deliberately for one specific card.

That is the moment they stopped guessing and started reasoning. Write down when it
happened — or that it never did.

If most people get there inside ten minutes, the design works. If nobody does, no
amount of extra content will fix it.

Also listen for the sounds people make. **"Oh!"** is the one you want. **"Huh?"** three
times in a row is the one you don't.

---

## Part 8 — After all ten

Fill in the tally at the bottom of `interaction-spike-results.md`.

| Result | What happens next |
|---|---|
| **All six bars cleared** | Build the next 30 cards |
| **Any bar missed** | Change wording, hints and feedback. Run this test again. Build nothing new. |

Then write the decision and *why*, in your own words, in the box at the bottom. That
paragraph matters more than the numbers — the numbers say what happened, your
paragraph says what you think it means.

---

## Part 9 — Words testers might ask about

The game already shows all of this in the **What the words mean** box, on screen the
whole time. This table is here so *you* are not caught out, and for questions asked
**after** the session — not during it.

| Word | Plain answer |
|---|---|
| **Staff Attention** | How many jobs your office can do at once. It comes back when a job finishes. |
| **District Trust** | How well the people back home think you are representing them. |
| **Bill Momentum** | How much your bill is actually moving. |
| **Policy Integrity** | How close your bill still is to what you promised. |
| **Staff Morale** | How your staff are holding up. |
| **Official record** | Real public information from a real source. |
| **Based on records** | Someone worked this out or summarised it from real information. Not a direct quote. |
| **Simulated** | Invented for your run. Not a claim about anyone real. |
| **Member office** | Another representative's office, whose support you need. |
| **Tactic** | A way of working your office can learn, which changes a rule for the rest of the term. |

### Two honesty notes, if anyone asks

- **Hillcrest and Ridgeline are not real people.** Nobody in this test is a real
  member of Congress. The district is invented too. Real member offices come later,
  from official public records, and will be clearly labelled.
- **The artwork is placeholder.** Flat rectangles with icons. Real illustrations are a
  later stage, deliberately held back until this test passes.

---

## Part 10 — If something goes wrong

| Problem | What to do |
|---|---|
| Fewer than 12 cards | Hard-reload. If still wrong, stop and report it. |
| Page won't load | Check the terminal window is still running. Restart the command in Part 3. |
| Wrong app appears | You are on port 3000. Use **3001**. |
| Cards won't drag | Hard-reload. If still stuck, stop and report it. |
| Nothing happens after stacking | The clock is paused. Press **Resume**. This is expected. |
| A card bounced off | Usually correct — those two do not go together. Free, no penalty. |

Report anything you stop for. A broken session is still worth writing down; just mark
it as broken so it does not get counted as a real result.
