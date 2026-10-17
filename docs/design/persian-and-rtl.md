# Persian and right to left

Persian is the default locale. These rules apply to every page and component.

## Direction

- Set `lang` and `dir` on `<html>`: `lang="fa" dir="rtl"` or `lang="en" dir="ltr"`. Never set direction on individual components; logical properties do the mirroring.
- Wrap every piece of user-supplied text that can be in either script in `<bdi>`: member names, handles, project names, link text, and "Workaholics" inside Persian sentences. Without it, a Latin name at the end of a Persian sentence pulls its punctuation to the wrong side.
- Give inputs whose value is always Latin `dir="ltr"`: URLs, handles, invite codes, email. Leave free-text inputs and textareas to inherit the page direction.
- Mirror directional icons only: arrows, reply, sign-in, send, external link. Never mirror the logo, the check, the clock or the flask.
- In the board's FeedbackItem and Post cards, the fa and en panes are the same markup with only `lang` and `dir` changed. If a component needs a different structure per direction, it is wrong.

## Digits and numbers

- In `fa`, show every number in Persian digits (۰۱۲۳۴۵۶۷۸۹) by formatting through `Intl.NumberFormat("fa-IR")` or next-intl's `format.number`. Never mix Latin and Persian digits in one locale.
- In `en`, use Latin digits.
- Accept Persian and Arabic digits in every input and normalise them to Latin before sending to the platform: invite codes, dates, anything numeric. Members type on Persian keyboards.
- Plurals go through ICU messages (next-intl). English needs "1 day" and "3 days"; Persian uses the singular noun after a number («۳ روز»).

## Dates

- `fa` uses the Persian (Jalali) calendar: `new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric" })` gives «۲۵ مهر ۱۴۰۵». Drop `year` for dates in the current Persian year («۱۴ مهر»).
- `en` uses `new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })`, giving "17 Oct 2026", day first like the Persian form.
- Show absolute dates on the record (posts, feedback, answers, the timeline). Durations come from the platform's rules and read as facts: «پاسخ در ۳ روز», «۵ روز گذشته از مهلت».
- Date inputs: browsers' native date pickers do not support the Jalali calendar. For the testing answer's report-back date, offer quick picks (a week, two weeks, a month, each showing its date) and, for another date, three selects (day, month, year) in the locale's calendar. Always send the platform an ISO date (`2026-10-24`).
- The platform sends UTC times. Format every date in `Asia/Tehran` in both locales, so a post never shows one date in fa and another in en.

## Text

- Use Persian punctuation in `fa`: «» for quotes, ، for the comma, ؛ for the semicolon, ؟ for the question mark.
- Preserve the zero-width non-joiner (U+200C, نیم‌فاصله) exactly as typed: «می‌شود», «نصفه‌کاره», «پروژه‌ها». Never strip it in trimming, slugs or search. Normalise Arabic ي and ك to Persian ی and ک when comparing or searching.
- Never apply `letter-spacing`, `italic` or `uppercase` to Persian. Vazirmatn has no italic; a synthetic slant breaks the joins.
- Sort Persian names with `Intl.Collator("fa")`, not by code point.
- Keep running text within `max-w-read` (42rem, about 70 Persian characters at body size) and `text-wrap: pretty` for paragraphs, `balance` for headings.
