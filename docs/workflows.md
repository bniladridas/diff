<!-- SPDX-License-Identifier: LicenseRef-DIFF -->

# GitHub Automation

This repository uses GitHub Actions for validation and release work.

## Workflows

- `workflows/typescript-check.yml`
  Runs the baseline validation on pushes to `main` and pull requests:
  - dependency install
  - `npm run lint`
  - workflow YAML lint
  - `pre-commit` hooks

- `workflows/app-check.yml`
  Runs the app-level read-only verification on pull requests and manual dispatch:
  - starts the local app server
  - runs `npm run check:app`
  - runs `npm run check:e2e`

  This workflow is intentionally read-only. It does not seed a Supabase user session and does not publish live GitHub comments or reviews.

- `workflows/release.yml`
  Builds and publishes a GitHub release when a `v*` tag is pushed.

- `workflows/nightly-prerelease.yml`
  Builds and publishes nightly prereleases. Scheduled runs stay dormant until the repo variable `ENABLE_NIGHTLY_RELEASES` is set to `true`.

## Notes

- Release publishing requires `contents: write`.
- The app checks use `GITHUB_TOKEN` for GitHub API reads. If the default workflow token is not sufficient for the repo targets DIFF is reading, move that workflow to a dedicated secret-backed token.
- Authenticated browser flows, live PR comments, inline review comments, and review submission are verified manually or through local seeded `check:e2e` runs, not in default CI.
