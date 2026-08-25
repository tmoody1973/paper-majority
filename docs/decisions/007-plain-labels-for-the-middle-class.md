# 007 — "Derived context" is now "Based on records"

- **Decision** — Rename the middle information class from **Derived context** to
  **Based on records**. The internal identifier stays `derived`.

- **Why this came up** — Every card carries one of three badges saying where its
  content came from. Two of them read plainly. The middle one did not.

  "Derived context" is two abstract nouns. It is not congressional vocabulary, not
  legal vocabulary, and not anything a person says out loud — we coined it. So unlike
  *Constituency* or *Provision*, which are real words worth teaching, this one taught
  a newcomer nothing at all. It just looked like it meant something.

  What is at stake: the whole civic-integrity promise rests on players being able to
  tell real information from invented information at a glance. A label nobody can
  parse defeats that.

- **Options**
  1. **Keep it and always gloss it.** The badge stays opaque; the explanation lives
     elsewhere. Works only where there is room for the gloss.
  2. **Rename to "Based on records" (chosen).** Plain, short enough for a card badge,
     and it keeps the grounding — this content *is* derived from cited sources.
  3. **Rename to "Worked out".** Plainer still, but it drops the link to a source and
     drifts toward sounding like guesswork.

- **What we chose and why** — Option 2, by Tarik. The three labels now read as a ladder
  of distance from the source, which is exactly the distinction the game needs a player
  to hold:

  | Badge | Meaning |
  |---|---|
  | **Official record** | The actual record |
  | **Based on records** | Someone worked it out from the record |
  | **Simulated** | Invented for this run |

  Only the display label changed. `SourceClass` is still `'derived'`, so the icon kit,
  the asset manifests, saved games and every checksum are untouched.

- **What we gave up** — Two published documents now disagree with older copies of
  themselves, and anyone who read the earlier spec has stale vocabulary. Both approved
  specifications, the plan, the playtest guide and the family-colour mockup were
  updated in the same change, with a dated note in the art specification, so the drift
  is visible rather than silent.

- **How we will know if this was right** — Playtest measure 4 asks testers to name a
  card's information class without opening anything. If people can say "based on
  records" and roughly what it means, it worked. If they still shrug, the badge needs a
  different fix — probably shape and icon doing more work, not more words.

- **What actually happened** —
