# ResponseChip

The small labels of the feedback loop: the response-time chip (awaiting, overdue, answered in N days) and the answer tag (accepted, rejected, testing).

**Provide:** for the time chip, the platform's derived state and day count; for the answer tag, the status and, for testing, the report-back date.

**States:** awaiting (`bg-marker`, `circle-dashed`); overdue (`bg-marker-strong`, `clock-alert`, «۵ روز گذشته از مهلت»); answered (no fill, `text-ink-muted`, `rotate-ccw-clock`, «پاسخ در ۳ روز», «پاسخ در همان روز»); accepted (`circle-check`); rejected (`circle-minus`); testing (`flask-conical`, «در حال امتحان · نتیجه تا ۲ آبان»); and on project cards, «بازخوردِ بی‌پاسخ دارد».

**Rules**
- `text-label`, weight 600, `rounded-sm`, padding `spacing-2` inline. Every chip has an icon and words; colour is never the only signal.
- The same state always has the same chip, everywhere.
- Never total these per person or per project, never turn them into a percentage, and never show them on a profile header.
