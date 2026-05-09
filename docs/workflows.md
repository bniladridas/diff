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
  - dependency install
  - `npm run lint`
  - Playwright Chromium install
  - starts the local app server
  - runs `npm run check:app`
  - runs `npm run check:e2e`

  This workflow is intentionally read-only. It does not seed a Supabase user session and does not publish live GitHub comments or reviews.

- `workflows/release.yml`
  Builds and publishes a GitHub release when a `v*` tag is pushed. The release generator validates that the tag is a `v`-prefixed Semantic Versioning 2.0.0 value, such as `v0.3.2`, `v1.0.0`, or `v1.0.0-rc.1`.
  - dependency install
  - `npm run lint`
  - `npm run build`
  - generates release notes from `src/constants/updates.ts`
  - publishes `dist/*` with the generated release body

- `workflows/nightly-prerelease.yml`
  Builds and publishes nightly prereleases. Scheduled runs stay dormant until the repo variable `ENABLE_NIGHTLY_RELEASES` is set to `true`.
  - computes a nightly tag and title
  - dependency install
  - `npm run lint`
  - `npm run build`
  - publishes `dist/*` as a prerelease without marking it latest

## Notes

- Release publishing requires `contents: write`.
- Git tags use the common `v` prefix, but the semantic version is the value after `v`. For example, `v0.3.2` is the tag name and `0.3.2` is the SemVer value.
- While DIFF is in `0.y.z`, releases are still initial-development releases. PATCH versions are used for fixes and narrow refinements, MINOR versions are used for larger backward-compatible additions, and prerelease identifiers such as `-rc.1` may be used before a stable cut.
- The app checks use `GITHUB_TOKEN` for GitHub API reads. If the default workflow token is not sufficient for the repo targets DIFF is reading, move that workflow to a dedicated secret-backed token.
- Authenticated browser flows, live PR comments, inline review comments, and review submission are verified manually or through local seeded `check:e2e` runs, not in default CI.
