/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Children,
  isValidElement,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  GitBranch,
  ChevronRight,
  ExternalLink,
  FileCode,
  Activity,
  RefreshCw,
  Code,
  MessageSquare,
  MessageCircle,
  Hash,
  Maximize2,
  Minimize2,
  CheckCircle2,
  XCircle,
  Circle,
  Clock,
  CircleSlash,
  ArrowLeft,
  X,
  ListChecks,
  Terminal,
  AlertCircle,
  Info,
  GitGraph,
  Layers,
  ArrowDown,
  FileText,
  FileArchive,
  FileImage,
  FileJson,
  History,
  GitCommit,
  User,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Box,
  Gift,
  Menu,
  Palette,
  Settings,
  Database,
  Globe,
  Lock,
  Package,
  Sheet,
  Shield,
  Binary,
  Code2,
  Layout,
} from "lucide-react";
import { cn } from "./lib/utils";
import ReactMarkdown from "react-markdown";
import { APP_UPDATES } from "./constants/updates";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface GithubComment {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  body: string;
  created_at: string;
  path?: string; // for review comments
  html_url?: string;
  line?: number;
  original_line?: number;
  start_line?: number;
  original_start_line?: number;
  side?: "LEFT" | "RIGHT";
  start_side?: "LEFT" | "RIGHT";
  position?: number; // diff position, not a file line
  original_position?: number;
}

interface ChangedFile {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface PullRequest {
  id: number;
  number: number;
  title: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  body: string;
  html_url: string;
  state: string;
  draft?: boolean;
  base?: {
    ref: string;
  };
  head?: {
    ref: string;
  };
}

interface GithubCommit {
  sha: string;
  html_url: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
    avatar_url: string;
  };
}

interface GithubReview {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  body: string;
  state: string;
  submitted_at: string;
  html_url: string;
}

type TimelineEvent =
  | { type: 'pr_created'; date: string; data: PullRequest }
  | { type: 'commit'; date: string; data: GithubCommit }
  | { type: 'comment'; date: string; data: GithubComment }
  | { type: 'review'; date: string; data: GithubReview };

interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

interface RepoInfo {
  default_branch: string;
  html_url: string;
}

interface DiffRow {
  kind: "meta" | "hunk" | "context" | "added" | "deleted";
  content: string;
  oldLine: number | null;
  newLine: number | null;
}

const SYSTEM_OWNER = "harpertoken";
const SYSTEM_REPO = "harper";
const ALERT_TYPES = {
  NOTE: "border-sky-500/20 bg-sky-500/[0.06] text-sky-300",
  TIP: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300",
  IMPORTANT: "border-violet-500/20 bg-violet-500/[0.06] text-violet-300",
  WARNING: "border-amber-500/20 bg-amber-500/[0.06] text-amber-300",
  CAUTION: "border-rose-500/20 bg-rose-500/[0.06] text-rose-300",
} as const;
const ALERT_MARKER_PATTERN =
  /^[\s"'`{“”‘’]*(?:\\?\[?!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]?|\\?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])[\]}:.\s-]*/i;

const formatReviewCommentLine = (comment: GithubComment) => {
  const endLine = comment.line ?? comment.original_line;
  const startLine = comment.start_line ?? comment.original_start_line;
  const side = comment.side ?? comment.start_side;
  const isOriginal = comment.line == null && comment.original_line != null;
  const sideLabel = side === "LEFT" ? " old" : "";
  const originalLabel = isOriginal && side !== "LEFT" ? " original" : "";

  if (startLine && endLine && startLine !== endLine) {
    return `lines ${startLine}-${endLine}${sideLabel}${originalLabel}`;
  }

  if (endLine) {
    return `line ${endLine}${sideLabel}${originalLabel}`;
  }

  if (comment.position) {
    return `diff position ${comment.position}`;
  }

  return "file comment";
};

const getTextContent = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getTextContent(node.props.children);
  }

  return "";
};

const normalizeAlertMarkdown = (node: ReactNode) =>
  getTextContent(node).replace(ALERT_MARKER_PATTERN, "").trim();

const parseDiffRows = (patch?: string): DiffRow[] => {
  if (!patch) return [];

  const rows: DiffRow[] = [];
  let oldLine: number | null = null;
  let newLine: number | null = null;

  for (const line of patch.split("\n")) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1]);
      newLine = Number(hunkMatch[2]);
      rows.push({
        kind: "hunk",
        content: line,
        oldLine: null,
        newLine: null,
      });
      continue;
    }

    if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      rows.push({
        kind: "meta",
        content: line,
        oldLine: null,
        newLine: null,
      });
      continue;
    }

    if (line.startsWith("+")) {
      rows.push({
        kind: "added",
        content: line,
        oldLine: null,
        newLine,
      });
      if (newLine != null) {
        newLine += 1;
      }
      continue;
    }

    if (line.startsWith("-")) {
      rows.push({
        kind: "deleted",
        content: line,
        oldLine,
        newLine: null,
      });
      if (oldLine != null) {
        oldLine += 1;
      }
      continue;
    }

    if (line.startsWith("\\")) {
      rows.push({
        kind: "meta",
        content: line,
        oldLine: null,
        newLine: null,
      });
      continue;
    }

    rows.push({
      kind: "context",
      content: line,
      oldLine,
      newLine,
    });
    if (oldLine != null) {
      oldLine += 1;
    }
    if (newLine != null) {
      newLine += 1;
    }
  }

  return rows;
};

const markdownComponents = {
  blockquote({ children }: { children?: ReactNode }) {
    const firstText = Children.toArray(children)
      .map((child) => getTextContent(child).trimStart())
      .find((text) => text.length > 0) ?? "";
    const match = firstText.match(ALERT_MARKER_PATTERN);

    if (!match) {
      return (
        <blockquote className="border-l border-white/20 pl-4 italic text-white/60">
          {children}
        </blockquote>
      );
    }

    const alertType = (match[1] ?? match[2]).toUpperCase() as keyof typeof ALERT_TYPES;
    return (
      <div className={cn("my-4 border-l-2 px-4 py-3", ALERT_TYPES[alertType])}>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em]">
          {alertType}
        </div>
        <div className="text-white/75">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
            components={markdownComponents}
          >
            {normalizeAlertMarkdown(children)}
          </ReactMarkdown>
        </div>
      </div>
    );
  },
};

interface CheckRunStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  started_at?: string;
  completed_at?: string | null;
}

interface CheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  description?: string;
  type?: "check_run" | "status";
  started_at?: string;
  completed_at?: string | null;
  output?: {
    title: string | null;
    summary: string | null;
    text: string | null;
  };
  check_suite?: {
    head_branch: string;
    id: number;
  };
  steps?: CheckRunStep[];
  annotations?: any[];
  suite_runs?: CheckRun[];
}

const getFileIcon = (path: string) => {
  if (!path) return <FileCode className="w-2.5 h-2.5 text-white/20" />;
  const normalizedPath = path.toLowerCase();
  const fileName = normalizedPath.split('/').pop() ?? "";
  const ext = fileName.includes('.') ? fileName.split('.').pop() ?? "" : "";

  const iconClass = "w-2.5 h-2.5";

  const packageFiles = new Set([
    "cargo.toml",
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "composer.json",
    "composer.lock",
    "gemfile",
    "gemfile.lock",
    "podfile",
    "podfile.lock",
    "mix.exs",
    "mix.lock",
    "pubspec.yaml",
    "pubspec.lock",
  ]);

  if (packageFiles.has(fileName)) {
    return <Package className={`${iconClass} text-brand-orange/40`} />;
  }

  if (fileName === "dockerfile" || fileName.startsWith("dockerfile.")) {
    return <Package className={`${iconClass} text-sky-400/40`} />;
  }

  if (fileName === ".gitignore" || fileName === ".gitattributes" || fileName === ".editorconfig") {
    return <Settings className={`${iconClass} text-white/20`} />;
  }

  if (fileName.includes("license")) {
    return <Shield className={`${iconClass} text-white/20`} />;
  }

  if (fileName.startsWith("readme") || fileName.startsWith("changelog") || fileName.startsWith("contributing")) {
    return <FileText className={`${iconClass} text-white/20`} />;
  }

  if (fileName.endsWith(".lock")) {
    return <Lock className={`${iconClass} text-white/20`} />;
  }

  if (
    [
      "rs", "c", "cc", "cpp", "cxx", "h", "hh", "hpp", "hxx", "m", "mm",
      "swift", "kt", "kts", "java", "scala", "clj", "cljs", "ex", "exs",
      "erl", "hrl", "zig", "nim", "lua", "rb", "php", "py", "r", "jl",
      "go", "js", "mjs", "cjs", "ts", "tsx", "jsx", "vue", "svelte", "astro"
    ].includes(ext)
  ) {
    const color =
      ext === "py" ? "text-sky-400/40" :
      ext === "go" ? "text-blue-400/40" :
      ["js", "mjs", "cjs", "ts", "tsx", "jsx", "vue", "svelte", "astro"].includes(ext) ? "text-amber-400/40" :
      ext === "rs" ? "text-brand-orange/40" :
      "text-white/25";
    return <FileCode className={`${iconClass} ${color}`} />;
  }

  if (["sh", "bash", "zsh", "fish", "ps1"].includes(ext)) {
    return <Terminal className={`${iconClass} text-sky-400/40`} />;
  }

  if (["sql", "psql", "mysql", "sqlite", "prisma"].includes(ext)) {
    return <Database className={`${iconClass} text-cyan-400/40`} />;
  }

  if (["json", "jsonc", "json5", "yml", "yaml", "toml", "ini", "conf", "cfg"].includes(ext)) {
    return <FileJson className={`${iconClass} text-white/20`} />;
  }

  if (["html", "htm"].includes(ext)) {
    return <Layout className={`${iconClass} text-emerald-400/40`} />;
  }

  if (["css", "scss", "sass", "less", "pcss"].includes(ext)) {
    return <Palette className={`${iconClass} text-pink-400/40`} />;
  }

  if (["md", "mdx", "txt", "rst", "adoc", "doc", "docx", "pdf"].includes(ext)) {
    return <FileText className={`${iconClass} text-white/20`} />;
  }

  if (["csv", "tsv", "xls", "xlsx"].includes(ext)) {
    return <Sheet className={`${iconClass} text-emerald-400/40`} />;
  }

  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "ico", "bmp"].includes(ext)) {
    return <FileImage className={`${iconClass} text-violet-400/40`} />;
  }

  if (["mp4", "mov", "webm", "avi", "mkv", "mp3", "wav", "ogg", "flac"].includes(ext)) {
    return <Activity className={`${iconClass} text-violet-400/30`} />;
  }

  if (["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "jar"].includes(ext)) {
    return <FileArchive className={`${iconClass} text-amber-400/35`} />;
  }

  if (["wasm", "bin", "so", "dll", "dylib", "exe", "o", "a", "class"].includes(ext)) {
    return <Binary className={`${iconClass} text-white/20`} />;
  }

  if (["pem", "crt", "cer", "key", "csr"].includes(ext)) {
    return <Shield className={`${iconClass} text-white/20`} />;
  }

  if (["graphql", "gql"].includes(ext)) {
    return <Globe className={`${iconClass} text-pink-400/40`} />;
  }

  return <FileCode className={`${iconClass} text-white/20`} />;
};

const getFileKindLabel = (path: string) => {
  const normalizedPath = path.toLowerCase();
  const fileName = normalizedPath.split("/").pop() ?? "";
  const ext = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";

  const packageFiles = new Set([
    "cargo.toml",
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "composer.json",
    "composer.lock",
    "gemfile",
    "gemfile.lock",
    "podfile",
    "podfile.lock",
    "mix.exs",
    "mix.lock",
    "pubspec.yaml",
    "pubspec.lock",
  ]);

  if (packageFiles.has(fileName)) return "package";
  if (fileName === "dockerfile" || fileName.startsWith("dockerfile.")) return "docker";
  if (fileName === ".gitignore" || fileName === ".gitattributes" || fileName === ".editorconfig") return "config";
  if (fileName.includes("license")) return "license";
  if (fileName.startsWith("readme") || fileName.startsWith("changelog") || fileName.startsWith("contributing")) return "docs";
  if (fileName.endsWith(".lock")) return "lock";
  if (ext === "rs") return "rust";
  if (ext === "py") return "python";
  if (ext === "go") return "go";
  if (["js", "mjs", "cjs"].includes(ext)) return "javascript";
  if (["ts", "tsx"].includes(ext)) return "typescript";
  if (ext === "jsx") return "react";
  if (ext === "vue") return "vue";
  if (ext === "svelte") return "svelte";
  if (ext === "astro") return "astro";
  if (["c", "cc", "cpp", "cxx", "h", "hh", "hpp", "hxx"].includes(ext)) return "c++";
  if (ext === "java") return "java";
  if (["kt", "kts"].includes(ext)) return "kotlin";
  if (ext === "swift") return "swift";
  if (ext === "rb") return "ruby";
  if (ext === "php") return "php";
  if (["sh", "bash", "zsh", "fish", "ps1"].includes(ext)) return "shell";
  if (["sql", "psql", "mysql", "sqlite", "prisma"].includes(ext)) return "data";
  if (["json", "jsonc", "json5", "yml", "yaml", "toml", "ini", "conf", "cfg"].includes(ext)) return "config";
  if (["html", "htm"].includes(ext)) return "html";
  if (["css", "scss", "sass", "less", "pcss"].includes(ext)) return "styles";
  if (["md", "mdx", "txt", "rst", "adoc", "doc", "docx", "pdf"].includes(ext)) return "docs";
  if (["csv", "tsv", "xls", "xlsx"].includes(ext)) return "sheet";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "ico", "bmp"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "avi", "mkv", "mp3", "wav", "ogg", "flac"].includes(ext)) return "media";
  if (["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "jar"].includes(ext)) return "archive";
  if (["wasm", "bin", "so", "dll", "dylib", "exe", "o", "a", "class"].includes(ext)) return "binary";
  if (["pem", "crt", "cer", "key", "csr"].includes(ext)) return "security";
  if (["graphql", "gql"].includes(ext)) return "graphql";
  return ext || "file";
};

export default function App() {
  const [viewMode, setViewMode] = useState<"pulls" | "branches">("pulls");
  const [defaultRepo, setDefaultRepo] = useState(() => {
    const saved = localStorage.getItem("diff_default_repo");
    if (saved) {
      try {
        return JSON.parse(saved) as { owner: string; repo: string };
      } catch {
        return { owner: SYSTEM_OWNER, repo: SYSTEM_REPO };
      }
    }
    return { owner: SYSTEM_OWNER, repo: SYSTEM_REPO };
  });
  const [currentOwner, setCurrentOwner] = useState(defaultRepo.owner);
  const [currentRepo, setCurrentRepo] = useState(defaultRepo.repo);
  const [showRepoInput, setShowRepoInput] = useState(false);
  const [inputRepo, setInputRepo] = useState("");
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [pulls, setPulls] = useState<PullRequest[]>([]);
  const [selectedPull, setSelectedPull] = useState<PullRequest | null>(null);
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ChangedFile | null>(null);
  const [comments, setComments] = useState<GithubComment[]>([]);
  const [reviewComments, setReviewComments] = useState<GithubComment[]>([]);
  const [commits, setCommits] = useState<GithubCommit[]>([]);
  const [reviews, setReviews] = useState<GithubReview[]>([]);
  const [checkRuns, setCheckRuns] = useState<CheckRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState<CheckRun | null>(null);
  const [loadingRunDetail, setLoadingRunDetail] = useState(false);
  const [errorRunDetail, setErrorRunDetail] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [checkDetailTab, setCheckDetailTab] = useState<"steps" | "logs">("steps");
  const [activeTab, setActiveTab] = useState<"diff" | "discussion" | "timeline">("diff");
  const [loading, setLoading] = useState(true);
  const [showUpdates, setShowUpdates] = useState(false);
  const [hasNewUpdates, setHasNewUpdates] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [stateFilter, setStateFilter] = useState<"open" | "closed" | "all">(
    "open",
  );
  const [theme, setTheme] = useState<"dark" | "midnight" | "grey">(() => {
    return (localStorage.getItem("diff_theme") as "dark" | "midnight" | "grey") || "dark";
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaChallenge] = useState(() => {
    const a = Math.floor(Math.random() * 4) + 2;
    const b = Math.floor(Math.random() * 4) + 1;
    return { a, b, sum: a + b };
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const repoKeyRef = useRef(`${currentOwner}/${currentRepo}`);
  const diffRows = parseDiffRows(selectedFile?.patch);
  const releasedUpdates = APP_UPDATES.filter((update) => update.category !== "planned");
  const plannedUpdates = APP_UPDATES.filter((update) => update.category === "planned");

  const navigateToComment = (path: string, line: number) => {
    setActiveTab("diff");
    const file = files.find(f => f.filename === path);
    if (file) {
      setSelectedFile(file);
      // Wait for React to render the diff before scrolling
      setTimeout(() => {
        const id = `line-${path}-${line}`;
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("bg-brand-orange/20");
          setTimeout(() => {
            element.classList.remove("bg-brand-orange/20");
          }, 2000);
        }
      }, 500);
    }
  };

  const getTimeline = (): TimelineEvent[] => {
    if (!selectedPull) return [];

    const events: TimelineEvent[] = [
      { type: 'pr_created', date: selectedPull.created_at, data: selectedPull }
    ];

    commits.forEach(c => events.push({ type: 'commit', date: c.commit.author.date, data: c }));
    comments.forEach(c => events.push({ type: 'comment', date: c.created_at, data: c }));
    reviewComments.forEach(c => events.push({ type: 'comment', date: c.created_at, data: c }));
    reviews
      .filter((review) => {
        const state = review.state?.toUpperCase();
        const hasBody = Boolean(review.body?.trim());
        return state !== "COMMENTED" || hasBody;
      })
      .forEach(r => events.push({ type: 'review', date: r.submitted_at, data: r }));

    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (selectedRunId) {
      const run = checkRuns.find((r) => r.id === selectedRunId);
      if (!run) {
        setSelectedRunId(null);
        return;
      }

      const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
          const response = await fetch(
            `/api/checks/${selectedRunId}/logs?owner=${currentOwner}&repo=${currentRepo}`,
          );
          if (response.ok) {
            const text = await response.text();
            setRunLogs(text);
          }
        } catch (error) {
          console.error("Error fetching logs:", error);
        } finally {
          setLoadingLogs(false);
        }
      };

      const fetchRunDetail = async () => {
        setLoadingRunDetail(true);
        setErrorRunDetail(null);
        try {
          const response = await fetch(
            `/api/checks/${selectedRunId}?owner=${currentOwner}&repo=${currentRepo}`,
          );
          if (response.ok) {
            const data = await response.json();
            setSelectedRunDetail(data);

            // If it's now completed, we should probably stop polling or do one last fetch
            if (data.status === "completed" && interval) {
                clearInterval(interval);
            }
          } else {
            const errData = await response.json();
            setErrorRunDetail(errData.error || "Failed to fetch run details from GitHub");
            setSelectedRunDetail(run);
          }
        } catch (error) {
          setErrorRunDetail(error instanceof Error ? error.message : "Network error while fetching check details");
          setSelectedRunDetail(run);
        } finally {
          setLoadingRunDetail(false);
        }
      };

      if (run.type === "status") {
        setSelectedRunDetail(run);
        setLoadingRunDetail(false);
        setRunLogs(null);
      } else {
        fetchRunDetail();
        fetchLogs();

        // Start polling if it's in progress
        if (run.status === "in_progress" || run.status === "queued") {
          interval = setInterval(() => {
            fetchRunDetail();
            fetchLogs();
          }, 5000); // Poll every 5 seconds
        }
      }
    } else {
      setSelectedRunDetail(null);
      setRunLogs(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedRunId, checkRuns, currentOwner, currentRepo]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("diff_theme", theme);
  }, [theme]);

  useEffect(() => {
    repoKeyRef.current = `${currentOwner}/${currentRepo}`;
  }, [currentOwner, currentRepo]);

  const resetRepoState = () => {
    setRepoInfo(null);
    setBranches([]);
    setSelectedBranch(null);
    setPulls([]);
    setSelectedPull(null);
    setFiles([]);
    setSelectedFile(null);
    setComments([]);
    setReviewComments([]);
    setCommits([]);
    setReviews([]);
    setCheckRuns([]);
    setActiveTab("diff");
    setPage(1);
    setHasMore(true);
    setLoading(true);
    setLoadingFiles(false);
    setLoadingComments(false);
    setLoadingMore(false);
  };

  const switchRepo = (owner: string, repo: string) => {
    const nextOwner = owner.trim();
    const nextRepo = repo.trim();
    if (!nextOwner || !nextRepo) return;
    if (nextOwner === currentOwner && nextRepo === currentRepo) return;

    repoKeyRef.current = `${nextOwner}/${nextRepo}`;
    resetRepoState();
    setCurrentOwner(nextOwner);
    setCurrentRepo(nextRepo);
    setError(null);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth < 100) {
        setIsSidebarHidden(true);
        setIsResizing(false);
      } else if (newWidth >= 200 && newWidth <= 800) {
        if (isSidebarHidden) setIsSidebarHidden(false);
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    fetchRepoInfo();
  }, [currentOwner, currentRepo]);

  useEffect(() => {
    setPage(1);
    if (viewMode === "pulls") {
      fetchPulls(1, true);
    } else {
      fetchBranches(1, true);
    }
  }, [viewMode, stateFilter, currentOwner, currentRepo]);

  const fetchRepoInfo = async () => {
    const requestKey = `${currentOwner}/${currentRepo}`;
    try {
      const res = await fetch(
        `/api/repo?owner=${currentOwner}&repo=${currentRepo}`,
      );
      if (res.ok) {
        const data: RepoInfo = await res.json();
        if (repoKeyRef.current !== requestKey) return null;
        setRepoInfo(data);
        return data;
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("Repo info fetch error:", errorData.error || res.statusText);
      }
    } catch (err) {
      console.error("Repo info fetch error:", err);
    }
    return null;
  };

  const fetchBranches = async (pageNum = 1, reset = false) => {
    const requestKey = `${currentOwner}/${currentRepo}`;
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const comparisonRepoInfo = repoInfo ?? (await fetchRepoInfo());
      if (repoKeyRef.current !== requestKey) return;

      const response = await fetch(
        `/api/branches?page=${pageNum}&per_page=30&owner=${currentOwner}&repo=${currentRepo}`,
      );
      if (repoKeyRef.current !== requestKey) return;
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch branches");
      }
      const data: Branch[] = await response.json();
      if (repoKeyRef.current !== requestKey) return;

      const newBranches = reset ? data : [...branches, ...data];
      setBranches(newBranches);
      setHasMore(data.length === 30);

      if (reset) {
        if (data.length > 0) {
          handleSelectBranch(data[0], comparisonRepoInfo);
        } else {
          setSelectedBranch(null);
          setFiles([]);
          setSelectedFile(null);
        }
      }
    } catch (err: any) {
      if (repoKeyRef.current !== requestKey) return;
      setError(err.message);
    } finally {
      if (repoKeyRef.current === requestKey) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const handleSelectBranch = async (
    branch: Branch,
    comparisonRepoInfo = repoInfo,
  ) => {
    const requestKey = `${currentOwner}/${currentRepo}`;
    setSelectedBranch(branch);
    setSelectedPull(null);
    setLoadingFiles(true);
    setFiles([]);
    setSelectedFile(null);
    setComments([]);
    setReviewComments([]);
    setActiveTab("diff");

    try {
      const base = comparisonRepoInfo?.default_branch;
      const head = branch.name;

      if (!base || base === head) {
        setFiles([]);
        setLoadingFiles(false);
        return;
      }

      const filesRes = await fetch(
        `/api/compare/${encodeURIComponent(base)}/${encodeURIComponent(head)}/files?owner=${currentOwner}&repo=${currentRepo}`,
      );
      if (repoKeyRef.current !== requestKey) return;
      if (filesRes.ok) {
        const data = await filesRes.json();
        if (repoKeyRef.current !== requestKey) return;
        setFiles(data);
        if (data.length > 0) {
          setSelectedFile(data[0]);
        }
      }
    } catch (err) {
      if (repoKeyRef.current !== requestKey) return;
      console.error("Branch comparison files fetch error:", err);
    } finally {
      if (repoKeyRef.current === requestKey) {
        setLoadingFiles(false);
      }
    }
  };

  const fetchPulls = async (pageNum = 1, reset = false) => {
    const requestKey = `${currentOwner}/${currentRepo}`;
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const response = await fetch(
        `/api/pulls?state=${stateFilter}&page=${pageNum}&per_page=30&owner=${currentOwner}&repo=${currentRepo}`,
      );
      if (repoKeyRef.current !== requestKey) return;
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let message =
          errorData.error || `Server responded with ${response.status}`;
        if (typeof message !== "string") {
          message = JSON.stringify(message);
        }
        if (message.includes("rate limit")) {
          throw new Error(
            "GitHub API rate limit exceeded. Add a GITHUB_TOKEN in your local .env or shell environment to increase limits.",
          );
        }
        throw new Error(message);
      }
      const data: PullRequest[] = await response.json();
      if (repoKeyRef.current !== requestKey) return;

      const newPulls = reset ? data : [...pulls, ...data];
      setPulls(newPulls);
      setHasMore(data.length === 30);

      if (reset) {
        if (data.length > 0) {
          handleSelectPull(data[0]);
        } else {
          setSelectedPull(null);
          setFiles([]);
          setSelectedFile(null);
          setComments([]);
          setReviewComments([]);
        }
      }
    } catch (err: any) {
      if (repoKeyRef.current !== requestKey) return;
      setError(err.message);
    } finally {
      if (repoKeyRef.current === requestKey) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    if (viewMode === "pulls") {
      fetchPulls(nextPage);
    } else {
      fetchBranches(nextPage);
    }
  };

  const handleSelectPull = async (pull: PullRequest) => {
    const requestKey = `${currentOwner}/${currentRepo}`;
    setSelectedPull(pull);
    setLoadingFiles(true);
    setLoadingComments(true);
    setFiles([]);
    setSelectedFile(null);
    setComments([]);
    setReviewComments([]);
    setCheckRuns([]);
    setActiveTab("diff");
    try {
      const [filesRes, commentsRes, reviewCommentsRes, checksRes, commitsRes, reviewsRes] = await Promise.all([
        fetch(
          `/api/pulls/${pull.number}/files?owner=${currentOwner}&repo=${currentRepo}`,
        ),
        fetch(
          `/api/pulls/${pull.number}/comments?owner=${currentOwner}&repo=${currentRepo}`,
        ),
        fetch(
          `/api/pulls/${pull.number}/review-comments?owner=${currentOwner}&repo=${currentRepo}`,
        ),
        fetch(
          `/api/pulls/${pull.number}/checks?owner=${currentOwner}&repo=${currentRepo}`,
        ),
        fetch(
          `/api/pulls/${pull.number}/commits?owner=${currentOwner}&repo=${currentRepo}`,
        ),
        fetch(
          `/api/pulls/${pull.number}/reviews?owner=${currentOwner}&repo=${currentRepo}`,
        ),
      ]);

      if (repoKeyRef.current !== requestKey) return;

      // Process Files
      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data);
        if (data.length > 0) setSelectedFile(data[0]);
      }

      // Process Comments
      if (commentsRes.ok) setComments(await commentsRes.json());
      if (reviewCommentsRes.ok) setReviewComments(await reviewCommentsRes.json());

      // Process Commits & Reviews
      if (commitsRes.ok) setCommits(await commitsRes.json());
      if (reviewsRes.ok) setReviews(await reviewsRes.json());

      // Process Checks
      if (checksRes.ok) {
        const data = await checksRes.json();
        setCheckRuns(data.check_runs || []);
      }
    } catch (err) {
      if (repoKeyRef.current !== requestKey) return;
      console.error("PR data fetch error:", err);
    } finally {
      if (repoKeyRef.current === requestKey) {
        setLoadingFiles(false);
        setLoadingComments(false);
      }
    }
  };

  if (!isVerified) {
    return (
      <div className="fixed inset-0 bg-onyx z-[100] flex items-center justify-center p-6 font-mono">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-[240px] space-y-4 text-center"
        >
          <div className="text-[10px] uppercase tracking-[0.4em] opacity-20 font-bold mb-8">
            Access Verification
          </div>

          <div className="text-xl tracking-tighter text-white/40 mb-4">
            {captchaChallenge.a} + {captchaChallenge.b}
          </div>

            <div className="flex bg-white/5 p-1 rounded-2xl">
              <input
                type="text"
                value={captchaInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCaptchaInput(val);
                  if (parseInt(val) === captchaChallenge.sum) {
                    setIsVerified(true);
                  }
                }}
                autoFocus
                className="w-full bg-transparent p-4 text-center text-xl text-brand-orange outline-none transition-colors placeholder:text-white/5 font-bold"
                placeholder="?"
              />
            </div>

          <div className="text-[8px] uppercase tracking-[0.2em] opacity-10 pt-4">
            Awaiting input
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-onyx text-off-white font-sans selection:bg-brand-orange selection:text-off-white">
      {/* Structural Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.5]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-onyx/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 lg:px-12 h-14 lg:h-20 flex items-center justify-between gap-2 lg:gap-3">
          <div className="flex items-center gap-2 lg:gap-4 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-1 -ml-1 text-white/40 hover:text-brand-orange transition-colors"
            >
              <Activity
                className={cn(
                  "w-4 h-4 sm:w-5 h-5 transition-transform",
                  isSidebarOpen && "rotate-90",
                )}
              />
            </button>
            <div className="flex items-center gap-2 lg:gap-3 min-w-0">
              <div className="w-3 h-3 bg-white/20 shrink-0" />
              <div className="flex flex-col min-w-0">
                <h1 className="text-base lg:text-xl font-mono tracking-tighter leading-none group cursor-default flex items-baseline">
                  DIFF
                  <span className="hidden md:inline text-[7px] opacity-10 ml-3 tracking-[0.4em] font-mono">
                    PROTOTYPE
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-3 lg:gap-4">
              <button
                onClick={() => {
                  const themes: ("dark" | "midnight" | "grey")[] = ["dark", "midnight", "grey"];
                  const currentIndex = themes.indexOf(theme);
                  const nextIndex = (currentIndex + 1) % themes.length;
                  setTheme(themes[nextIndex]);
                }}
                className="flex items-center gap-2 lg:gap-3 group p-1.5 lg:p-2 hover:bg-white/5 transition-all rounded-lg"
              >
                <div className="flex gap-1 px-0.5">
                  <div className={cn("w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full transition-all duration-300", theme === "dark" ? "bg-brand-orange scale-110" : "bg-white/10")} />
                  <div className={cn("w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full transition-all duration-300", theme === "midnight" ? "bg-brand-orange scale-110" : "bg-white/10")} />
                  <div className={cn("w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full transition-all duration-300", theme === "grey" ? "bg-brand-orange scale-110" : "bg-white/10")} />
                </div>
                <div className="hidden sm:block w-[40px] lg:w-[60px] overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={theme}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 0.4, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      whileHover={{ opacity: 1 }}
                      className="block text-[8px] uppercase tracking-widest font-bold text-white transition-opacity text-left text-nowrap"
                    >
                      {theme === "dark" ? "Onyx" : theme === "midnight" ? "Night" : "Grey"}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowUpdates(true);
                  setHasNewUpdates(false);
                }}
                className="relative flex items-center gap-2 lg:gap-3 transition-all group"
              >
                <div className={cn(
                  "w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full",
                  hasNewUpdates ? "bg-brand-orange animate-pulse" : "bg-white/10 group-hover:bg-white/30"
                )} />
                <span className="hidden sm:inline text-[8px] uppercase tracking-[0.2em] font-medium text-white/20 group-hover:text-white/40">Updates</span>
              </button>
            </div>

            <div className="hidden lg:flex items-center gap-12 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
              <a
                href="https://github.com/bniladridas/diff"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                GitHub <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <button
              onClick={() => setIsSidebarHidden(!isSidebarHidden)}
              className="hidden lg:flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 hover:text-brand-orange transition-colors min-w-[120px] justify-end"
            >
              <div className="relative h-4 w-full flex items-center justify-end">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isSidebarHidden ? "show" : "hide"}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="absolute right-0 whitespace-nowrap"
                  >
                    {isSidebarHidden ? "Show" : "Hide"} Panel
                  </motion.span>
                </AnimatePresence>
              </div>
            </button>
          </div>

          <button
            onClick={() =>
              viewMode === "pulls" ? fetchPulls(1, true) : fetchBranches()
            }
            className="p-2 lg:p-3 border border-white/10 hover:border-brand-orange transition-all group shrink-0 rounded-lg"
          >
            <RefreshCw
              className={cn(
                "w-3.5 h-3.5 lg:w-4 lg:h-4 text-white/40 group-hover:text-brand-orange transition-colors",
                loading && "animate-spin",
              )}
            />
          </button>
        </div>
      </header>
<AnimatePresence>
  {isSidebarOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setIsSidebarOpen(false)}
      className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
    />
  )}
</AnimatePresence>
      <main
        className={cn(
          "pt-14 lg:pt-20 h-screen flex overflow-hidden bg-onyx",
          isResizing && "select-none cursor-col-resize",
        )}
        style={
          { "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties
        }
      >
        {/* Pull Requests List */}
        <aside
          style={{
            width: isSidebarHidden ? 0 : undefined,
            transition: isResizing ? 'none' : undefined
          }}
          className={cn(
            "border-r border-white/5 bg-panel/90 backdrop-blur-md flex flex-col relative group overflow-hidden",
            isSidebarOpen ? "z-50" : "z-40",
            !isResizing && "transition-all duration-300 ease-in-out",
            "fixed lg:relative top-14 lg:top-0 bottom-0 left-0 lg:bottom-auto lg:inset-auto bg-onyx lg:bg-panel/90",
            isSidebarOpen
              ? "w-[280px] sm:w-[320px] translate-x-0"
              : "w-0 lg:w-auto -translate-x-full lg:translate-x-0",
            !isSidebarHidden && "lg:w-[var(--sidebar-width)]",
          )}
        >
          <div className="flex flex-col h-full overflow-hidden w-[280px] sm:w-[320px] lg:w-[var(--sidebar-width)]">
            <div className="p-4 lg:p-5 border-b border-white/5 space-y-4">
              {/* Repository Switcher moved here */}
              <div className="flex items-center gap-2 min-w-0">
                {showRepoInput ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex-1 flex items-center"
                  >
                    <input
                      type="text"
                      value={inputRepo}
                      onChange={(e) => setInputRepo(e.target.value)}
                      onBlur={() => {
                        if (!inputRepo) setShowRepoInput(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const [owner, repo] = inputRepo.split("/");
                          if (owner && repo) {
                            switchRepo(owner, repo);
                            setShowRepoInput(false);
                          }
                        } else if (e.key === "Escape") {
                          setShowRepoInput(false);
                        }
                      }}
                      autoFocus
                      placeholder="owner/repo"
                      className="bg-black/20 border border-white/10 px-3 py-2 text-[10px] font-mono text-white/80 outline-none focus:border-brand-orange/40 w-full rounded-lg"
                    />
                  </motion.div>
                ) : (
                  <div className="flex-1 flex items-start justify-between gap-3 min-w-0">
                    <button
                      onClick={() => {
                        setInputRepo(`${currentOwner}/${currentRepo}`);
                        setShowRepoInput(true);
                      }}
                      className="text-[9px] lg:text-[10px] font-mono whitespace-nowrap text-white/35 hover:text-white/70 transition-colors flex items-center gap-1.5 group min-w-0 overflow-hidden"
                    >
                      <Hash className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">
                        {currentOwner}/{currentRepo}
                      </span>
                      <RefreshCw className="w-2.5 h-2.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(currentOwner !== defaultRepo.owner ||
                        currentRepo !== defaultRepo.repo) && (
                        <>
                          <button
                            onClick={() => {
                              const newDefault = { owner: currentOwner, repo: currentRepo };
                              setDefaultRepo(newDefault);
                              localStorage.setItem("diff_default_repo", JSON.stringify(newDefault));
                            }}
                            className="px-2 py-1 text-[8px] uppercase tracking-[0.18em] text-white/30 hover:text-white/70 transition-colors shrink-0 border border-white/5 rounded-md"
                          >
                            Pin
                          </button>
                          <button
                            onClick={() => {
                              switchRepo(defaultRepo.owner, defaultRepo.repo);
                            }}
                            className="px-2 py-1 text-[8px] uppercase tracking-[0.18em] text-white/30 hover:text-white/70 transition-colors shrink-0 border border-white/5 rounded-md"
                          >
                            Default
                          </button>
                        </>
                      )}

                      {(defaultRepo.owner !== SYSTEM_OWNER || defaultRepo.repo !== SYSTEM_REPO) && (
                         <button
                         onClick={() => {
                           const systemDefault = { owner: SYSTEM_OWNER, repo: SYSTEM_REPO };
                           setDefaultRepo(systemDefault);
                           localStorage.removeItem("diff_default_repo");
                           switchRepo(SYSTEM_OWNER, SYSTEM_REPO);
                         }}
                         className="px-2 py-1 text-[8px] uppercase tracking-[0.18em] text-rose-400/60 hover:text-rose-300 transition-colors shrink-0 border border-rose-500/10 rounded-md"
                         title="Clear custom default and reset to system default"
                       >
                         Clear
                       </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 border border-white/5 bg-black/20 rounded-xl p-1">
                <button
                  onClick={() => setViewMode("pulls")}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.24em] transition-all relative rounded-lg",
                    viewMode === "pulls"
                      ? "bg-white/[0.04] text-white"
                      : "text-white/25 hover:text-white/45",
                  )}
                >
                  Pulls
                  {viewMode === "pulls" && (
                    <motion.div
                      layoutId="viewMode"
                      className="absolute inset-x-3 bottom-0 h-px bg-brand-orange"
                    />
                  )}
                </button>
                <button
                  onClick={() => setViewMode("branches")}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.24em] transition-all relative rounded-lg",
                    viewMode === "branches"
                      ? "bg-white/[0.04] text-white"
                      : "text-white/25 hover:text-white/45",
                  )}
                >
                  Branches
                  {viewMode === "branches" && (
                    <motion.div
                      layoutId="viewMode"
                      className="absolute inset-x-3 bottom-0 h-px bg-brand-orange"
                    />
                  )}
                </button>
              </div>
            </div>

            <div className="px-4 lg:px-5 py-4 border-b border-white/5 space-y-4 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/20">
                  <Activity className="w-3 h-3" />
                  <h2 className="text-[9px] font-bold uppercase tracking-[0.36em]">
                    {viewMode === "pulls" ? "Stream" : "Network"}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 text-[9px] font-mono text-white/45 bg-white/[0.03] border border-white/5 rounded-md">
                    {viewMode === "pulls" ? pulls.length : branches.length}
                  </span>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="lg:hidden"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180 opacity-40" />
                  </button>
                </div>
              </div>

              {viewMode === "pulls" && (
                <div className="flex border border-white/5 p-1 bg-black/20 rounded-xl">
                  {(["open", "closed", "all"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStateFilter(s)}
                      className={cn(
                        "flex-1 py-2 text-[8px] lg:text-[10px] uppercase tracking-[0.24em] font-bold transition-all rounded-lg",
                        stateFilter === s
                          ? "bg-white/[0.05] text-white"
                          : "text-white/30 hover:text-white/60",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-12 flex flex-col items-center justify-center space-y-4">
                  <div className="w-8 h-8 border-2 border-brand-orange/20 border-t-brand-orange animate-spin" />
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-20">
                    Syncing GitHub...
                  </p>
                </div>
              ) : error ? (
                <div className="p-12 text-center space-y-4">
                  <p className="text-xs text-rose-500 font-mono">{error}</p>
                  <button
                    onClick={() => fetchPulls(1, true)}
                    className="text-[10px] uppercase tracking-widest text-brand-orange border-b border-brand-orange/20"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {viewMode === "pulls"
                    ? pulls.map((pull) => (
                        <button
                          key={pull.id}
                          onClick={() => {
                            handleSelectPull(pull);
                            setIsSidebarOpen(false);
                          }}
                          className={cn(
                            "w-full text-left p-5 lg:p-6 transition-all border border-transparent hover:border-white/5 hover:bg-white/[0.02] relative group rounded-xl",
                            selectedPull?.id === pull.id
                              ? "bg-white/[0.03] border-white/6"
                              : "",
                          )}
                        >
                          {selectedPull?.id === pull.id && (
                            <motion.div
                              layoutId="active-indicator"
                              className="absolute left-0 top-3 bottom-3 w-px bg-brand-orange"
                            />
                          )}

                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-[9px] font-mono text-white/30">
                              <span className="flex items-center gap-2">
                                #{pull.number}
                                {pull.draft && (
                                  <span className="text-[7px] font-mono px-1.5 py-0.5 border border-white/5 text-white/35 uppercase tracking-[0.22em] leading-tight rounded-md">
                                    Draft
                                  </span>
                                )}
                              </span>
                              <span className="hidden sm:block">
                                {new Date(pull.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>

                            <h3
                              className={cn(
                                "font-serif italic text-base lg:text-lg leading-tight transition-colors break-words",
                                selectedPull?.id === pull.id
                                  ? "text-white"
                                  : "text-white/60 group-hover:text-white",
                              )}
                            >
                              {pull.title}
                            </h3>

                            <div className="flex items-center gap-2 pt-0.5">
                              <img
                                src={pull.user.avatar_url}
                                alt=""
                                className="w-4 h-4 grayscale opacity-30 group-hover:opacity-100 transition-opacity rounded-full"
                              />
                              <span className="text-[9px] tracking-[0.22em] text-white/20 group-hover:text-white/50 transition-colors font-bold uppercase">
                                {pull.user.login}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))
                    : branches.map((branch) => (
                        <button
                          key={branch.name}
                          onClick={() => {
                            handleSelectBranch(branch);
                            setIsSidebarOpen(false);
                          }}
                          className={cn(
                            "w-full text-left p-5 lg:p-6 transition-all border border-transparent hover:border-white/5 hover:bg-white/[0.02] relative group rounded-xl",
                            selectedBranch?.name === branch.name
                              ? "bg-white/[0.03] border-white/6"
                              : "",
                          )}
                        >
                          {selectedBranch?.name === branch.name && (
                            <motion.div
                              layoutId="active-indicator"
                              className="absolute left-0 top-3 bottom-3 w-px bg-brand-orange"
                            />
                          )}

                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-[10px] font-mono text-white/35">
                              <span className="flex items-center gap-2">
                                <GitBranch className="w-3 h-3" />
                              </span>
                              {branch.name === repoInfo?.default_branch && (
                                <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-[#00FF41]/55 px-1.5 py-0.5 border border-[#00FF41]/10 rounded-md">
                                  Default
                                </span>
                              )}
                            </div>

                            <h3
                              className={cn(
                                "font-serif italic text-base lg:text-lg leading-tight transition-colors break-words",
                                selectedBranch?.name === branch.name
                                  ? "text-white"
                                  : "text-white/60 group-hover:text-white",
                              )}
                            >
                              {branch.name}
                            </h3>

                            <div className="flex items-center gap-3 pt-0.5">
                              <span className="text-[9px] lg:text-[10px] text-white/35 font-mono truncate">
                                {branch.commit.sha.substring(0, 7)}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}

                  {hasMore && (
                    <div className="p-6 flex justify-center">
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="group flex flex-col items-center gap-3 transition-all"
                      >
                        <div
                          className={cn(
                            "w-10 h-10 border border-white/10 flex items-center justify-center transition-all group-hover:border-white/20 group-hover:bg-white/[0.03] rounded-xl",
                            loadingMore && "animate-pulse",
                          )}
                        >
                          {loadingMore ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-brand-orange" />
                          ) : (
                            <ChevronRight className="w-4 h-4 rotate-90 text-white/40 group-hover:text-brand-orange" />
                          )}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40 group-hover:opacity-100 transition-opacity">
                          {loadingMore ? "Loading..." : "Load More"}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Resize Handle */}
        <div
          onMouseDown={() => setIsResizing(true)}
          className={cn(
            "hidden lg:block w-8 h-full cursor-col-resize transition-all z-50 group flex-shrink-0 relative",
            isResizing && "bg-white/[0.03]",
            isSidebarHidden && "w-10 opacity-80"
          )}
        >
          <div
            className={cn(
              "absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-white/5 group-hover:bg-white/15 transition-colors",
              isResizing && "bg-brand-orange/60",
            )}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSidebarHidden(!isSidebarHidden);
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-14 rounded-full border border-white/10 bg-panel/95 backdrop-blur-sm flex items-center justify-center text-white/30 hover:text-white/70 hover:border-white/20 transition-all"
            title={isSidebarHidden ? "Show panel" : "Hide panel"}
          >
            <ChevronRight
              className={cn(
                "w-3.5 h-3.5 transition-transform",
                isSidebarHidden ? "rotate-0" : "rotate-180",
              )}
            />
          </button>
        </div>

        {/* Diff Content View */}
        <section className="flex-1 min-h-full bg-onyx relative overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {selectedPull || selectedBranch ? (
              <motion.div
                key={
                  selectedPull
                    ? `pull-${selectedPull.id}`
                    : `branch-${selectedBranch!.name}`
                }
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 sm:p-6 lg:p-12 pt-12 sm:pt-6 lg:pt-12 space-y-8 lg:space-y-12"
              >
                {/* PR/Branch Meta Header */}
                <div className="flex flex-col xl:flex-row justify-between items-start gap-8 lg:gap-12 pb-8 lg:pb-12 border-b border-white/5">
                  <div className="space-y-4 lg:space-y-6 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-brand-orange" />
                      <span className="text-[9px] uppercase tracking-[0.4em] font-medium opacity-30">
                        {selectedPull ? "Pull Request" : "Branch View"}
                      </span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-7xl font-serif italic tracking-tighter leading-[0.95] lg:leading-[0.85] break-words">
                      {selectedPull ? selectedPull.title : selectedBranch!.name}
                    </h2>
                      <div className="flex flex-wrap gap-8 items-center pt-2">
                        {selectedPull && (
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-mono text-brand-orange/80">
                              #{selectedPull.number}
                            </span>
                            {selectedPull.draft && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 border border-white/5 opacity-40 uppercase tracking-widest rounded-sm">
                                Draft
                              </span>
                            )}
                            {selectedPull.base && selectedPull.head && (
                              <div className="flex items-center gap-2 text-[9px] font-mono opacity-30">
                                <span className="opacity-60">{selectedPull.base.ref}</span>
                                <ChevronRight className="w-2.5 h-2.5 opacity-40" />
                                <span className="text-brand-orange/60">{selectedPull.head.ref}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {selectedPull && (
                          <div className="w-[1px] h-8 bg-white/10 hidden sm:block" />
                        )}

                        {selectedPull && checkRuns.length > 0 && (
                          <>
                            <button
                              onClick={() => {
                                setActiveTab("discussion");
                                setTimeout(() => scrollToSection("ci-pipeline"), 100);
                              }}
                              className="flex items-center gap-2 hover:bg-white/5 p-1 -m-1 transition-all rounded group"
                            >
                              {(() => {
                                const stats = checkRuns.reduce(
                                  (acc, run) => {
                                    if (run.status !== "completed") acc.pending++;
                                    else if (run.conclusion === "success") acc.success++;
                                    else if (run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "action_required" || run.conclusion === "startup_failure" || run.conclusion === "stale") acc.failure++;
                                    else if (run.conclusion === "cancelled") acc.cancelled++;
                                    else if (run.conclusion === "skipped") acc.skipped++;
                                    else acc.other++;
                                    return acc;
                                  },
                                  { success: 0, failure: 0, pending: 0, cancelled: 0, skipped: 0, other: 0 }
                                );

                                if (stats.failure > 0) return <XCircle className="w-5 h-5 text-rose-500" />;
                                if (stats.cancelled > 0) return <CircleSlash className="w-5 h-5 text-orange-500" />;
                                if (stats.pending > 0) return <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" />;
                                if (stats.success === checkRuns.length - stats.skipped) return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
                                return <Circle className="w-5 h-5 text-white/20" />;
                              })()}

                              <div className="flex flex-col text-left">
                                <span className="text-[8px] uppercase tracking-widest opacity-40 font-bold group-hover:opacity-60">Checks</span>
                                <span className={cn(
                                  "text-[10px] font-mono",
                                  checkRuns.every(r => r.conclusion === "success" || r.conclusion === "skipped") ? "text-emerald-500" :
                                  checkRuns.some(r => r.conclusion === "failure" || r.conclusion === "timed_out" || r.conclusion === "startup_failure") ? "text-rose-500" :
                                  checkRuns.some(r => r.conclusion === "cancelled") ? "text-orange-500" :
                                  "text-amber-500"
                                )}>
                                  {checkRuns.filter(r => r.conclusion === "success").length}/{checkRuns.length} Passed
                                </span>
                            </div>
                          </button>
                          <div className="w-[1px] h-8 bg-white/10 hidden sm:block" />
                        </>
                      )}

                      <div className="space-y-1">
                        <p className="text-sm font-serif italic opacity-40">
                          {selectedPull
                            ? new Date(
                                selectedPull.created_at,
                              ).toLocaleDateString()
                            : "Comparing head against " +
                              repoInfo?.default_branch}
                        </p>
                      </div>
                    </div>
                  </div>

                  <a
                    href={
                      selectedPull
                        ? selectedPull.html_url
                        : `${repoInfo?.html_url}/tree/${selectedBranch!.name}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.4em] text-white/20 hover:text-white/40 transition-all"
                  >
                    Open Source <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                  </a>
                </div>

                {/* Tabs */}
                <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-12 px-4 sm:px-6 lg:px-12 bg-onyx/95 backdrop-blur-md border-b border-white/5">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab("diff")}
                      className={cn(
                        "px-8 py-5 text-[9px] uppercase tracking-[0.4em] font-medium transition-all relative overflow-hidden group",
                        activeTab === "diff"
                          ? "text-brand-orange"
                          : "text-white/20 hover:text-white/40",
                      )}
                    >
                      Diff
                      {activeTab === "diff" && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-[1px] bg-brand-orange"
                        />
                      )}
                    </button>
                    {selectedPull && (
                      <button
                        onClick={() => setActiveTab("discussion")}
                        className={cn(
                          "px-8 py-5 text-[9px] uppercase tracking-[0.4em] font-medium transition-all relative overflow-hidden group flex items-center gap-2",
                          activeTab === "discussion"
                            ? "text-brand-orange"
                            : "text-white/20 hover:text-white/40",
                        )}
                      >
                        Review
                        {comments.length + reviewComments.length > 0 && (
                          <span className="text-brand-orange/60 text-[8px] font-mono opacity-80">
                            ({comments.length + reviewComments.length})
                          </span>
                        )}
                        {activeTab === "discussion" && (
                          <motion.div
                            layoutId="activeTab"
                            className="absolute bottom-0 left-0 right-0 h-[1px] bg-brand-orange"
                          />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab("timeline")}
                      className={cn(
                        "px-8 py-5 text-[9px] uppercase tracking-[0.4em] font-medium transition-all relative overflow-hidden group flex items-center gap-2",
                        activeTab === "timeline"
                          ? "text-brand-orange"
                          : "text-white/20 hover:text-white/40",
                      )}
                    >
                      History
                        {activeTab === "timeline" && (
                          <motion.div
                            layoutId="activeTab"
                            className="absolute bottom-0 left-0 right-0 h-[1px] bg-brand-orange"
                          />
                        )}
                      </button>
                    </div>
                  </div>

                {/* Tab Content */}
                <div className="space-y-12 min-h-[600px]">
                  {activeTab === "timeline" ? (
                    <div className="max-w-3xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="relative space-y-12 lg:space-y-16 py-4">
                        {/* The Vertical Line */}
                        <div className="absolute left-[20px] top-0 bottom-0 w-px bg-white/5" />

                        {getTimeline().map((event, idx) => (
                          <motion.div
                            key={`${event.type}-${idx}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="relative pl-12 sm:pl-20 group"
                          >
                            {/* Dot */}
                            <div className={cn(
                              "absolute left-4 w-[18px] h-[18px] rounded-full border-2 bg-onyx z-10 top-1 transition-transform group-hover:scale-125 duration-300 flex items-center justify-center",
                              event.type === 'pr_created' ? "border-brand-orange" :
                              event.type === 'commit' ? "border-sky-500/40" :
                              event.type === 'review' ? "border-emerald-500/40" :
                              "border-white/10"
                            )}>
                               {event.type === 'commit' && <GitCommit className="w-2 h-2 text-sky-500" />}
                               {event.type === 'review' && <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />}
                               {event.type === 'pr_created' && <ArrowDown className="w-2.5 h-2.5 text-brand-orange" />}
                            </div>

                            <div className="space-y-4">
                              <div className="flex items-center gap-4 text-[9px] font-mono opacity-30 uppercase tracking-widest">
                                <span>{new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                <span>{new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {event.type === 'commit' && <span className="text-[8px] uppercase tracking-widest text-white/20">Commit</span>}
                                {event.type === 'review' && <span className={cn(
                                  "text-[8px] uppercase tracking-widest",
                                  (event.data as GithubReview).state === 'APPROVED' ? "text-emerald-500/40" : "text-rose-500/40"
                                )}>Review: {(event.data as GithubReview).state.toLowerCase()}</span>}
                              </div>

                            <div className="space-y-4 pt-1">
                              {event.type === 'pr_created' && (
                                <div className="space-y-4 border-l border-white/5 pl-6">
                                  <div className="flex items-center gap-4">
                                    <img src={event.data.user.avatar_url} className="w-6 h-6 rounded-full opacity-40 shrink-0" />
                                    <div>
                                      <p className="text-sm font-medium text-white/80">{event.data.user.login} <span className="text-[9px] uppercase tracking-wider text-white/20 ml-2">Opened</span></p>
                                    </div>
                                  </div>
                                  <div className="markdown-body prose prose-invert prose-xs max-w-none text-white/30 text-[11px]">
                                    <ReactMarkdown>{event.data.body || "No description provided."}</ReactMarkdown>
                                  </div>
                                </div>
                              )}

                              {event.type === 'commit' && (
                                <div className="space-y-4 border-l border-white/5 pl-6">
                                  <div className="flex items-center gap-4">
                                    <img src={(event.data as GithubCommit).author?.avatar_url} className="w-4 h-4 rounded-full opacity-20 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-[13px] font-normal text-white/40 line-clamp-2 leading-relaxed">{(event.data as GithubCommit).commit.message} <span className="text-[8px] text-white/10 font-mono ml-2">{(event.data as GithubCommit).sha.substring(0, 7)}</span></p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {event.type === 'review' && (
                                <div className="space-y-4 border-l border-white/5 pl-6">
                                   <div className="flex items-center gap-4">
                                    <img src={(event.data as GithubReview).user.avatar_url} className="w-6 h-6 rounded-full opacity-40 shrink-0" />
                                    <div>
                                      <p className="text-sm font-medium text-white/80">{(event.data as GithubReview).user.login} <span className={cn(
                                        "text-[9px] uppercase tracking-widest ml-2",
                                        (event.data as GithubReview).state === 'APPROVED' ? "text-emerald-500/40" : "text-rose-500/40"
                                      )}>
                                        {(event.data as GithubReview).state.replace('_', ' ')}
                                      </span></p>
                                    </div>
                                  </div>
                                  {(event.data as GithubReview).body && (
                                    <div className="markdown-body prose prose-invert prose-xs max-w-none text-white/30 text-[11px]">
                                      <ReactMarkdown>{(event.data as GithubReview).body}</ReactMarkdown>
                                    </div>
                                  )}
                                </div>
                              )}

                              {event.type === 'comment' && (
                                <div className="space-y-4 border-l border-white/5 pl-6">
                                  <div className="flex items-center gap-4">
                                    <img src={(event.data as GithubComment).user.avatar_url} className="w-6 h-6 rounded-full opacity-40 shrink-0" />
                                    <p className="text-sm font-medium text-white/80">{(event.data as GithubComment).user.login} <span className="text-[9px] uppercase tracking-widest text-white/20 ml-2">Review</span></p>
                                  </div>
                                  <div className="markdown-body prose prose-invert prose-xs max-w-none text-white/30">
                                    <ReactMarkdown>{(event.data as GithubComment).body}</ReactMarkdown>
                                  </div>
                                  {(event.data as GithubComment).path && (
                                    <button
                                      onClick={() => {
                                        const comment = event.data as GithubComment;
                                        const line = comment.line || comment.original_line;
                                        if (comment.path && line) {
                                          navigateToComment(comment.path, line);
                                        }
                                      }}
                                      className="flex items-center justify-between w-full opacity-40 hover:opacity-100 transition-opacity"
                                    >
                                       <div className="flex items-center gap-2 overflow-hidden">
                                          {getFileIcon((event.data as GithubComment).path)}
                                          <span className="text-[8px] font-mono truncate">{(event.data as GithubComment).path}</span>
                                          <span className="shrink-0 rounded-sm border border-white/[0.04] bg-white/[0.015] px-1 py-px text-[6px] font-medium uppercase tracking-[0.16em] text-white/14">
                                            {getFileKindLabel((event.data as GithubComment).path)}
                                          </span>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <span className="text-[8px] font-mono">Line {(event.data as GithubComment).line || (event.data as GithubComment).original_line}</span>
                                       </div>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ) : activeTab === "diff" ? (
                    <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {/* File List */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                          <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
                            Files
                          </h3>
                          <span className="text-[10px] font-mono text-white/10">
                            {files.length}
                          </span>
                        </div>
                        <div className="flex flex-col border border-white/5 bg-onyx/40 max-h-[300px] lg:max-h-[600px] overflow-y-auto custom-scrollbar rounded-xl">
                          {files.length > 0 ? (
                            files.map((file) => (
                              <button
                                key={file.sha}
                                onClick={() => setSelectedFile(file)}
                                className={cn(
                                  "text-left p-4 border-b border-white/5 transition-all group relative",
                                  selectedFile?.sha === file.sha
                                    ? "bg-brand-orange/5"
                                    : "hover:bg-white/[0.02]",
                                )}
                              >
                                {selectedFile?.sha === file.sha && (
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange" />
                                )}
                                <div className="space-y-2">
                                  <p
                                    className={cn(
                                      "text-[10px] font-mono truncate transition-colors",
                                      selectedFile?.sha === file.sha
                                        ? "text-brand-orange"
                                        : "text-white/40 group-hover:text-white/60",
                                    )}
                                  >
                                    {file.filename}
                                  </p>
                                  <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-widest">
                                    <span className="text-emerald-500/60">
                                      +{file.additions}
                                    </span>
                                    <span className="text-rose-500/60">
                                      -{file.deletions}
                                    </span>
                                    <span
                                      className={cn(
                                        "px-1.5 py-0.5 border text-[7px]",
                                        file.status === "modified"
                                          ? "border-amber-500/20 text-amber-500/60"
                                          : file.status === "added"
                                            ? "border-emerald-500/20 text-emerald-500/60"
                                            : "border-rose-500/20 text-rose-500/60",
                                      )}
                                    >
                                      {file.status}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="p-8 text-center text-[10px] uppercase tracking-[0.2em] opacity-20 italic">
                              No files changed
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Diff Editor */}
                      <div
                        className={cn(
                          "space-y-8 min-w-0 transition-all duration-500",
                          isFullscreen &&
                            "fixed inset-0 z-[100] bg-onyx p-8 sm:p-12 lg:p-16 overflow-y-auto custom-scrollbar",
                        )}
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                          <div className="flex items-center gap-2 text-white/20">
                            <Code className="w-3 h-3" />
                            <h3 className="text-[9px] font-bold uppercase tracking-[0.4em]">
                              Source Buffer
                            </h3>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-[9px] font-mono opacity-20 uppercase tracking-widest leading-none hidden sm:block">
                              {selectedFile?.filename || "No file selected"}
                            </div>
                            <button
                              onClick={() => setIsFullscreen(!isFullscreen)}
                              className="text-[9px] uppercase tracking-widest opacity-20 hover:opacity-100 transition-opacity flex items-center gap-2 group"
                            >
                              {isFullscreen ? (
                                <>
                                  Minimize <Minimize2 className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                                </>
                              ) : (
                                <>
                                  Maximize <Maximize2 className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className={cn("relative", isFullscreen && "max-w-7xl mx-auto")}>
                          <div className="relative bg-panel border border-white/5 overflow-hidden rounded-2xl">
                            {loadingFiles ? (
                              <div className="p-20 lg:p-32 flex flex-col items-center justify-center space-y-6 text-center">
                                <div className="w-1.5 h-1.5 bg-brand-orange animate-pulse" />
                                <p className="text-[9px] uppercase tracking-[0.5em] text-brand-orange/40 font-medium">
                                  Decoding Diff Stream...
                                </p>
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "overflow-auto custom-scrollbar w-full",
                                  isFullscreen
                                    ? "max-h-[calc(100vh-16rem)]"
                                    : "max-h-[600px] lg:max-h-[800px]",
                                )}
                              >
                                {selectedFile?.patch ? (
                                  <div className="w-fit min-w-full bg-black/20 font-mono text-[10px] sm:text-xs leading-relaxed">
                                    {diffRows.map((row, index) => (
                                      <div
                                        key={`${index}-${row.content}`}
                                        id={row.newLine ? `line-${selectedFile?.filename}-${row.newLine}` : undefined}
                                        className={cn(
                                          "grid min-w-full grid-cols-[3.5rem_3.5rem_1fr] transition-colors duration-500",
                                          row.kind === "added" &&
                                            "bg-emerald-500/[0.08] text-emerald-300/80",
                                          row.kind === "deleted" &&
                                            "bg-rose-500/[0.08] text-rose-300/80",
                                          row.kind === "hunk" &&
                                            "bg-brand-orange/[0.1] text-brand-orange/50",
                                          row.kind === "meta" &&
                                            "text-white/20",
                                          row.kind === "context" && "text-white/60",
                                        )}
                                      >
                                        <div className="px-3 py-0.5 text-right text-white/10 select-none border-r border-white/5">
                                          {row.oldLine ?? ""}
                                        </div>
                                        <div className="px-3 py-0.5 text-right text-white/10 select-none border-r border-white/5">
                                          {row.newLine ?? ""}
                                        </div>
                                        <pre className="px-4 py-0.5 whitespace-pre overflow-x-visible">
                                          {row.content || " "}
                                        </pre>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <pre className="w-fit min-w-full p-4 sm:p-6 lg:p-8 text-[10px] sm:text-xs lg:text-sm font-mono leading-relaxed !bg-onyx/40 !m-0 overflow-x-visible text-white/60">
                                    {selectedFile
                                      ? "Binary file or no changes shown."
                                      : files.length > 0
                                        ? "Select a file from the manifest to view its diff."
                                        : "No code changes detected in this context."}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {/* CI Checks List */}
                      {selectedPull && checkRuns.length > 0 && (
                        <section id="ci-pipeline" className="space-y-8 scroll-mt-24">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
                                Pipeline
                              </h3>
                            </div>
                            <span className="text-[10px] font-mono text-white/10">
                              {checkRuns.length}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {checkRuns.map((run) => (
                              <button
                                key={run.id}
                                onClick={() => setSelectedRunId(run.id)}
                                className="flex items-center justify-between py-6 border-l border-white/5 pl-8 hover:border-brand-orange/30 transition-all group text-left w-full hover:bg-white/[0.01]"
                              >
                                <div className="flex items-center gap-6 min-w-0">
                                  <div className={cn(
                                    "w-1 h-1 rounded-full",
                                    run.conclusion === "success" ? "bg-emerald-500/40" :
                                    (run.conclusion === "failure" || run.conclusion === "timed_out") ? "bg-rose-500/40" :
                                    "bg-white/10"
                                  )} />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 group-hover:text-white/80 transition-colors truncate">
                                        {run.name}
                                      </span>
                                      <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[9px] font-mono text-white/10">{run.conclusion || run.status}</span>
                                      </div>
                                    </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* PR Description */}
                      <section className="space-y-6">
                        <div className="prose prose-invert prose-orange max-w-none border-l border-white/5 pl-8 py-2">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw, rehypeSanitize]}
                            components={markdownComponents}
                          >
                            {selectedPull.body || "_No description provided._"}
                          </ReactMarkdown>
                        </div>
                      </section>

                      {/* General Comments */}
                      {comments.length > 0 && (
                        <section className="space-y-12">
                          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                            <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
                              Discussion
                            </h3>
                          </div>
                          <div className="space-y-12">
                            {comments.map((comment) => (
                              <div
                                key={comment.id}
                                className="flex gap-8 group"
                              >
                                <img
                                  src={comment.user.avatar_url}
                                  alt=""
                                  className="w-8 h-8 grayscale opacity-20 shrink-0 rounded-full group-hover:opacity-40 transition-opacity"
                                />
                                <div className="space-y-4 flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] tracking-wider font-medium text-white/40 group-hover:text-white/60 transition-colors">
                                      {comment.user.login}
                                    </span>
                                    <span className="text-[9px] text-white/10 font-mono">
                                      {new Date(comment.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="prose prose-invert prose-sm max-w-none text-white/50 leading-relaxed font-sans border-l border-white/5 pl-6">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                                      components={markdownComponents}
                                    >
                                      {comment.body}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Review Comments */}
                      {reviewComments.length > 0 && (
                        <section className="space-y-12">
                          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                            <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
                              Annotations
                            </h3>
                          </div>
                          <div className="space-y-12">
                            {reviewComments.map((comment) => (
                              <div
                                key={comment.id}
                                className="space-y-6 group"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {getFileIcon(comment.path)}
                                    <span className="text-[9px] font-mono text-white/20">
                                      {comment.path}
                                    </span>
                                    <span className="shrink-0 rounded-sm border border-white/[0.04] bg-white/[0.015] px-1 py-px text-[6px] font-medium uppercase tracking-[0.16em] text-white/14">
                                      {getFileKindLabel(comment.path)}
                                    </span>
                                  </div>
                                  <a
                                    href={comment.html_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[9px] text-white/10 hover:text-white/40 font-mono italic transition-all"
                                  >
                                    {formatReviewCommentLine(comment)}
                                  </a>
                                </div>
                                <div className="flex gap-8">
                                  <img
                                    src={comment.user.avatar_url}
                                    alt=""
                                    className="w-8 h-8 grayscale opacity-20 shrink-0 rounded-full group-hover:opacity-40 transition-opacity"
                                  />
                                  <div className="space-y-4 flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] tracking-wider font-medium text-white/40 group-hover:text-white/60 transition-colors">
                                        {comment.user.login}
                                      </span>
                                      <span className="text-[9px] text-white/10 font-mono">
                                        {new Date(comment.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className="prose prose-invert prose-sm max-w-none text-white/30 border-l border-white/5 pl-8 py-1">
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw, rehypeSanitize]}
                                        components={markdownComponents}
                                      >
                                        {comment.body}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}


                      {loadingComments && (
                        <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-20">
                          <RefreshCw className="w-8 h-8 animate-spin" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {selectedRunId && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-12 pointer-events-none"
                    >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="w-full max-w-4xl max-h-[85vh] bg-panel border border-white/10 rounded-2xl lg:rounded-3xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto"
                    >
                        {(() => {
                          const run = checkRuns.find(r => r.id === selectedRunId);
                          if (!run) return null;

                          return (
                            <>
                              {/* Header */}
                              <div className="p-5 sm:p-6 lg:p-8 border-b border-white/5 flex items-start justify-between gap-4">
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className="flex flex-col">
                                    <span className="mb-1 text-[8px] uppercase tracking-[0.2em] font-medium text-white/20">
                                      {run.type === "status" ? "Commit Status" : "Check Run"}
                                    </span>
                                    <div className="flex items-center gap-4">
                                      <h2 className="text-xs sm:text-sm font-medium uppercase tracking-[0.2em] text-white/50 break-words">
                                        {run.name}
                                      </h2>
                                      <div className={cn(
                                        "w-1 h-1 rounded-full",
                                        run.conclusion === "success" ? "bg-emerald-500/40" :
                                        (run.conclusion === "failure" || run.conclusion === "timed_out") ? "bg-rose-500/40" :
                                        "bg-white/10"
                                      )} />
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setSelectedRunId(null)}
                                  className="text-[9px] uppercase tracking-[0.2em] text-white/10 hover:text-white/40 transition-all font-medium"
                                >
                                  Close
                                </button>
                              </div>

                              {/* Content */}
                              <div className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-12 space-y-10 lg:space-y-16 custom-scrollbar">
                                {/* Summary Section */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-12 border-b border-white/5 pb-8 lg:pb-12">
                                  <div className="space-y-2">
                                    <span className="text-[8px] uppercase tracking-[0.2em] font-medium text-white/20">Status</span>
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        run.status === "completed" ? "bg-emerald-500/40" : "bg-amber-500 animate-pulse"
                                      )} />
                                      <span className="text-sm font-light text-white/60">{run.status}</span>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <span className="text-[8px] uppercase tracking-[0.2em] font-medium text-white/20">Conclusion</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-light text-white/60 capitalize">{run.conclusion || "Pending"}</span>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <span className="text-[8px] uppercase tracking-[0.2em] font-medium text-white/20">Execution</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-light text-white/60">
                                        {run.started_at ? (
                                          <>
                                            {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {run.completed_at && ` — ${new Date(run.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                          </>
                                        ) : "—"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Visual Workflow Diagram */}
                                <div className="space-y-8">
                                  <div className="flex items-center gap-3">
                                    <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
                                      Related Checks
                                    </h3>
                                  </div>

                                  <div className="relative">
                                    <div className="flex flex-wrap items-center gap-6 lg:gap-12 py-6 lg:py-8 justify-center lg:justify-start">
                                      {loadingRunDetail ? (
                                        <div className="flex-1 flex items-center justify-center opacity-10">
                                          <RefreshCw className="w-3 h-3 animate-spin mr-3" />
                                          <span className="text-[9px] uppercase tracking-widest font-medium">Resolving...</span>
                                        </div>
                                      ) : selectedRunDetail?.suite_runs && selectedRunDetail.suite_runs.length > 0 ? (
                                        selectedRunDetail.suite_runs.map((suiteRun, idx) => (
                                          <div key={suiteRun.id} className="flex items-center shrink-0">
                                            <button
                                              onClick={() => setSelectedRunId(suiteRun.id)}
                                              className={cn(
                                                "relative pb-2 transition-all group",
                                                suiteRun.id === run.id ? "opacity-100" : "opacity-20 hover:opacity-40"
                                              )}
                                            >
                                              <div className="flex items-center gap-3">
                                                <div className={cn(
                                                  "w-1 h-1 rounded-full",
                                                  suiteRun.conclusion === "success" ? "bg-emerald-500/60" :
                                                  suiteRun.conclusion === "failure" ? "bg-rose-500/60" :
                                                  "bg-white/30"
                                                )} />
                                                <span className="text-[10px] font-medium text-white/80 tracking-wide">{suiteRun.name}</span>
                                              </div>
                                              {suiteRun.id === run.id && (
                                                <div className="absolute -bottom-px left-0 right-0 h-0.5 bg-brand-orange/40" />
                                              )}
                                            </button>
                                            {idx < selectedRunDetail.suite_runs.length - 1 && (
                                              <div className="ml-12 text-white/5">
                                                <ChevronRight className="w-3 h-3" />
                                              </div>
                                            )}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center py-6 opacity-10">
                                          <span className="text-[8px] uppercase tracking-widest font-medium">
                                            Single Check
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Detailed Info */}
                                <div className="space-y-16">
                                  {/* Metadata Grid */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                                    <div className="space-y-4">
                                      <div className="flex items-center gap-2 text-white/10">
                                        <span className="text-[8px] uppercase tracking-widest font-medium">Details</span>
                                      </div>
                                      <div className="space-y-3">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between text-[11px]">
                                          <span className="text-white/20">ID</span>
                                          <span className="font-mono text-white/40 break-all sm:text-right">{run.id}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between text-[11px]">
                                          <span className="text-white/20">Branch</span>
                                          <span className="font-mono text-white/40 break-all sm:text-right">{run.check_suite?.head_branch || "n/a"}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-4">
                                      <div className="flex items-center gap-2 text-white/10">
                                        <span className="text-[8px] uppercase tracking-widest font-medium">Timing</span>
                                      </div>
                                      <div className="space-y-3">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between text-[11px]">
                                          <span className="text-white/20">Duration</span>
                                          <span className="font-mono text-white/40 sm:text-right">
                                            {run.started_at && run.completed_at
                                              ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 60000)}m ${Math.round(((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) % 60000) / 1000)}s`
                                              : "Ongoing"}
                                          </span>
                                        </div>
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between text-[11px]">
                                          <span className="text-white/20">Started</span>
                                          <span className="font-mono text-white/40 sm:text-right">{run.started_at ? new Date(run.started_at).toLocaleTimeString() : "n/a"}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>


                                  {/* Annotations Section */}
                                  {selectedRunDetail?.annotations && selectedRunDetail.annotations.length > 0 && (
                                    <div className="space-y-8">
                                      <div className="flex items-center gap-3">
                                        <AlertCircle className="w-4 h-4 text-rose-500/40" />
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Annotations ({selectedRunDetail.annotations.length})</h3>
                                      </div>
                                      <div className="space-y-4">
                                        {selectedRunDetail.annotations.map((ann, idx) => (
                                          <div key={idx} className="p-4 sm:p-5 lg:p-6 bg-rose-500/[0.02] border border-rose-500/10 rounded-2xl space-y-3 min-w-0">
                                            <div className="flex items-start justify-between gap-3 min-w-0">
                                              <div className="flex items-start gap-3 min-w-0">
                                                {getFileIcon(ann.path)}
                                                <span className="text-[10px] font-mono text-white/40 underline decoration-white/5 underline-offset-4 break-all min-w-0">{ann.path}:{ann.start_line}</span>
                                                <span className="shrink-0 rounded-sm border border-white/[0.04] bg-white/[0.015] px-1 py-px text-[6px] font-medium uppercase tracking-[0.16em] text-white/14">
                                                  {getFileKindLabel(ann.path)}
                                                </span>
                                              </div>
                                            </div>
                                            <p className="text-xs text-white/80 font-mono leading-relaxed break-words overflow-hidden">{ann.message}</p>
                                            {ann.raw_details && (
                                              <pre className="p-3 sm:p-4 bg-black/40 rounded-lg text-[9px] font-mono text-white/40 overflow-x-auto whitespace-pre-wrap break-words">
                                                {ann.raw_details}
                                              </pre>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Section Toggles */}
                                  <div className="flex items-center gap-6 sm:gap-12 border-b border-white/5 pb-2 self-start">
                                    <button
                                      onClick={() => setCheckDetailTab("steps")}
                                      className={cn(
                                        "text-[10px] font-medium uppercase tracking-[0.2em] transition-all relative pb-2",
                                        checkDetailTab === "steps" ? "text-white" : "text-white/10 hover:text-white/30"
                                      )}
                                    >
                                      {checkDetailTab === "steps" && (
                                        <motion.div layoutId="tab-active" className="absolute -bottom-[2px] left-0 right-0 h-0.5 bg-brand-orange/40" />
                                      )}
                                      Steps
                                    </button>
                                    <button
                                      onClick={() => setCheckDetailTab("logs")}
                                      className={cn(
                                        "text-[10px] font-medium uppercase tracking-[0.2em] transition-all relative pb-2",
                                        checkDetailTab === "logs" ? "text-white" : "text-white/10 hover:text-white/30"
                                      )}
                                    >
                                      {checkDetailTab === "logs" && (
                                        <motion.div layoutId="tab-active" className="absolute -bottom-[2px] left-0 right-0 h-0.5 bg-brand-orange/40" />
                                      )}
                                      Raw Logs
                                    </button>
                                  </div>

                                  {checkDetailTab === "steps" ? (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">Steps</h3>
                                          {(selectedRunDetail?.status === "in_progress" || selectedRunDetail?.status === "queued") && (
                                            <div className="flex items-center gap-2 px-1.5 py-0.5 bg-amber-500/5 border border-amber-500/10 rounded-sm">
                                              <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                                              <span className="text-[7px] font-medium uppercase tracking-widest text-amber-500/60">Live</span>
                                            </div>
                                          )}
                                        </div>
                                        {selectedRunDetail?.steps && selectedRunDetail.steps.length > 0 && (
                                          <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest">
                                            {selectedRunDetail.steps.length} Steps Found
                                          </span>
                                        )}
                                      </div>

                                      <div className="space-y-4 min-w-0">
                                        {errorRunDetail && (
                                          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl mb-4 flex items-center gap-3">
                                            <AlertCircle className="w-4 h-4 text-rose-500" />
                                            <span className="text-[10px] font-mono text-rose-500/80">{errorRunDetail}</span>
                                          </div>
                                        )}

                                        {/* Main Content Area */}
                                        {run.type === "status" ? (
                                          <div className="p-12 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col items-center space-y-4 opacity-10">
                                            <CircleSlash className="w-4 h-4" />
                                            <p className="text-[10px] uppercase tracking-widest font-medium">Commit Status</p>
                                          </div>
                                        ) : loadingRunDetail ? (
                                          <div className="py-12 flex flex-col items-center justify-center space-y-4 opacity-20">
                                            <RefreshCw className="w-6 h-6 animate-spin" />
                                            <p className="text-[8px] uppercase tracking-widest font-medium">Fetching details...</p>
                                          </div>
                                        ) : (selectedRunDetail?.steps && selectedRunDetail.steps.length > 0) ? (
                                          <div className="space-y-4 sm:space-y-6">
                                            {selectedRunDetail.steps.map((step, idx) => (
                                              <div
                                                key={step.number || idx}
                                                className="group animate-in fade-in slide-in-from-left-4 duration-300 fill-mode-both"
                                                style={{ animationDelay: `${idx * 40}ms` }}
                                              >
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-1 cursor-default border-l border-white/5 pl-5 sm:pl-8 group-hover:border-white/20 transition-all min-w-0">
                                                  <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                                                    <div className={cn(
                                                      "w-1 h-1 rounded-full",
                                                      step.conclusion === "success" ? "bg-emerald-500/40" :
                                                      step.conclusion === "failure" ? "bg-rose-500/40" :
                                                      step.status === "in_progress" ? "bg-amber-500 animate-pulse" :
                                                      "bg-white/10"
                                                    )} />
                                                    <div className="space-y-0.5 min-w-0">
                                                      <span className="text-[11px] font-medium text-white/60 group-hover:text-white/80 transition-colors break-words">{step.name}</span>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8">
                                                    <span className="text-[8px] font-mono text-white/10 uppercase tracking-[0.2em]">{step.conclusion || step.status}</span>
                                                    {step.started_at && step.completed_at && (
                                                      <span className="text-[9px] font-mono text-white/20 min-w-[40px] text-right">
                                                        {Math.round((new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000)}s
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (selectedRunDetail?.output?.summary || selectedRunDetail?.output?.text) ? (
                                          <div className="space-y-6">
                                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                                              <div className="flex items-center gap-2 text-white/20">
                                                <FileText className="w-3 h-3" />
                                                <span className="text-[8px] uppercase tracking-widest font-bold font-mono">Run Summary</span>
                                              </div>
                                              <div className="markdown-body prose prose-invert prose-xs max-w-none text-white/60">
                                                <ReactMarkdown>
                                                  {selectedRunDetail?.output?.summary || selectedRunDetail?.output?.text || ""}
                                                </ReactMarkdown>
                                              </div>
                                            </div>
                                            <div className="flex flex-col items-center py-6 opacity-20 space-y-2">
                                              <p className="text-[8px] uppercase tracking-widest font-bold">No step details available</p>
                                              <p className="text-[8px] text-center max-w-xs">Showing the run summary instead.</p>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="p-12 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center space-y-4 opacity-20">
                                            <Activity className="w-8 h-8" />
                                            <div className="text-center space-y-1">
                                              <p className="text-[10px] uppercase tracking-widest font-bold">No step data available</p>
                                              <p className="text-[8px] max-w-xs leading-relaxed">This run does not expose step-level details yet.</p>
                                            </div>
                                            <button
                                              onClick={() => window.open(run.html_url, '_blank')}
                                              className="px-6 py-2 border border-white/10 rounded-lg text-[8px] uppercase font-bold tracking-widest hover:bg-white/5 transition-all mt-4"
                                            >
                                              Open in GitHub
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">Logs</h3>
                                          {(selectedRunDetail?.status === "in_progress" || selectedRunDetail?.status === "queued") && (
                                            <div className="flex items-center gap-2 px-1.5 py-0.5 bg-brand-orange/5 border border-brand-orange/10 rounded-sm">
                                              <div className="w-1 h-1 bg-brand-orange rounded-full animate-pulse" />
                                              <span className="text-[7px] font-medium uppercase tracking-widest text-brand-orange/60">Streaming</span>
                                            </div>
                                          )}
                                        </div>
                                        {runLogs && (
                                          <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest">
                                            {runLogs.split('\n').length.toLocaleString()} Lines
                                          </span>
                                        )}
                                      </div>

                                      <div className="bg-transparent border-l border-white/5 relative group min-w-0">
                                        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex gap-2 max-w-[calc(100%-1.5rem)]">
                                          {loadingLogs && (
                                            <div className="px-2 py-1 border border-white/5 rounded flex items-center gap-2">
                                              <RefreshCw className="w-2.5 h-2.5 animate-spin text-white/10" />
                                              <span className="text-[8px] uppercase tracking-widest font-medium text-white/10">Streaming...</span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-col">
                                          <div className="p-4 sm:p-6 lg:p-8 font-mono text-[11px] leading-relaxed text-white/30 overflow-x-auto whitespace-pre-wrap break-words overflow-y-auto custom-scrollbar min-h-[320px] sm:min-h-[400px] max-h-[700px] min-w-0">
                                            {runLogs ? (
                                              runLogs
                                            ) : loadingLogs ? (
                                              <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-10">
                                                <RefreshCw className="w-8 h-8 animate-spin" />
                                                <p className="text-[9px] uppercase tracking-widest font-medium text-white/5">Fetching output...</p>
                                              </div>
                                            ) : (
                                              <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-10">
                                                <Activity className="w-8 h-8" />
                                                <p className="text-[9px] uppercase tracking-widest font-medium">
                                                  {errorRunDetail ? "No data found" : "No logs available"}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* External Link Footer */}
                                <div className="pt-8 border-t border-white/5">
                                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <p className="text-[10px] text-white/30 max-w-md">
                                      Open the GitHub Actions run for raw logs, artifacts, and full step details.
                                    </p>
                                    <a
                                      href={run.html_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group shrink-0"
                                    >
                                      <span className="text-[10px] font-bold uppercase tracking-widest">Open in GitHub</span>
                                      <ExternalLink className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* System Stats Footer */}
                <div className="pb-12" />
              </motion.div>
            ) : (
              <div className="min-h-[400px] flex items-center justify-center p-12">
                {!loading && (
                  <div className="text-center space-y-6 max-w-sm px-12">
                    <Code className="w-12 h-12 text-brand-orange/20 mx-auto" />
                    <p className="text-[10px] uppercase tracking-[0.5em] text-white/20 font-black leading-loose">
                      Select an item to inspect the diff.
                    </p>
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Software Updates Modal */}
      <AnimatePresence>
        {showUpdates && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUpdates(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 sm:px-6 lg:px-8 lg:py-5 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-4">
                  <h2 className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/30">Updates</h2>
                </div>
                <button
                  onClick={() => setShowUpdates(false)}
                  className="text-[9px] uppercase tracking-[0.2em] text-white/10 hover:text-white/40 transition-all font-medium"
                >
                  Close
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6 space-y-8 custom-scrollbar">
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-[0.28em] font-medium text-white/20">
                      Released
                    </span>
                    <span className="text-[9px] font-mono text-white/10">
                      {releasedUpdates.length} entries
                    </span>
                  </div>
                  <div className="border border-white/5 rounded-2xl overflow-hidden bg-black/10">
                    {releasedUpdates.map((update, idx) => (
                      <div
                        key={update.version}
                        className={cn(
                          "px-4 py-4 sm:px-5 sm:py-5 space-y-3",
                          idx !== releasedUpdates.length - 1 && "border-b border-white/5",
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-white/20">
                                {update.version}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-white/10" />
                              <span className="text-sm font-medium text-white/70">
                                {update.title}
                              </span>
                            </div>
                            <p className="text-[11px] text-white/30 leading-relaxed">
                              {update.description}
                            </p>
                          </div>
                          {update.date && (
                            <span className="text-[9px] font-mono text-white/10 shrink-0 pt-0.5">
                              {update.date}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-1.5">
                          {update.details.map((detail, dIdx) => (
                            <div key={dIdx} className="flex items-start gap-3">
                              <div className="mt-1.5 w-1 h-px bg-white/10 shrink-0" />
                              <span className="text-[10px] text-white/40 leading-relaxed">
                                {detail}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {plannedUpdates.length > 0 && (
                  <section className="space-y-3">
                    <span className="text-[9px] uppercase tracking-[0.28em] font-medium text-white/15">
                      Planned
                    </span>
                    <div className="border border-white/5 rounded-2xl overflow-hidden bg-transparent">
                      {plannedUpdates.map((update, idx) => (
                        <div
                          key={update.version}
                          className={cn(
                            "px-4 py-4 sm:px-5 sm:py-5 space-y-3 opacity-80",
                            idx !== plannedUpdates.length - 1 && "border-b border-white/5",
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono text-white/15">
                                  {update.version}
                                </span>
                                <span className="text-[7px] uppercase tracking-[0.24em] px-1.5 py-0.5 border border-white/5 text-white/20 rounded-md">
                                  Planned
                                </span>
                              </div>
                              <span className="text-sm font-medium text-white/50">
                                {update.title}
                              </span>
                              <p className="text-[11px] text-white/25 leading-relaxed">
                                {update.description}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-1.5">
                            {update.details.map((detail, dIdx) => (
                              <div key={dIdx} className="flex items-start gap-3">
                                <div className="mt-1.5 w-1 h-px bg-white/8 shrink-0" />
                                <span className="text-[10px] text-white/32 leading-relaxed">
                                  {detail}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-4 sm:px-6 lg:px-8 border-t border-white/5 flex items-center justify-between bg-black/10">
                <span className="text-[9px] uppercase tracking-[0.24em] font-medium text-white/15">
                  Local changelog
                </span>
                <span className="text-[9px] font-mono text-white/10">
                  {releasedUpdates[0]?.date ?? "draft"}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .bg-grid-white\/\\[0\\.5\\] {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='rgb(255 255 255 / 0.1)'%3E%3Cpath d='M0 .5H31.5V32'/%3E%3C/svg%3E");
        }
      `,
        }}
      />
    </div>
  );
}
