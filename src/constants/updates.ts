export interface AppUpdate {
  version: string;
  date?: string;
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'fix' | 'planned';
  details: string[];
}

export const APP_UPDATES: AppUpdate[] = [
  {
    version: "0.2.1",
    date: "2026-05-07",
    title: "History, Checks & Navigation Refinements",
    description: "Corrected timeline behavior, check surfaces, and diff navigation feedback.",
    category: "fix",
    details: [
      "PR timeline cleanup with duplicate-event fixes",
      "PR description edit history rendering from user content edits",
      "Checks tab split from review with corrected check counts",
      "Merge conflict state surfaced in checks",
      "Single-line and multi-line diff jump highlighting",
      "Lower-noise checks and modal UI refinements"
    ]
  },
  {
    version: "0.2.0",
    date: "2026-05-07",
    title: "Review API & CI Surfaces",
    description: "Expanded review data, checks, timeline views, and rendering fixes.",
    category: "feature",
    details: [
      "Review API and timeline integration",
      "Checks, annotations, and CI run detail surfaces",
      "Markdown and embedded HTML rendering fixes",
      "Discussion and annotation rendering cleanup"
    ]
  },
  {
    version: "0.1.2",
    date: "2026-05-07",
    title: "Theme Switch & UI Cleanup",
    description: "Added theme controls and refined the visual system.",
    category: "improvement",
    details: [
      "Theme switching across interface surfaces",
      "General UI polish and layout cleanup",
      "Lower-noise presentation refinements"
    ]
  },
  {
    version: "0.1.1",
    date: "2026-05-07",
    title: "Checks, Navigation & App Flow",
    description: "Added repo flow improvements and deeper GitHub integration.",
    category: "feature",
    details: [
      "GitHub checks integration",
      "Active navigation and app-flow improvements",
      "Performance and loading behavior cleanup"
    ]
  },
  {
    version: "0.1.0",
    date: "2026-05-06",
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
      "Write access for comments and reviews",
      "Full OAuth authentication flow",
      "Live updates via WebSockets",
      "Global full-text search across diffs",
      "Repository-wide code exploration"
    ]
  }
];
