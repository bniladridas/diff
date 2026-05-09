## Repo Notes

Last updated: 2026-05-10

This repository now treats the release line as:

- `v0.3.3` Branch History & Mobile Annotations
- `v0.3.2` Mobile Review Navigation
- `v0.3.1` State & Interface Refinements
- `v0.3.0` Supabase Auth & User State
- `v0.2.2` Mobile History & Changelog Polish
- `v0.2.1` History, Checks & Navigation Refinements
- `v0.2.0` Review API & CI Surfaces
- `v0.1.2` Theme Switch & UI Cleanup
- `v0.1.1` Checks, Navigation & App Flow
- `v0.1.0` Core Diff Engine

The in-app `Updates` feed in `src/constants/updates.ts` should stay aligned with these tags and GitHub releases.

The root `VERSION` file should stay aligned with `package.json` for each release.

Release tags must be `v`-prefixed Semantic Versioning 2.0.0 values. The tag is written as `v0.3.3`; the semantic version is `0.3.3`.

Each stable release tag should also have a matching release branch at the same commit. Use `release/X.Y.Z` for the branch name and point it at `vX.Y.Z`; for example, `release/0.3.3` points at the same commit as `v0.3.3`.

Supabase auth expects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the local environment.

Supabase GitHub login in this repo uses a GitHub OAuth App, not a GitHub App. The callback URL registered in GitHub must be the Supabase auth callback for the project.

Per-user app state currently syncs through `public.user_preferences`, defined in `supabase/migrations/20260508_create_user_preferences.sql`, extended in `supabase/migrations/20260508_extend_user_preferences_saved_state.sql`, and updated for the graphite theme constraint in `supabase/migrations/20260509_extend_user_preferences_graphite_theme.sql`.

The current GitHub write path uses the Supabase GitHub provider token with `repo read:user user:email` scopes and covers pull request discussion comments, inline review comments, and review submission.

The authenticated browser verifier uses `window.__DIFF_E2E__` in dev mode. Prefer `writeSessionFile()` to write `/tmp/diff-session.json` and run with `DIFF_E2E_SESSION_FILE=/tmp/diff-session.json`; `DIFF_E2E_SESSION_JSON` remains available when a file cannot be used.

If a seeded e2e run skips `signed-out-fallback`, that is expected. Snapshot seeding is meant to rehydrate auth on reload, so full signed-out reload verification still requires a manual or OAuth-driven session path.

The strongest local verification sequence before release is:

```bash
npm run lint
pre-commit run --show-diff-on-failure --color=always --all-files
npm run check:app
npm run check:e2e
```

GitHub release automation is handled by `.github/workflows/release.yml` and requires `contents: write` so tag pushes can publish releases and upload `dist/*`.

Nightly prereleases are handled by `.github/workflows/nightly-prerelease.yml`.

- Scheduled runs stay dormant until the repo variable `ENABLE_NIGHTLY_RELEASES` is set to `true`.
- `workflow_dispatch` can be used to validate the prerelease flow without turning on the nightly schedule.
- Nightly prereleases are marked as prereleases and do not become the repo's latest stable release.
