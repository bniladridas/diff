export interface AppUpdate {
  version: string;
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'fix' | 'planned';
  details: string[];
}

export const APP_UPDATES: AppUpdate[] = [
  {
    version: "0.5.0",
    title: "Code Branches",
    description: "Branch, edit, and open PRs from Code view.",
    category: "feature",
    details: [
      "Create working branches and PRs",
      "Edit PR title, body, and labels",
      "Syntax-highlight repository files",
      "Read from the active branch before commits"
    ]
  },
  {
    version: "0.4.0",
    title: "Live Code Workspace",
    description: "Live refresh and Code view for review work.",
    category: "feature",
    details: [
      "Pull requests refresh in place while you review",
      "Repository files can be browsed from Code view",
      "Signed-in edits can be committed with a message",
      "Verification covers the new read and write paths"
    ]
  },
  {
    version: "0.3.5",
    title: "Sign-In Trust Update",
    description: "Quieter sign-in notice and clearer product ownership.",
    category: "fix",
    details: [
      "Sign-in notice identifies Coccinella Labs more clearly",
      "Privacy and terms copy includes company context",
      "Account actions and legal links use a calmer layout",
      "Sign-in modal spacing and copy are less noisy"
    ]
  },
  {
    version: "0.3.4",
    title: "Sign-In & Check Polish",
    description: "Small cleanup around sign-in, release notes, and verification.",
    category: "fix",
    details: [
      "First sign-in has a brief privacy and terms acknowledgement",
      "OAuth redirects leave a cleaner URL after sign-in",
      "Check logs resolve GitHub Actions jobs more consistently",
      "Verification output is quieter by default"
    ]
  },
  {
    version: "0.3.3",
    title: "Branch History & Mobile Annotations",
    description: "Tightened branch history and mobile review metadata.",
    category: "fix",
    details: [
      "Branch history renders compare commits",
      "Unrelated branch comparisons show a quiet empty state",
      "Mobile annotation file paths stay readable"
    ]
  },
  {
    version: "0.3.2",
    title: "Mobile Review Navigation",
    description: "Refined mobile review rendering and annotation jumps.",
    category: "fix",
    details: [
      "Review annotations can jump directly back to the diff line",
      "Mobile review markdown wraps long links and inline code without horizontal scroll",
      "Review gutters stay aligned with the existing mobile timeline rhythm"
    ]
  },
  {
    version: "0.3.1",
    title: "State & Interface Refinements",
    description: "Tightened saved state behavior, timeline layout, and account utilities.",
    category: "improvement",
    details: [
      "Saved pulls open directly without changing stream order",
      "Recent repo cleanup moved into the account menu",
      "Mobile history rows wrap long labels and branch names",
      "Graphite theme added to the theme cycle",
      "Quieter tooltips and inline history actions"
    ]
  },
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
    title: "Open Notes",
    description: "Items to watch after this release.",
    category: "planned",
    details: [
      "Polish the new flows",
      "Keep release notes compact as scope becomes clear"
    ]
  },
];
