<!-- SPDX-License-Identifier: LicenseRef-DIFF -->

# Supabase GitHub Auth

DIFF uses Supabase Auth for app identity and a GitHub OAuth App for GitHub-backed sign-in. Signed-in users can sync preferences, save review state, publish review actions, and commit Code view file edits.

For local development, set the frontend environment variables in `.env`:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The preference schema is required. Apply all migrations to the same Supabase project referenced by the local environment:

- [../../supabase/migrations/20260508_create_user_preferences.sql](../../supabase/migrations/20260508_create_user_preferences.sql)
- [../../supabase/migrations/20260508_extend_user_preferences_saved_state.sql](../../supabase/migrations/20260508_extend_user_preferences_saved_state.sql)
- [../../supabase/migrations/20260509_extend_user_preferences_graphite_theme.sql](../../supabase/migrations/20260509_extend_user_preferences_graphite_theme.sql)

The migrations create `public.user_preferences`, enable row-level security, add saved state columns, and allow the graphite theme.

On GitHub, create an OAuth App, not a GitHub App. In Supabase, open `Authentication` -> `Providers`, expand GitHub, and copy the callback URL. Use your app URL as the OAuth homepage URL and the Supabase callback URL as the authorization callback URL. Then copy the OAuth client ID and secret back into Supabase.

Supabase also needs the application URLs registered under `Authentication` -> `URL Configuration`. At minimum, add `http://localhost:3000` for local development and the production origin you intend to deploy. The browser-side sign-in flow uses `signInWithOAuth({ provider: "github" })`, so the redirect target has to match the allowed redirect URL configuration in Supabase.

For Vercel, add the production Vercel origin or custom domain. Add preview origins too if preview sign-in should work.

The GitHub write integration requests `repo`, `read:user`, and `user:email` scopes. The server validates the Supabase session, verifies the provider token belongs to the same GitHub user, then proxies the requested write action. This is an OAuth model, not a GitHub App installation model.

For repositories owned by an organization, the signed-in user must authorize the OAuth App and the organization may also need to approve that OAuth App under its third-party application access policy. If that approval is missing, read-only GitHub API calls can still work while write actions fail with GitHub OAuth App access restriction errors.

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

Code view commits are also available as an opt-in write check. Run this only against a sandbox file and branch you are comfortable mutating:

```bash
export DIFF_E2E_LIVE_CODE_COMMIT=1
export DIFF_E2E_CODE_COMMIT_OWNER=bniladridas
export DIFF_E2E_CODE_COMMIT_REPO=diff
export DIFF_E2E_CODE_COMMIT_PATH=docs/e2e-sandbox.md
npm run check:e2e
```

The check appends a timestamped marker and verifies it through the file content route.

If the authenticated write checks fail with `Bad credentials`, the GitHub provider token is stale or revoked. Sign out in DIFF, revoke the GitHub OAuth grant if needed, sign in again, and regenerate the session snapshot before rerunning the verifier.

If inline review or review submission fails with an OAuth App access restriction for an organization repository, approve the DIFF OAuth App in that GitHub organization, then sign out and sign back in so Supabase receives a fresh GitHub provider token.

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
