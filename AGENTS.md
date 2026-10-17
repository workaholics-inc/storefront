# AGENTS.md: workaholics-inc/storefront

Public repo, Apache-2.0. The storefront is the Workaholics website. It renders what the platform API returns and holds no data, secrets or business rules of its own. Read [docs/architecture.md](docs/architecture.md) and [docs/rules.md](docs/rules.md) before changing anything.

## This is not the Next.js you know

The app uses Next.js 16, which has breaking changes against older versions (for example `middleware.ts` became `proxy.ts`). Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices. Do the same for next-intl's installed version.

## Layout

```
contract/openapi.json     Vendored platform contract. Never edit by hand; updated by `pnpm contract:pull`.
src/app/[locale]/         App Router pages. fa (default, rtl) and en.
src/i18n/                 next-intl routing and request config.
src/lib/api/              Generated types (schema.d.ts) and the server-only platform client.
messages/fa.json, en.json UI strings. Keep both in sync.
```

## Rules

- **Server-only platform access.** Only server code (server components, route handlers, server actions) calls the platform, through `src/lib/api/client.ts`, which imports `server-only`. Never expose `PLATFORM_URL` or `STOREFRONT_API_KEY` to the browser, and never create a `NEXT_PUBLIC_` variable holding a secret.
- **Forward the end user's IP** as `X-Client-IP` on every platform call, and send the member session from the `wh_session` cookie as `Authorization: Bearer <token>`.
- **No authorization here.** The platform decides who may do what; the storefront only renders the result and the platform's errors.
- **Persian first.** `fa` is the default locale with `dir="rtl"`. Use logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start`, `end`), never left and right. Render dates for `fa` with the Persian calendar via `Intl`.
- **Nothing from third parties at runtime.** No CDNs, analytics, external fonts or scripts. Fonts come from npm packages and ship with the site.
- **Product rules.** No votes, likes, follower counts, karma, rankings or featured picks; no payment features. See the README.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev:mock                 # site + mock API from the contract (once M0 lands)
pnpm gate                     # typecheck + lint + tests + contract drift check
pnpm exec vitest run <path>   # scoped tests
```

## Dependencies

pnpm 12 rejects packages published less than a day ago. Pin a release at least two days old, then prove it with a fresh `pnpm install --frozen-lockfile`.

## Commits

Every commit is signed off under the DCO: `git commit -s`.

## Never

- Commit secrets, real member data or private platform details.
- Edit `contract/openapi.json` by hand, or `docs/`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`: maintainers own them.
