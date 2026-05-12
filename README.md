<!-- SPDX-License-Identifier: LicenseRef-DIFF -->

<p>
  <img src="https://raw.githubusercontent.com/Coccinella-Labs/Coccinella-Labs.github.io/main/999KB.png" alt="DIFF logo" width="36" height="36">
</p>

# DIFF

DIFF is a small app for reading pull requests from GitHub. It keeps the changed files, comments, checks, and branch work close together.

You can browse pull requests and repository files, sign in with GitHub for write actions, sync your app state with Supabase, and use optional Gemini drafts for review fixes.

GitHub writes use the signed-in user's GitHub account. Signed-in users can publish reviews, edit files, create branches, open pull requests, update pull requests, manage labels, update branches, merge pull requests, and delete merged head branches.

Setup details live in these docs:

- [docs/auth/supabase-github.md](docs/auth/supabase-github.md) for Supabase and GitHub sign-in
- [supabase/migrations/20260508_create_user_preferences.sql](supabase/migrations/20260508_create_user_preferences.sql), [supabase/migrations/20260508_extend_user_preferences_saved_state.sql](supabase/migrations/20260508_extend_user_preferences_saved_state.sql), and [supabase/migrations/20260512_extend_user_preferences_ai_drafts.sql](supabase/migrations/20260512_extend_user_preferences_ai_drafts.sql) for the backing preference schema
- [.codex/README.md](.codex/README.md) for repo-local release and workflow notes

Authenticated browser checks are also covered in [docs/auth/supabase-github.md](docs/auth/supabase-github.md).

DIFF is not an official GitHub product or an official product of any repository owner whose data it reads. Keep local credentials private.
