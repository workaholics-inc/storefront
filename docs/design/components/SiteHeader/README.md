# SiteHeader

The top bar on every page: the lockup at the inline start, the main nav, then the language link and either Sign in or the member menu at the inline end.

**Provide:** the current locale, the current section (`projects`, `members`, `rules`, `manifesto` or none), and the signed-in member's display name, or nothing when signed out.

**States:** signed out (nav without Members, a secondary small Sign in button); signed in (adds Members, shows initials and name with a chevron that opens the member menu: My page, Awaiting my answer, Notifications, the other language, Sign out); phone (below 48rem, nav, language and name collapse into a menu button that opens a `shadow-float` sheet).

**Rules**
- 64px tall (56px on phones), `bg-paper`, a `border-hairline` bottom in `color-rule`. It is not sticky; pages are short and text-first.
- The current page link gets `aria-current="page"`, `text-ink`, weight 600 and a 2px `color-brand` underline. Other links are `text-ink-muted`.
- The language link is always the other language's own name: «English» on fa pages, «فارسی» on en pages, with `lang` set on the link.
- The lockup is a link to home and never mirrors. Initials are the first letter of the display name; there are no photos in M1.
- Never put a notification count, a dot badge or a "new" marker in the header. Notifications are reached from the member menu, which looks the same whether or not anything is unread.
