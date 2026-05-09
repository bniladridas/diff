<!-- SPDX-License-Identifier: LicenseRef-DIFF -->

# Supabase GitHub Auth

DIFF uses Supabase Auth for application identity and a GitHub OAuth App for GitHub-backed sign-in. The current integration supports persisted user preferences, saved review state, pull request discussion comments, inline review comments, and review submission with the signed-in user's GitHub token.

For local development, set the frontend environment variables in `.env`:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The preference schema is required. Apply all migrations to the same Supabase project referenced by the local environment:

- [../../supabase/migrations/20260508_create_user_preferences.sql](../../supabase/migrations/20260508_create_user_preferences.sql)
- [../../supabase/migrations/20260508_extend_user_preferences_saved_state.sql](../../supabase/migrations/20260508_extend_user_preferences_saved_state.sql)
- [../../supabase/migrations/20260509_extend_user_preferences_graphite_theme.sql](../../supabase/migrations/20260509_extend_user_preferences_graphite_theme.sql)

The first migration creates `public.user_preferences`, enables row-level security, and limits reads and writes to the authenticated owner of each row. The second migration adds JSONB columns for recent repositories and saved pull requests. The third migration extends the theme constraint for the graphite theme.

On the GitHub side, create a GitHub OAuth App rather than a GitHub App. In Supabase, open `Authentication` and then `Providers`, expand the GitHub provider, and copy the callback URL shown there. The OAuth App in GitHub should use your app URL as the homepage URL and the Supabase callback URL as the authorization callback URL. Once the OAuth App is created, copy its client ID and client secret into the Supabase GitHub provider settings and save them.

Supabase also needs the application URLs registered under `Authentication` -> `URL Configuration`. At minimum, add `http://localhost:3000` for local development and the production origin you intend to deploy. The browser-side sign-in flow uses `signInWithOAuth({ provider: "github" })`, so the redirect target has to match the allowed redirect URL configuration in Supabase.

If DIFF is deployed on Vercel, add the production Vercel origin or custom domain to Supabase URL Configuration. If you want GitHub sign-in to work on preview deployments too, those preview origins also need to be allowed in Supabase, because the app uses the live browser origin as the OAuth `redirectTo` target.

The current GitHub write integration requests `repo`, `read:user`, and `user:email` scopes. DIFF now uses that token for pull request discussion comments, inline review comments, and review submission. The server validates the Supabase session first, then verifies that the GitHub provider token belongs to the same signed-in user before proxying write actions. This is still an OAuth-based model rather than a GitHub App installation model.

For repositories owned by an organization, the signed-in user must authorize the OAuth App and the organization may also need to approve that OAuth App under its third-party application access policy. If that approval is missing, read-only GitHub API calls can still work while write actions fail with GitHub OAuth App access restriction errors.

## Troubleshooting

If the app signs in successfully but shows a preferences sync error such as `public.user_preferences` missing from the schema cache, or a theme constraint error after switching themes, the Supabase project does not yet have the required schema. Apply the migrations listed above to the same project referenced by `VITE_SUPABASE_URL`, then refresh the app and sign in again if needed.

The browser e2e verifier supports authenticated runs by seeding a real Supabase session from the running app. In local development, sign in normally and use the dev bridge in the browser console:

```js
await window.__DIFF_E2E__.writeSessionFile()
```

That writes a validated session snapshot to `/tmp/diff-session.json`. Use that file with `DIFF_E2E_SESSION_FILE=/tmp/diff-session.json` when running `npm run check:e2e`. The verifier stores the Supabase session in the same browser storage key Supabase uses and stores the GitHub provider token in DIFF's own local storage key so the signed-in write path can be exercised safely.

For non-local environments where the dev bridge cannot write files, `DIFF_E2E_SESSION_JSON` can still be used with a full session snapshot, but the file path is preferred for local development because large session JSON is easy to truncate in shells and chat tools.

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

Use `COMMENT` as the first live review event because it verifies the review submit path without mutating approval state.

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
