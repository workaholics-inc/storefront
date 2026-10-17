# FormField

A label, an optional hint, the control, and an error message, stacked; used for every input, textarea and select on the site.

**Provide:** a visible label, an optional hint, the value, `dir="ltr"` for values that are always Latin (URLs, handles, invite codes), and an error message from the platform's error code when validation fails.

**States:** default (`bg-sheet`, `border-rule-strong`), focus (2px `color-focus` outline, border in `color-focus`), error (`aria-invalid`, border `color-danger`, message under the control with `circle-alert`, linked by `aria-describedby`), disabled (`bg-sunken`, `text-ink-muted`).

**Rules**
- Inputs and selects are 44px tall; textareas start at 7.5rem and resize vertically. Text is `text-body`.
- Labels are always visible (`text-label`, weight 600). Never use a placeholder as the label. Mark optional fields «(اختیاری)» / "(optional)"; required is the default.
- The feedback composer is a textarea with a hint that asks for specifics («مشخص بنویس: چه دیدی، کجا گیر کردی، چه پیشنهادی داری.») and a primary «ارسال بازخورد» button.
- Dates use three selects (day, month, year) in the locale's calendar. Send ISO dates to the platform.
- No character counters. Normalise Persian and Arabic digits to Latin before sending.
