import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function isMissingUserPreferencesTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message?.includes("public.user_preferences") === true
  );
}

function isMissingAiDraftsColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    (error.code === "PGRST204" || error.code === "42703") &&
    message.includes("ai_drafts") &&
    (message.includes("does not exist") || error.code === "PGRST204")
  );
}

export type ThemePreference = "dark" | "midnight" | "grey" | "graphite";

export interface RecentRepoPreference {
  owner: string;
  repo: string;
  last_viewed_at: string;
}

export interface SavedPullPreference {
  owner: string;
  repo: string;
  pull_number: number;
  title: string;
  html_url: string;
  state: string;
  draft: boolean;
  saved_at: string;
}

export interface AiDraftPreference {
  id: string;
  owner: string;
  repo: string;
  pull_number: number;
  pull_title: string;
  branch: string;
  path: string;
  comment_id: number;
  comment_body: string;
  original_content: string;
  draft_content: string;
  summary: string;
  updated_at: string;
}

export interface UserPreferencesRow {
  user_id: string;
  theme: ThemePreference | null;
  default_repo_owner: string | null;
  default_repo_name: string | null;
  recent_repos?: RecentRepoPreference[] | null;
  saved_pulls?: SavedPullPreference[] | null;
  ai_drafts?: AiDraftPreference[] | null;
  updated_at?: string | null;
}

export async function fetchUserPreferences(userId: string) {
  if (!supabase) return { data: null, error: null };

  const result = await supabase
    .from("user_preferences")
    .select(
      "user_id, theme, default_repo_owner, default_repo_name, recent_repos, saved_pulls, ai_drafts, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<UserPreferencesRow>();

  if (!isMissingAiDraftsColumnError(result.error)) return result;

  const fallback = await supabase
    .from("user_preferences")
    .select(
      "user_id, theme, default_repo_owner, default_repo_name, recent_repos, saved_pulls, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<UserPreferencesRow>();

  if (fallback.data) {
    return {
      data: { ...fallback.data, ai_drafts: [] },
      error: fallback.error,
    };
  }

  return fallback;
}

export async function upsertUserPreferences(
  userId: string,
  preferences: {
    theme?: ThemePreference;
    default_repo_owner?: string;
    default_repo_name?: string;
    recent_repos?: RecentRepoPreference[];
    saved_pulls?: SavedPullPreference[];
    ai_drafts?: AiDraftPreference[];
  },
) {
  if (!supabase) return { data: null, error: null };

  const payload: Record<string, unknown> = {
    user_id: userId,
  };

  if (preferences.theme !== undefined) {
    payload.theme = preferences.theme;
  }

  if (preferences.default_repo_owner !== undefined) {
    payload.default_repo_owner = preferences.default_repo_owner;
  }

  if (preferences.default_repo_name !== undefined) {
    payload.default_repo_name = preferences.default_repo_name;
  }

  if (preferences.recent_repos !== undefined) {
    payload.recent_repos = preferences.recent_repos;
  }

  if (preferences.saved_pulls !== undefined) {
    payload.saved_pulls = preferences.saved_pulls;
  }

  if (preferences.ai_drafts !== undefined) {
    payload.ai_drafts = preferences.ai_drafts;
  }

  const result = await supabase.from("user_preferences").upsert(
    payload,
    { onConflict: "user_id" },
  );

  if (!isMissingAiDraftsColumnError(result.error) || preferences.ai_drafts === undefined) {
    return result;
  }

  delete payload.ai_drafts;
  return supabase.from("user_preferences").upsert(
    payload,
    { onConflict: "user_id" },
  );
}
