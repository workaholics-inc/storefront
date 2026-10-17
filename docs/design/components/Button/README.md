# Button

Three variants carry every action: primary (one per view, the thing the page is for), secondary, and quiet (inline actions such as Reply).

**Provide:** a label (a verb: «ثبت پاسخ», «بازخورد بده», "Post answer"), the variant, an optional size `sm`, an optional leading icon, and `disabled` or `aria-busy` when relevant.

**States:** default, hover (`color-brand-hover` for primary, `bg-sunken` for secondary, underline for quiet), keyboard focus (2px `color-focus` ring, 2px offset), disabled (`bg-sunken`, `text-ink-muted`, `color-rule` border), busy (spinning `rotate-cw` icon and a label ending in «…», e.g. «در حال ثبت…»).

**Rules**
- Height 40px (`sm` 32px), `rounded-sm`, label `text-body` weight 600. Icons sit at the inline start and are 20px; directional ones mirror in RTL.
- Primary is `bg-brand text-on-brand`. Secondary is `bg-sheet text-ink border border-rule-strong`. Quiet is `text-link` with no border.
- Use a link (`<a>`) styled as a button for navigation and a `<button>` for actions.
- There is no destructive (red) button in M1. Nothing on the site is deleted with one click.
