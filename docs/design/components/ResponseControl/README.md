# ResponseControl

The owner's answer to one piece of feedback: choose accepted, rejected or testing, write the reason, and for testing say when you'll report back.

**Provide:** the feedback id, the giver's first name (for the hint), today's date in both calendars for the quick picks, the submit handler, and the platform's error code on failure.

**States:** nothing chosen (submit disabled), accepted or rejected chosen (reason field), testing chosen (reason plus the report-back date: a week, two weeks, a month, or another date with three selects), missing reason (error under the textarea: «دلیل را بنویسید. پاسخ بدون دلیل ثبت نمی‌شود.»), posting (busy button), posted (a status notice «پاسخ ثبت شد. آرش خبردار می‌شود و می‌تواند جواب بدهد.» and the answer in its final form).

**Rules**
- A `<fieldset>` with a legend; the three options are real radio inputs in a radiogroup, each with its icon, verb and a one-line meaning taken from the public rules.
- The selected option gets `bg-brand-soft` and a 2px `color-brand` border. The options themselves keep their answer colours so they match the tags they produce.
- The reason is always required. The report-back date is required for testing only.
- The order is fixed: accepted, rejected, testing. Never preselect one.
- There is no "dismiss", "later" or "snooze". Nothing closes automatically.
