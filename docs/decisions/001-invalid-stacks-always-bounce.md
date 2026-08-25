# 001 — In Phase 1, a combination that does not work always bounces

- **Decision** — Any card combination the rules do not recognise is refused and separates. There is no "just pile these two together" in the interaction spike.

- **Why this came up** — The implementation plan says the engine should accept "an active pattern **or** an allowed organizational stack". But the Checkpoint 1 gate also requires that an invalid stack visibly bounces. Those two pull in opposite directions: if any pile is allowed, nothing ever bounces, and the gate cannot measure whether players understand which combinations are real.

  What is at stake: the whole point of the ten-minute test is to find out whether people can *read* the rules. If every drop succeeds, we learn nothing and we find out too late — after building 30 cards on top of it.

- **Options**
  1. **Allow free piling anywhere.** Feels forgiving, but the gate's central question becomes unmeasurable, and a crowded desk turns into an undifferentiated heap.
  2. **Refuse everything that is not a rule (chosen).** Clear feedback every time. Costs the player a tidying tool they will eventually want.
  3. **Build filing zones now** so piling has a designated home. Correct end state, but it is Task 7 work pulled into Task 4 — scope the checkpoint does not ask for.

- **What we chose and why** — Option 2, by Claude, as a build-time reading of a plan conflict. A refusal costs the player nothing: no resource, no time, no lost progress. So the strictness is safe to experiment against, which is exactly the behaviour the gate wants to observe.

- **What we gave up** — Players cannot deliberately group cards for their own tidiness during the spike. On a crowded desk that will feel like a missing feature, and some testers will try it and be told no. That is a real cost, not a neutral one.

- **How we will know if this was right** — In the ten-person playtest: does anyone try to stack two unrelated cards *for organisation* rather than to test a rule, and does the refusal read as a bug to them? If more than two of ten do, filing zones move earlier.

- **What actually happened** —
