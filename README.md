# Workaholics storefront

The public website of **Workaholics**, a peer community of makers built on one practice: show your work while it is still unfinished, give each other honest feedback, and answer the feedback you get.

> Build things. Share them. Help each other.

This repository is the storefront: pages, components and translations (Persian first, right to left; English second). It holds no data and no secrets. Everything it shows comes from the Workaholics platform API, described by the contract in [`contract/openapi.json`](contract/openapi.json). The platform itself is operated by the community and is not part of this repository.

## Principles the code follows

- **No scores.** No votes, likes, follower counts, karma, leaderboards or editorial picks. Work is listed by recency, and by whether the owner has answered the feedback on it.
- **Owners answer feedback.** Every piece of feedback shows whether the owner accepted it, rejected it or is testing it, with a reason, or how long it has been waiting.
- **Members' work is private by default.** An owner decides what becomes public.
- **No money.** The site does not take payments or rank anything by money.
- **Rules are public.** Every rule the platform computes is explained in [docs/rules.md](docs/rules.md).

## Running it

You need Node.js 24 and pnpm 12. The app arrives with milestone M0. Until then, see [docs/architecture.md](docs/architecture.md).

```bash
pnpm install --frozen-lockfile
pnpm dev:mock     # runs the site against a mock API generated from the contract
```

You do not need access to the platform to work on the storefront: mock mode serves the contract's examples.

## Contributing

Contributions are welcome. Every commit must be signed off under the [Developer Certificate of Origin](https://developercertificate.org/) (`git commit -s`). See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security issue, see [SECURITY.md](SECURITY.md).

## Licence and name

The code is licensed under the [Apache License 2.0](LICENSE). The licence does not grant rights to the Workaholics name or logo; please do not present a fork as Workaholics.
