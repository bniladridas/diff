<!-- SPDX-License-Identifier: LicenseRef-DIFF -->

# Supabase GitHub Auth

DIFF uses Supabase Auth for app identity and a GitHub OAuth App for GitHub sign-in. Signed-in users can sync preferences, save review state, publish reviews, edit or create Code view files, create branches, open PRs, update PR metadata, update branches, merge with merge/squash/rebase, and delete merged head branches.

For local development, set the frontend environment variables in `.env`:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=optional-gemini-api-key-for-draft-fixes
```

The preference schema is required. Apply all migrations to the same Supabase project referenced by the local environment:

- [../../supabase/migrations/20260508_create_user_preferences.sql](../../supabase/migrations/20260508_create_user_preferences.sql)
- [../../supabase/migrations/20260508_extend_user_preferences_saved_state.sql](../../supabase/migrations/20260508_extend_user_preferences_saved_state.sql)
- [../../supabase/migrations/20260512_extend_user_preferences_ai_drafts.sql](../../supabase/migrations/20260512_extend_user_preferences_ai_drafts.sql)

The migrations create `public.user_preferences`, enable row-level security, add saved state columns, include the available themes, and store saved AI drafts. `20260509_extend_user_preferences_graphite_theme.sql` remains in the repo only for existing migration history.

On GitHub, create an OAuth App, not a GitHub App. In Supabase, open `Authentication` -> `Providers`, expand GitHub, and copy the callback URL. Use your app URL as the OAuth homepage URL and the Supabase callback URL as the authorization callback URL. Then copy the OAuth client ID and secret back into Supabase.

Supabase also needs the application URLs registered under `Authentication` -> `URL Configuration`. At minimum, add `http://localhost:3000` for local development and the production origin you intend to deploy. The browser-side sign-in flow uses `signInWithOAuth({ provider: "github" })`, so the redirect target has to match the allowed redirect URL configuration in Supabase.

For Vercel, add the production Vercel origin or custom domain. Add preview origins too if preview sign-in should work.

The GitHub integration requests `repo`, `read:user`, and `user:email` scopes. The server validates the Supabase session, verifies the provider token belongs to the same GitHub user, then uses that token for signed-in private reads and requested write actions. This is an OAuth model, not a GitHub App installation model.

Gemini draft fixes are optional. When `GEMINI_API_KEY` is set, signed-in users can draft a review fix from a same-repo PR comment; the draft opens in Code view, syncs through Supabase until deleted, and still requires a manual commit.

For repositories owned by an organization, the signed-in user must authorize the OAuth App and the organization may also need to approve that OAuth App under its third-party application access policy. If that approval is missing, public or server-token reads may still work while signed-in private reads or write actions fail with GitHub OAuth App access restriction errors.

## Troubleshooting

If sign-in works but preference sync fails, the Supabase project likely does not have the required schema. Apply the migrations listed above to the project referenced by `VITE_SUPABASE_URL`, then refresh and sign in again if needed.

The browser e2e verifier can seed a real Supabase session from the running app. In local development, sign in normally and run this in the browser console:

```js
await window.__DIFF_E2E__.writeSessionFile()
```

That writes a session snapshot to `/tmp/diff-session.json`. Use it with `DIFF_E2E_SESSION_FILE=/tmp/diff-session.json` when running `npm run check:e2e`.

`DIFF_E2E_SESSION_JSON` can still be used with a full session snapshot, but the file path is safer for local work.

Recommended local flow:

1. In the browser console:

```js
await window.__DIFF_E2E__.writeSessionFile()
```

2. Validate the file:

```bash
python3 -c 'import json; s=open("/tmp/diff-session.json").read(); print("len:", len(s)); json.loads(s); print("json ok")'
```

3. Run the authenticated write pass:

```bash
export DIFF_E2E_SESSION_FILE=/tmp/diff-session.json
export DIFF_E2E_GITHUB_LOGIN=bniladridas
export DIFF_E2E_LIVE_COMMENT=1
export DIFF_E2E_LIVE_INLINE_REVIEW=1
export DIFF_E2E_LIVE_INLINE_RANGE=1
export DIFF_E2E_LIVE_REVIEW_EVENT=COMMENT
export DIFF_E2E_SKIP_SIGN_OUT=1
npm run check:e2e
```

Use `COMMENT` first because it verifies the review submit path without changing approval state.

Code view edit and create commits are also available as opt-in write checks. Run these only against sandbox files and branches you are comfortable mutating:

```bash
export DIFF_E2E_LIVE_CODE_COMMIT=1
export DIFF_E2E_CODE_COMMIT_OWNER=bniladridas
export DIFF_E2E_CODE_COMMIT_REPO=diff
export DIFF_E2E_CODE_COMMIT_PATH=docs/e2e-sandbox.md
npm run check:e2e
```

The check appends a timestamped marker and verifies it through the file content route.

New-file creation can be checked with a fresh path:

```bash
export DIFF_E2E_LIVE_CODE_CREATE=1
export DIFF_E2E_CODE_CREATE_PATH=docs/e2e-created.md
npm run check:e2e
```

Same-repo PR branch actions and fork guards can be checked with an existing PR:

```bash
export DIFF_E2E_PR_ACTION_OWNER=bniladridas
export DIFF_E2E_PR_ACTION_REPO=diff
export DIFF_E2E_PR_ACTION_NUMBER=1
npm run check:e2e
```

For a fork PR, also set `DIFF_E2E_PR_ACTION_EXPECT_FORK=1`; Code writes and Draft Fix should stay blocked. Set `DIFF_E2E_LIVE_DRAFT_FIX=1` only when you want the verifier to call Gemini for a real draft.

If the authenticated write checks fail with `Bad credentials`, the GitHub provider token is stale or revoked. Sign out in DIFF, revoke the GitHub OAuth grant if needed, sign in again, and regenerate the session snapshot before rerunning the verifier.

If private PR detail reads, inline review, or review submission fail with an OAuth App access restriction for an organization repository, approve the DIFF OAuth App in that GitHub organization, then sign out and sign back in so Supabase receives a fresh GitHub provider token.

For the anonymous fallback pass, run the verifier without a seeded session:

```bash
DIFF_E2E_NO_SESSION=1 npm run check:e2e
```

### Common operator mistakes

- Running browser JavaScript such as `prompt(...)` or `copy(...)` in `zsh` instead of the browser console.
- Using the manual `cat > /tmp/diff-session.json` fallback and forgetting to press `Control-D`, which leaves the shell waiting for more input.
- Closing a heredoc incorrectly when using `python3 - <<'PY'` style validation.
- Copying command text into the clipboard instead of the session JSON, which results in files starting with text like `pbpaste > ...` instead of `{`.
- Pasting large session JSON through intermediate chat or prompt previews, which can truncate the payload. Prefer the local file flow above.
