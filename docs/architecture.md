# Storefront architecture

How the public Workaholics website is built and how it talks to the platform. Written 2026-10-17.

## The split

Workaholics runs as two parts:

- **The storefront** (this repository, public, Apache-2.0): the website. Pages, components, translations, and a typed client for the platform API.
- **The platform** (operated by the community, not public): data, rules, authentication, moderation and notifications. It serves a versioned HTTP API under `/v1`.

The storefront knows the platform only through the API contract, an OpenAPI 3.1 document vendored at [`contract/openapi.json`](../contract/openapi.json). Every change to that file lands as a visible commit here, so anyone can see exactly what the platform exposes to the website.

```
Browser ──▶ storefront server (Next.js) ──▶ platform /v1 API
            holds the platform credential;      decides every permission;
            the browser never sees it           holds all data
```

## Requests

- Only the storefront's server talks to the platform. The browser talks only to the storefront.
- Every platform call carries:
  - `X-Storefront-Key`, the storefront's server credential, from server environment variables;
  - `X-Client-IP`, the end user's IP, so the platform's limits apply to people rather than to one server;
  - `Authorization: Bearer <session>`, when a member is signed in. The session token lives in an httpOnly cookie named `wh_session`.
- The platform authorizes everything. The storefront renders results and errors and never decides who may do what.
- Errors arrive as `{ "error": { "code": "...", "message": "..." } }`; the storefront maps codes to translated messages.

## Sign-in and sessions

- Members sign in with Telegram's OpenID Connect login (authorization code with PKCE). No Telegram script runs on the site.
  1. The sign-in page posts to `POST /auth/telegram`, which accepts posts only from the site's own origin. The route creates a random state and a PKCE verifier and keeps them, with the locale, the page to return to and any invite code, in the short-lived httpOnly cookie `wh_oidc` (path `/auth/telegram`, 10 minutes). Then it redirects to Telegram's authorization page.
  2. Telegram sends the member back to `GET /auth/telegram/callback` with a one-time code. The route checks the state against the cookie and forwards the code, the verifier, the callback URL and the invite code to the platform. The platform exchanges the code with Telegram and verifies who signed in; the bot's client secret lives only there.
  3. On success the route stores the platform's session token in `wh_session` and sends a newcomer to their profile editor, and everyone else to where they were going.
- `wh_session` is httpOnly, SameSite=Lax and Secure (unless `SITE_URL` is `http://`), and lasts 30 days. The proxy refreshes it on every page load (`GET` only), and the platform slides its own expiry.
- An expired session clears itself. A page redirects through `/auth/expired`; a form's server action deletes the cookie itself, because Next follows an action's redirect on the server and drops its cookies. Only the platform's `session_required` counts as expired; any other 401 is a configuration error.
- Sign-out is a `POST` to `/sign-out`, accepted only from the site's own origin. It revokes the session on the platform and clears the cookie, even when the platform cannot be reached.
- Every page except the home page, sign-in, the transparency page and the public views below requires a session. After sign-in, the site returns only to same-site paths.
- Server-only variables: `SITE_URL` (the site's public origin), `TELEGRAM_CLIENT_ID`, and optionally `TELEGRAM_AUTHORIZE_URL` and `TELEGRAM_BOT_USERNAME` (the same bot, written without the `@`; the notifications page links to it so members can turn on Telegram messages). Mock mode runs a stand-in for Telegram's authorization page, so the whole flow works locally.

## The practice pages

Added with milestone M2 (the feedback loop). Every page requires a session and follows `docs/design/`.

- `/projects/<slug>`: the project and its timeline of posts, newest first, with older posts on request. Owners get the link to a new post.
- `/projects/<slug>/posts/new` and `/projects/<slug>/posts/<id>/edit`: the post form, for work in progress (up to five questions, an optional self-critique) or an update (what changed, the feedback acted on, what was rejected and why, one number). The edit page works only while the platform says the post is editable.
- `/projects/<slug>/posts/<id>`: the thread. Telegram messages link here. The post, then its feedback filtered by All, Awaiting response or Answered, with no counts; forms to give feedback, answer it (owners) and reply; edits happen in place within the 15-minute window.
- `/me/awaiting`: feedback on the member's projects that still waits for their answer, oldest first.
- `/me/notifications`: the member's notifications. Opening one marks it read; there is also a button to mark all read. When private messages are off, the page links to the Telegram bot.
- `/members/<handle>`: the profile gains a section with the feedback that member gave and each item's current state.
- The member menu links to the two `/me` pages. Project lists are ordered by the latest activity, and project cards show the last post's date and whether feedback waits for an answer.

The platform computes every state shown here (awaiting, overdue, answered in N days, editable until); the storefront only words it.

## Public pages

Added with milestone M3 (the record). Members and visitors use the same addresses:

- `/projects/<slug>`, `/projects/<slug>/posts/<id>`, `/projects/<slug>/changelog`, `/projects/<slug>/cases` and `/projects/<slug>/cases/<id>`: a signed-in member sees the members' page. A visitor (no session cookie at all) sees the public view, read from the platform's `/v1/public/*` routes. When the platform says it is not public, the visitor is sent to sign-in, so a members-only address reveals nothing. A member whose session has expired goes through `/auth/expired` as before, never to the public view.
- Public views show only the owner's words: no feedback, answers, replies or names of givers, except names in a case after the giver consented.
- `/practice`: the transparency page with the community's monthly numbers and their rules (see `docs/rules.md`). It is the one page that shows numbers, and they are community-wide.
- `/badge/<slug>.svg`: a static badge image for public projects, served by the storefront after it checks the project is public, so browsers never call the platform. Owners of a public project see the embed snippet on its page.
- `/me/export`: downloads the member's data from the platform as a JSON file.
- Owners write and edit cases at `/projects/<slug>/cases/new` and `/projects/<slug>/cases/<id>/edit`; a credited member answers the naming question on the case page.

## Contract workflow

1. The platform generates its contract and publishes a new version of the file.
2. A maintainer runs `pnpm contract:pull <file>`, which replaces `contract/openapi.json` and regenerates `src/lib/api/schema.d.ts` with `openapi-typescript`.
3. The gate fails if the generated types and the vendored contract disagree.

API changes are requested through issues; contributors never edit the contract by hand.

## Mock mode

`pnpm dev:mock` starts a mock API generated from the contract's examples and points the site at it. Contributors can build and test every page without platform access or credentials.

## Language and layout

- Persian (`fa`) is the default locale and renders right to left; English (`en`) is second. Routing and messages use next-intl.
- Layout uses logical CSS properties so one stylesheet serves both directions.
- Dates for `fa` use the Persian (Jalali) calendar through `Intl`.
- The Vazirmatn font ships from an npm package; nothing loads from third-party servers.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, next-intl, openapi-typescript and openapi-fetch, vitest (at most 2 workers and, on Linux, pinned to cores 0 and 1 by `vitest.config.ts`), pnpm 12.

## Privacy

No analytics, trackers or third-party scripts. Members' work is visible only to members unless its owner makes it public; the storefront shows a public page only when the platform says the owner chose that.
