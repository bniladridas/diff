## Repo Notes

This repository now treats the release line as:

- `v0.1.0` Core Diff Engine
- `v0.1.1` Checks, Navigation & App Flow
- `v0.1.2` Theme Switch & UI Cleanup
- `v0.2.0` Review API & CI Surfaces

The in-app `Evolution` feed in `src/constants/updates.ts` should stay aligned with these tags and GitHub releases.

GitHub release automation is handled by `.github/workflows/release.yml` and requires `contents: write` so tag pushes can publish releases and upload `dist/*`.
