<!-- SPDX-License-Identifier: LicenseRef-DIFF -->

# DIFF

DIFF is a focused interface for reading pull requests without the surrounding noise of hosted forge UIs. It pulls repository data from GitHub, keeps review context close to the diff, and uses a compact workspace with a resizable navigation panel and a single review surface.

The app is a React frontend with Tailwind styling and a small Node server for GitHub API access. It supports live review refresh with HTTP fallback, Code view repository browsing, Supabase-backed user state, and GitHub-backed sign-in for authenticated review actions.

Authenticated GitHub writes require the signed-in user's GitHub OAuth approval. Organization repositories may also require OAuth App approval. Signed-in users can publish reviews, commit Code view edits, create branches, open PRs, and update PR metadata.

Setup and operational detail live in dedicated docs:

- [docs/auth/supabase-github.md](docs/auth/supabase-github.md) for Supabase and GitHub OAuth configuration
- [supabase/migrations/20260508_create_user_preferences.sql](supabase/migrations/20260508_create_user_preferences.sql), [supabase/migrations/20260508_extend_user_preferences_saved_state.sql](supabase/migrations/20260508_extend_user_preferences_saved_state.sql), and [supabase/migrations/20260509_extend_user_preferences_graphite_theme.sql](supabase/migrations/20260509_extend_user_preferences_graphite_theme.sql) for the backing preference schema
- [.codex/README.md](.codex/README.md) for repo-local release and workflow notes

The authenticated browser e2e flow is documented in [docs/auth/supabase-github.md](docs/auth/supabase-github.md), including how to seed a real Supabase session into `npm run check:e2e`.

DIFF is a specialized browser-based code review tool and is not an official product of any repository owner whose data it reads. Users are responsible for their own environment configuration and any sensitive credentials used during local development.
