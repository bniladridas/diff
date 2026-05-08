export interface AppUpdate {
  version: string;
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'fix' | 'planned';
  details: string[];
}

export const APP_UPDATES: AppUpdate[] = [
  {
    version: "0.3.0",
    title: "Supabase Auth & User State",
    description: "Added sign-in, saved user state, authenticated review actions, and auth checks.",
    category: "feature",
    details: [
      "GitHub sign-in with Supabase",
      "Saved theme and default repo",
      "Recent repos and saved pull requests",
      "PR discussion comments with user auth",
      "Inline review comments and review decisions",
      "Server-side Supabase validation for write actions",
      "Authenticated shell and app checks"
    ]
  },
  {
    version: "0.2.2",
    title: "Mobile History & Changelog Polish",
    description: "Cleaned up mobile tabs and the updates surface.",
    category: "fix",
    details: [
      "Mobile tabs read cleanly on narrow screens",
      "History and checks alignment cleanup",
      "Local tags synced with the release line"
    ]
  },
  {
    version: "0.2.1",
    title: "History, Checks & Navigation Refinements",
    description: "Improved timeline behavior, checks, and diff navigation.",
    category: "fix",
    details: [
      "Timeline cleanup and duplicate-event fixes",
      "Checks split out from review",
      "Single-line and range diff highlights",
      "Quieter checks and modal UI"
    ]
  },
  {
    version: "0.2.0",
    title: "Review API & CI Surfaces",
    description: "Added deeper review data, checks, and timeline views.",
    category: "feature",
    details: [
      "Review API and timeline integration",
      "Checks, annotations, and CI run detail views",
      "Markdown and embedded HTML fixes"
    ]
  },
  {
    version: "0.1.2",
    title: "Theme Switch & UI Cleanup",
    description: "Added theme controls and cleaned up the interface.",
    category: "improvement",
    details: [
      "Theme switching across interface surfaces",
      "Lower-noise presentation pass"
    ]
  },
  {
    version: "0.1.1",
    title: "Checks, Navigation & App Flow",
    description: "Improved repo flow and added deeper GitHub integration.",
    category: "feature",
    details: [
      "GitHub checks integration",
      "Navigation and app-flow improvements"
    ]
  },
  {
    version: "0.1.0",
    title: "Core Diff Engine",
    description: "Foundational review interface.",
    category: "feature",
    details: [
      "Pull request listing and filtering",
      "Branch comparison and review surface",
      "Foundational diff viewer",
      "Mobile-responsive adaptive layout"
    ]
  },
  {
    version: "Next",
    title: "Planned Features",
    description: "Next steps for the platform.",
    category: "planned",
    details: [
      "Live updates via WebSockets",
      "Global full-text search across diffs",
      "Repository-wide code exploration"
    ]
  }
];
