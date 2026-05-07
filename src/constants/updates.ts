export interface AppUpdate {
  version: string;
  date: string;
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'fix' | 'planned';
  details: string[];
}

export const APP_UPDATES: AppUpdate[] = [
  {
    version: "1.3.0",
    date: "2024-05-08",
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
  },
  {
    version: "1.2.0",
    date: "2024-05-07",
    title: "Pipeline Monitoring",
    description: "Continuous integration visibility.",
    category: "feature",
    details: [
      "GitHub Actions workflow integration",
      "Live execution log streaming",
      "Step-by-step status tracking",
      "Action-to-code navigation"
    ]
  },
  {
    version: "1.1.0",
    date: "2024-05-06",
    title: "Timeline & Review",
    description: "Sequential event processing.",
    category: "feature",
    details: [
      "Unified chronological event feed",
      "Integrated review comments display",
      "Commit vs Review interleaving",
      "Author/Reviewer context cards"
    ]
  },
  {
    version: "1.0.0",
    date: "2024-05-05",
    title: "Core Diff Engine",
    description: "Foundational review interface.",
    category: "feature",
    details: [
      "Pull request listing and filtering",
      "Syntax-highlighted diff viewer",
      "Multi-theme system (Onyx, Night, Grey)",
      "Mobile-responsive adaptive layout"
    ]
  }
];
