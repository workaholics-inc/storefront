# Contributing to the Workaholics storefront

Thank you for helping. This repo is the public website of a small peer community, so the bar is the same one members hold each other to: show the work early, explain your reasoning, and answer review comments.

## Sign off every commit (DCO)

We use the [Developer Certificate of Origin 1.1](https://developercertificate.org/). By signing off you certify that you wrote the change, or otherwise have the right to submit it under this project's licence (Apache-2.0). You keep the copyright in your contribution.

Add the sign-off with `git commit -s`, which appends a line like:

```
Signed-off-by: Your Name <you@example.com>
```

Use a name and email you are willing to have public. Pull requests with unsigned commits fail the DCO check. To fix one, run `git commit --amend -s` (or `git rebase --signoff main` for several commits) and push again.

## Before you open a pull request

1. Open or pick an issue first, so we can agree on the approach.
2. Work against mock mode (`pnpm dev:mock`). You do not need platform access.
3. Run `pnpm gate` (typecheck, lint, tests, contract drift check) and make it pass.
4. Keep Persian (`fa`, right to left) and English (`en`) strings in sync. Use logical CSS properties (`ms-*`, `pe-*`, `start`, `end`) rather than left and right.
5. Do not add analytics, trackers, third-party fonts, CDNs or scripts. Everything ships from this site.

## What we will not merge

- Votes, likes, follower counts, karma, leaderboards, rankings or "featured" picks.
- Payment, pledge or fundraising features.
- Secrets, keys or anything that only works with a private credential in the browser.
- Changes to the API contract (`contract/openapi.json`). The contract is synced from the platform by maintainers; open an issue to request an API change.

## Code of conduct

Be the kind of reviewer you want on your own unfinished work: specific, honest, kind about the person and direct about the work.
