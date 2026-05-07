## Repo Notes

Last updated: 2026-05-08

This repository now treats the release line as:

- `v0.1.0` Core Diff Engine
- `v0.1.1` Checks, Navigation & App Flow
- `v0.1.2` Theme Switch & UI Cleanup
- `v0.2.0` Review API & CI Surfaces

The in-app `Evolution` feed in `src/constants/updates.ts` should stay aligned with these tags and GitHub releases.

GitHub release automation is handled by `.github/workflows/release.yml` and requires `contents: write` so tag pushes can publish releases and upload `dist/*`.

Nightly prereleases are handled by `.github/workflows/nightly-prerelease.yml`.

- Scheduled runs stay dormant until the repo variable `ENABLE_NIGHTLY_RELEASES` is set to `true`.
- `workflow_dispatch` can be used to validate the prerelease flow without turning on the nightly schedule.
- Nightly prereleases are marked as prereleases and do not become the repo's latest stable release.
