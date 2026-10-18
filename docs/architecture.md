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
- Every page except the home page and sign-in requires a session. After sign-in, the site returns only to same-site paths.
- Server-only variables: `SITE_URL` (the site's public origin), `TELEGRAM_CLIENT_ID`, and optionally `TELEGRAM_AUTHORIZE_URL`. Mock mode runs a stand-in for Telegram's authorization page, so the whole flow works locally.

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

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, next-intl, openapi-typescript and openapi-fetch, vitest (at most 2 workers), pnpm 12.

## Privacy

No analytics, trackers or third-party scripts. Members' work is visible only to members unless its owner makes it public; the storefront shows a public page only when the platform says the owner chose that.
