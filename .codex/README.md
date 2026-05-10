## Repo Notes

Last updated: 2026-05-10

Release line:

- `v0.4.0` Live Code Workspace
- `v0.3.5` Sign-In Trust Update
- `v0.3.4` Sign-In & Check Polish
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

Keep `src/constants/updates.ts` aligned with tags and GitHub releases.

Keep a compact `Next` entry at the end of the in-app `Updates` feed. When bumping, move completed work into the released version entry and leave `Next` as a light holding place for the next pass.

Keep update and release-note copy calm, compact, and non-pushy. Prefer maintenance-style wording such as "polish", "cleanup", "quieter", or "more consistent" when accurate; avoid marketing-heavy phrasing for routine fixes.

`VERSION` and `package.json` must match for each release.

Release tags use `v`-prefixed SemVer. Example: tag `v0.4.0`, version `0.4.0`.

Each stable tag needs a matching release branch at the same commit. Example: `release/0.4.0` points at `v0.4.0`.

When bumping a release, update all version-bearing release files together:

- `package.json`
- `package-lock.json`
- `VERSION`
- `src/constants/updates.ts`
- `.codex/README.md`
- `scripts/generate-release-notes.ts` examples and error text
- `docs/workflows.md` release examples

After bumping, run `node --import tsx ./scripts/generate-release-notes.ts vX.Y.Z /tmp/diff-release-notes.md` and confirm it compares the previous release tag to the new tag.

Supabase auth expects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the local environment.

Supabase GitHub login in this repo uses a GitHub OAuth App, not a GitHub App. The callback URL registered in GitHub must be the Supabase auth callback for the project.

Per-user app state syncs through `public.user_preferences`. Related migrations:

- `supabase/migrations/20260508_create_user_preferences.sql`
- `supabase/migrations/20260508_extend_user_preferences_saved_state.sql`
- `supabase/migrations/20260509_extend_user_preferences_graphite_theme.sql`

GitHub writes use the Supabase GitHub provider token with `repo read:user user:email` scopes. The write path covers PR discussion comments, inline review comments, review submission, and single-file Code view commits.

The browser verifier runs anonymous coverage without a seeded session. For authenticated checks, use `window.__DIFF_E2E__.writeSessionFile()` in dev mode, then run with `DIFF_E2E_SESSION_FILE=/tmp/diff-session.json`. `DIFF_E2E_SESSION_JSON` remains available when a file cannot be used.

If a seeded e2e run skips `signed-out-fallback`, that is expected. Snapshot seeding rehydrates auth on reload; full signed-out reload verification still needs a manual or OAuth-driven path.

`npm run check:app` treats authenticated preference and write checks as optional unless `DIFF_REQUIRE_AUTH_CHECKS=1` is set with `DIFF_SUPABASE_ACCESS_TOKEN` and `DIFF_GITHUB_PROVIDER_TOKEN`.

`npm run check:e2e` keeps live write actions opt-in. Code view commit verification requires `DIFF_E2E_LIVE_CODE_COMMIT=1` and `DIFF_E2E_CODE_COMMIT_PATH`. Use a sandbox file because it creates a real GitHub commit.

Live pull refresh uses `/api/live` WebSockets on a long-running Node server. Serverless deployments fall back to timed HTTP refresh. `npm run check:app` includes a local `live-channel` assertion.

Code view uses `/api/repo/tree` and `/api/repo/content`. Signed-in file commits use `PUT /api/repo/content` with the current file SHA and an explicit commit message. `npm run check:app` covers these routes.

The previous planned items are now part of `v0.4.0`.

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
