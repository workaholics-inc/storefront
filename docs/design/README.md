# Storefront design system

The storefront's design spec, exported from the maintainers' design board on 2026-10-17. Build pages from it; propose changes through an issue first, since maintainers keep this folder and the board in step.

| File | What |
|---|---|
| this README | Theme, principles, voice, colour, type, layout, icons, logo, product-rule guardrails |
| [persian-and-rtl.md](persian-and-rtl.md) | Direction, digits, Jalali dates, bidi, punctuation, ZWNJ |
| [tailwind-theme.md](tailwind-theme.md) | The Tailwind 4 theme for `src/app/globals.css` and the font loading |
| [tokens.json](tokens.json) | Every token with a usage note, light and dark |
| [components/](components/) | One README per component or page: what it needs from the API, its states, its rules. `components/bundle.css` is reference CSS for all of them: a spec, not a dependency |

Logo files are added here once the vector trace of the logo is approved.

---

Workaholics is a small, invite-only Persian-speaking community of people who build things. Members show unfinished work, give honest and specific feedback, and the owner answers every piece within 7 days: accepted, rejected or testing, always with a reason. This system styles the public storefront (Next.js 16, Tailwind CSS 4, next-intl), where Persian (`fa`, right to left) is the default and English (`en`) is second.

## The theme: چرک‌نویس, the scratch sheet

Every Iranian student knows two sheets: the چرک‌نویس, where you work things out, and the پاک‌نویس, the fair copy you hand in. Workaholics is the first sheet. The site looks like good scratch paper: a cool off-white page (`color-paper`), hairline rules (`color-rule`), the logo's ballpoint blue (`color-brand`), and a yellow highlighter (`color-marker`) that marks only what is still open. Nothing is polished for show, because the work on it isn't finished either.

### Principles

1. **Draft, not fair copy.** Text carries the page. No hero photos, no illustrations, no gradients, no decorative numbers. Hierarchy comes from Vazirmatn's weights and the type scale, not from boxes and colour.
2. **The loop is visible.** Every feedback item shows its state. An unanswered item has an empty answer slot with a dashed border (`.wh-slot`) and a highlighter chip. An answered item shows the answer, its reason and the giver's reply in one thread. The open loop is the most visible thing on a page; the closed loop is calm.
3. **Every answer is a full answer.** Accepted, rejected and testing get equal weight. Rejected is graphite (`color-rejected`), never red, because a reasoned no is a contribution. Red (`color-danger`) is only for system errors and invalid fields.
4. **Overdue is a fact, not an alarm.** "۵ روز گذشته از مهلت" sits on the item in a stronger highlighter (`color-marker-strong`) with a clock icon. It is never red, never totalled per owner, and never shown as a percentage.
5. **Everyone is on the same line.** No counts, scores, ranks, streaks, featured slots, follower numbers or badges for people. Names are plain text and every member gets the same card. Lists say how they are ordered ("به ترتیب زمان", "اول آن‌هایی که منتظر پاسخ‌اند").
6. **Light enough for a slow link.** One self-hosted variable font, inline SVG icons from a pinned package, and no third-party requests at runtime.

## Voice and content

- Write plain, direct Persian, the way the manifesto is written. Short sentences. No exclamation marks, emoji or hype ("فوق‌العاده", "بی‌نظیر").
- Address the member as **تو**, as equals do. Use the imperative for actions: «بازخورد بده», «پاسخ بده», «ورود». In English use "you" and sentence case.
- Name things the way members say them. These terms are fixed:

| fa | en | meaning |
|---|---|---|
| نصفه‌کاره | Work in progress | A post showing unfinished work (`kind: wip`) |
| به‌روزرسانی | Update | A post following the update template (`kind: update`) |
| بازخورد | Feedback | One piece of feedback on a post |
| صاحب کار، صاحبان پروژه | Owner, owners | The project's owners; only they answer |
| پاسخ | Answer | The owner's response to one piece of feedback |
| پذیرفته / نپذیرفته / در حال امتحان | Accepted / Rejected / Testing | The three answers |
| در انتظار پاسخ | Awaiting response | Derived: unanswered, within 7 days |
| ۵ روز گذشته از مهلت | 5 days overdue | Derived: unanswered, past 7 days |
| پاسخ در ۳ روز | Answered in 3 days | Derived: time from feedback to answer |
| نتیجه تا ۲ آبان | results by 24 Oct | The testing answer's report-back date |
| جواب | Reply | The giver's reply to an answer |
| عمومی / فقط اعضا | Public / Members only | Visibility |
| دعوت‌شده توسط | Invited by | The invitation tree on profiles |
| ایده / در حال ساخت / منتشر شده | Idea / Building / Launched | Project stage |

- Errors say what happened and what to do next, with no apology: «این کد دعوت معتبر نیست یا قبلاً استفاده شده. از کسی که دعوتت کرده کد تازه بخواه.»
- Never write a sentence that ranks, compares or counts people: no "پرکارترین اعضا" (most active members), no "۱۲ بازخورد داده" (gave 12 pieces of feedback).

## Colour

Use the tokens by role; never use a raw hex value in a component.

- Use `color-paper` for the page, `color-sheet` for anything raised (cards, posts, feedback, inputs), and `color-sunken` for wells inside a sheet (the "what feedback I want" panel, disabled controls).
- Set text in `color-ink`. Use `color-ink-muted` for names in bylines, dates, stage, hints and placeholders. Both reach 4.5:1 on paper, sheet and sunken in both themes.
- Use `color-brand` for the primary button fill (label in `color-on-brand`), the current-page underline and selected options. Use `color-link` for links. Never use `color-brand` for body-size text.
- Use `color-marker` only for an open loop: the awaiting chip, the "has unanswered feedback" chip, and one word in a page hero. Use `color-marker-strong` only for overdue.
- Use the answer pairs only on answer tags: `color-accepted` on `color-accepted-soft`, `color-rejected` on `color-rejected-soft`, `color-testing` on `color-testing-soft`. Each tag also carries an icon and a word, so colour is never the only signal.
- Use `color-danger` on `color-danger-soft` only for errors.
- `color-logo`, `color-logo-eye` and `color-logo-pupil` keep the mark identical in both themes.
- Dark theme: the same names are redefined (`[data-theme="dark"]`, or the OS preference when no theme is set). Components never need `dark:` utilities.

## Type

- Use one family, Vazirmatn Variable (`font-sans`), for Persian and Latin, loaded from the `vazirmatn` npm package. Use `font-mono` (system faces only) for error codes and handles in technical contexts.
- Use the scale through Tailwind's `text-*` utilities: `text-display`, `text-title-1`, `text-title-2`, `text-title-3`, `text-lead`, `text-body`, `text-small`, `text-label`. Each sets its own line height and weight.
- Persian needs more leading than Latin. The `text-*--line-height` defaults are Persian; on `<html lang="en">` the `leadingEn` values replace them (see the Tailwind section).
- Never letter-space, italicise or upper-case Persian. Emphasise with weight (`font-semibold`, 600). Keep English in sentence case too, so both locales look alike.
- 13px (`text-label`) is the smallest size. Keep running text inside `max-w-read` (42rem).
- Use `text-display` once per page at most: the home hero and nothing else. Below 640px it drops to `text-title-1`'s size.

## Space, layout, borders, radii, shadows

- Spacing is Tailwind's 0.25rem step. The steps in use are `spacing-1` to `spacing-6`, `spacing-8`, `spacing-12`, `spacing-16` and `spacing-24`; each token's note says where it goes.
- The page frame is `max-w-page` (72rem) with a `spacing-6` gutter (`spacing-4` on phones). Project and profile pages use a main column plus a `container-aside` (18rem) side column from 1024px; below that the aside follows the main column.
- Use logical properties only: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `border-s`, `text-start`. Never `left`, `right`, `ml-*` or `pl-*`.
- Separate with a `border-hairline` (1px) in `color-rule`. Borders of controls use `color-rule-strong`. A dashed `color-rule-strong` border means "empty, waiting to be filled": the answer slot and the empty states.
- Use `radius-sm` (4px) for buttons, inputs, chips and badges, `radius-md` (8px) for cards, posts, feedback and panels, and `radius-full` only for initials and timeline dots.
- Cards have no shadow. Use `shadow-float` only for things that float: the member menu, the phone nav sheet, dialogs.
- Focus: a 2px solid `color-focus` outline with a 2px offset on every interactive element. Never remove it.
- Motion: colour transitions of 120ms at most, and none under `prefers-reduced-motion`. Nothing animates on load.

## The timeline

A project page reads like a notebook. Entries hang from a margin line (`color-rail`, 2px) on the inline-start edge: the right in Persian, the left in English. Each entry has a dot with its kind icon, an absolute date, and the post. Newest is on top, and the list says so.

## Iconography

- Use `lucide-react@1.28.0`, pinned exactly. Never use an icon font or a CDN. The Icons card lists every icon in use and what it means.
- Draw icons at 20px beside body text and 16px in chips, with stroke 2 and `currentColor`. Mark decorative icons `aria-hidden`; give an icon-only button a visible-on-focus label.
- Mirror directional icons in RTL (`rtl:-scale-x-100`): arrows, reply, sign-in, send, external link.
- Never import thumbs-up, heart, star, sparkles, trophy, award, medal, crown, flame, trending-up, chart icons, vote arrows, rocket or any money icon.

## Logo

- The mark is the blue W with an eye: members see each other's work. Use the lockup (mark plus the lowercase wordmark "workaholics" in Vazirmatn 800) in the header, and the mark alone at 24px and below.
- The wordmark is Latin in both locales. The lockup never mirrors; in RTL it sits at the inline start (right).
- Keep clear space of half the mark's height on every side. Never recolour, stretch, outline or shadow it, and never place it on the highlighter or a photo.
- The social-post stickers (crown, stars, thumbs-up, "+1") are not part of the site.

## Guardrails from the product rules

- No number appears next to feedback, members, projects or posts. "Has unanswered feedback" is a yes-or-no chip, never "۳ بازخورد".
- No sort by anything but time and "awaiting response first". No "popular", "top", "trending" or "featured".
- Profiles show who invited the member and whom they invited, their projects and the feedback they gave with its state. They show no followers, totals or response rates.
- The Public badge appears only on what an owner made public. Members only appears only on a members-only post inside a public project.
- The storefront renders what the platform returns. Awaiting, overdue and "answered in N days" come from the platform's rules; the storefront never computes them.
- No prices, payment, pledge or investment wording or imagery anywhere.
