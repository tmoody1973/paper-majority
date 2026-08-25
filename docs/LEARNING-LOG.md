# Learning Log — Paper Majority

Dated entries. Each one answers three things: what we expected, what happened, what we
now believe. Claude drafts the technical entries; Tarik writes the retros in his own voice.

---

## 2026-08-24 — Phase 1, Tasks 1–4

### The plan's own numbers did not add up, and that was useful

**Expected:** the implementation plan would be internally consistent, and building it
would be transcription.

**Happened:** the interaction-spike fixture is over-subscribed by exactly one card type.
Eight slots, eight rule-required roles, plus a required district deadline card. Nothing
fits. It only surfaced when the fixture was written out card by card and counted.

**Now believe:** a spec that names counts in two different places will eventually
contradict itself, and only construction finds it. The fix is not to pick silently —
it is to build the version that protects the *measurement*, and declare the number that
slipped. See `docs/decisions/005-a-ninth-card-for-the-district-deadline.md`.

### A test that passed was testing the wrong thing

**Expected:** "drag a card, assert it moved" would be a trivial check.

**Happened:** the drag dropped onto a neighbouring card, so the card stacked rather than
moved, and its position legitimately did not change. The test failed for a reason that
had nothing to do with dragging being broken — dragging worked fine.

**Now believe:** on a dense board, "empty space" is a real thing a test has to compute,
not assume. More generally: when a test fails, the first question is whether it is
measuring what its name claims.

### The measurement moved the design

**Expected:** the 100 ms pickup-feedback budget was a formality; the code said 90 ms.

**Happened:** measured in a real browser, first visible movement took **111.6 ms** —
over budget. The tween was configured for 90 ms, but nothing moved until the tween's
first frame. The constant said one thing; the player's eye got another.

**Now believe:** never report a timing budget from a constant. The fix — lift the card in
the same frame as the press, tween the rest — took one line and dropped it to **2.6 ms**.
That is a genuinely better feel that reading the config would never have found.

### Node 26 broke jsdom's localStorage

**Expected:** `environment: 'jsdom'` gives a working browser storage API.

**Happened:** Node 26 ships its own `localStorage` global, disabled unless a flag is
passed. Vitest skips copying any jsdom key that already exists on `globalThis`, so
Node's dead accessor shadowed jsdom's working one.

**Now believe:** each new Node major can quietly claim a global that a test environment
was providing. Worth remembering the shape of this bug — it will happen again with a
different global.

---

## Template for future entries

### <short title>

**Expected:**

**Happened:**

**Now believe:**
