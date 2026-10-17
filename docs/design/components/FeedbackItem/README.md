# FeedbackItem

One piece of feedback with everything that happened to it: the giver's text, its response state, the owner's answer with its reason, and the giver's reply.

**Provide:** author, `created_at`, `body`, the post question it answers (optional), the derived state from the platform (`awaiting`, overdue days, or answered in N days), the current response (`status`, `reason`, `recheck_on`, responder, date), replies, and whether the viewer is an owner.

**States:** awaiting (marker chip, dashed empty answer slot «هنوز پاسخی ثبت نشده.»); overdue (stronger marker chip with `clock-alert`, same slot); owner's view of either (an «پاسخ بدهید» button in the slot, which opens the ResponseControl in place); answered accepted, rejected or testing (answer thread with the tag, reason, responder and date); with the giver's reply under the answer; giver's view after an answer (a quiet «جواب بدهید» button).

**Rules**
- The response-state chip sits at the inline end of the head row, opposite the byline.
- The answer and replies hang off a 2px `color-rule` line on the inline-start edge (`border-s-2`), indented `spacing-4`. This is the only place a coloured edge is used, and it is neutral.
- The empty slot is the open loop made visible. Never hide it, collapse it or replace it with a count.
- An answer is never styled as good or bad: accepted is not a success banner, rejected is not an error.
- When an answer changes, the platform keeps the history; show only the current answer here.
