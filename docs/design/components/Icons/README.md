# Icons

The icon set: lucide-react 1.28.0, pinned, with one meaning per icon and a list of icons the site never uses.

**Provide:** import each icon by name from `lucide-react` and render it at 20px (16px in chips) with `strokeWidth={2}`, `aria-hidden` when it sits beside text, and `rtl:-scale-x-100` when it is directional.

**Rules**
- Use only the icons in this card, each for the meaning it lists. Adding an icon means adding it here first.
- Never use thumbs, hearts, stars, sparkles, trophies, medals, crowns, flames, trend arrows, charts, vote arrows, rockets or any money icon.
- The design board keeps SVG copies of these icons (ISC licence) for design tools; the storefront imports them from the package.

## The icons

Sizes: 20px beside body text, 16px in chips and small text; stroke 2; colour from `currentColor`. Decorative icons get `aria-hidden`; an icon on its own gets a label.

| lucide name | Meaning |
|---|---|
| `circle-dashed` | Awaiting response: the loop is still open |
| `clock-alert` | Overdue: past the 7-day window |
| `rotate-ccw-clock` | Answered in N days |
| `circle-check` | Accepted |
| `circle-minus` | Rejected |
| `flask-conical` | Testing |
| `eye` | Public |
| `lock` | Members only |
| `calendar` | Report-back date |
| `file-pen-line` | Work-in-progress post |
| `file-diff` | Update post |
| `message-square-text` | Give feedback |
| `reply` | Reply (mirrors in RTL) |
| `plus` | New post or project |
| `log-in` | Sign in (mirrors in RTL) |
| `send` | Sign in with Telegram (mirrors in RTL) |
| `key-round` | Invite code |
| `languages` | Switch language |
| `menu` | Open the phone menu |
| `x` | Close |
| `chevron-down` | Member menu |
| `arrow-left` | Back (mirrors in RTL) |
| `arrow-right` | Continue (mirrors in RTL) |
| `external-link` | Link leaves the site (mirrors in RTL) |
| `rotate-cw` | Try again; busy spinner |
| `inbox` | Empty list |
| `circle-alert` | Error |
| `cloud-off` | Platform unreachable |
| `user` | Profile |
| `users` | Members |
| `scroll-text` | Manifesto and rules |

**Never import:** thumbs-up, thumbs-down, heart, star, sparkles, trophy, award, medal, crown, flame, trending-up, chart-*, arrow-big-up, arrow-big-down, badge-check, rocket, dollar-sign, coins, wallet, credit-card, banknote, piggy-bank, hand-coins, gem.
