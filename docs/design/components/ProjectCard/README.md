# ProjectCard

One project in a list: name, one-liner, owners, stage, the date of the last post, and whether any feedback is waiting for an answer.

**Provide:** `name`, `one_liner`, owner display names, `stage` (`idea`, `building`, `launched`), the last post's date, `visibility`, and a boolean "has unanswered feedback" from the platform.

**States:** members-only (no label: it is the default); public (the Public badge at the inline end of the title row); has unanswered feedback (the marker chip «بازخوردِ بی‌پاسخ دارد» in the footer); hover (border to `color-rule-strong`).

**Rules**
- `bg-sheet`, `border border-rule`, `rounded-md`, padding `spacing-5` (`spacing-6` from 40rem). No shadow, no image, no cover.
- The whole card is one link (the title link stretched over the card) with the focus ring drawn around the card.
- Never show a number on the card: no feedback count, no member count, no "views". The unanswered chip is yes or no.
- In a list that only holds public work (the visitor's home), drop the Public badge; it would be on every card.
- Lists of cards are ordered by the last post's date, newest first, and say so.
