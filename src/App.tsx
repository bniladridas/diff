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
} from "lucide-react";
import { cn } from "./lib/utils";
import ReactMarkdown from "react-markdown";
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
}

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

const DEFAULT_OWNER = "bniladridas";
const DEFAULT_REPO = "diff";
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

  if (startLine && endLine && startLine !== endLine) {
    return `lines ${startLine}-${endLine}${side ? ` ${side.toLowerCase()}` : ""}${
      isOriginal ? " original" : ""
    }`;
  }

  if (endLine) {
    return `line ${endLine}${side ? ` ${side.toLowerCase()}` : ""}${
      isOriginal ? " original" : ""
    }`;
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
  let oldLine = 0;
  let newLine = 0;

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
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      rows.push({
        kind: "deleted",
        content: line,
        oldLine,
        newLine: null,
      });
      oldLine += 1;
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
    oldLine += 1;
    newLine += 1;
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
            components={markdownComponents}
          >
            {normalizeAlertMarkdown(children)}
          </ReactMarkdown>
        </div>
      </div>
    );
  },
};

export default function App() {
  const [viewMode, setViewMode] = useState<"pulls" | "branches">("pulls");
  const [currentOwner, setCurrentOwner] = useState("harpertoken");
  const [currentRepo, setCurrentRepo] = useState("harper");
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
  const [activeTab, setActiveTab] = useState<"diff" | "discussion">("diff");
  const [loading, setLoading] = useState(true);
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaChallenge] = useState(() => {
    const a = Math.floor(Math.random() * 5) + 1;
    const b = Math.floor(Math.random() * 5) + 1;
    return { a, b, sum: a + b };
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const repoKeyRef = useRef(`${currentOwner}/${currentRepo}`);
  const diffRows = parseDiffRows(selectedFile?.patch);

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
      if (newWidth >= 300 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
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
    if (viewMode === "pulls") {
      setPage(1);
      fetchPulls(1, true);
    } else {
      fetchBranches();
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

  const fetchBranches = async () => {
    const requestKey = `${currentOwner}/${currentRepo}`;
    setLoading(true);
    setError(null);
    try {
      const comparisonRepoInfo = repoInfo ?? (await fetchRepoInfo());
      if (repoKeyRef.current !== requestKey) return;

      const response = await fetch(
        `/api/branches?owner=${currentOwner}&repo=${currentRepo}`,
      );
      if (repoKeyRef.current !== requestKey) return;
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch branches");
      }
      const data: Branch[] = await response.json();
      if (repoKeyRef.current !== requestKey) return;
      setBranches(data);
      if (data.length > 0) {
        handleSelectBranch(data[0], comparisonRepoInfo);
      } else {
        setSelectedBranch(null);
        setFiles([]);
        setSelectedFile(null);
      }
    } catch (err: any) {
      if (repoKeyRef.current !== requestKey) return;
      setError(err.message);
    } finally {
      if (repoKeyRef.current === requestKey) {
        setLoading(false);
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
    fetchPulls(nextPage);
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
    setActiveTab("diff");

    // Fetch Files
    try {
      const filesRes = await fetch(
        `/api/pulls/${pull.number}/files?owner=${currentOwner}&repo=${currentRepo}`,
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
      console.error("Files fetch error:", err);
    } finally {
      if (repoKeyRef.current === requestKey) {
        setLoadingFiles(false);
      }
    }

    // Fetch Comments
    try {
      const [commentsRes, reviewCommentsRes] = await Promise.all([
        fetch(
          `/api/pulls/${pull.number}/comments?owner=${currentOwner}&repo=${currentRepo}`,
        ),
        fetch(
          `/api/pulls/${pull.number}/review-comments?owner=${currentOwner}&repo=${currentRepo}`,
        ),
      ]);

      if (repoKeyRef.current !== requestKey) return;
      if (commentsRes.ok) setComments(await commentsRes.json());
      if (repoKeyRef.current !== requestKey) return;
      if (reviewCommentsRes.ok)
        setReviewComments(await reviewCommentsRes.json());
    } catch (err) {
      if (repoKeyRef.current !== requestKey) return;
      console.error("Comments fetch error:", err);
    } finally {
      if (repoKeyRef.current === requestKey) {
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
            className="w-full bg-transparent border-b border-white/10 py-2 text-center text-lg text-brand-orange focus:border-brand-orange/40 outline-none transition-colors placeholder:text-white/5"
            placeholder="?"
          />

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
        <div className="max-w-7xl mx-auto px-4 lg:px-12 h-14 lg:h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 lg:gap-4 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-1 -ml-1 text-white/40 hover:text-brand-orange transition-colors"
            >
              <Activity
                className={cn(
                  "w-5 h-5 transition-transform",
                  isSidebarOpen && "rotate-90",
                )}
              />
            </button>
            <div className="flex items-center gap-2 lg:gap-3 min-w-0">
              <div className="w-3.5 h-3.5 lg:w-6 lg:h-6 bg-[#00FF41] shrink-0" />
              <div className="flex flex-col min-w-0">
                <h1 className="text-lg lg:text-2xl font-mono tracking-tighter leading-none group cursor-default flex items-baseline">
                  DIFF
                  <span className="hidden sm:inline text-[8px] opacity-20 ml-3 tracking-[0.3em] font-mono">
                    v0.1.0
                  </span>
                </h1>
                <div className="flex items-center gap-1.5 lg:gap-2 mt-0.5 lg:mt-1 min-w-0">
                  {showRepoInput ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2"
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
                        className="bg-black/40 border border-brand-orange/20 px-2 py-0.5 text-[10px] font-mono text-brand-orange outline-none focus:border-brand-orange w-28 sm:w-32"
                      />
                    </motion.div>
                  ) : (
                    <button
                      onClick={() => {
                        setInputRepo(`${currentOwner}/${currentRepo}`);
                        setShowRepoInput(true);
                      }}
                      className="text-[9px] lg:text-[10px] font-mono opacity-40 hover:opacity-100 transition-opacity flex items-center gap-1 group min-w-0 max-w-[120px] sm:max-w-none"
                    >
                      <Hash className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">
                        {currentOwner}/{currentRepo}
                      </span>
                      <RefreshCw className="hidden sm:block w-2.5 h-2.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                  {(currentOwner !== DEFAULT_OWNER ||
                    currentRepo !== DEFAULT_REPO) && (
                    <button
                      onClick={() => {
                        switchRepo(DEFAULT_OWNER, DEFAULT_REPO);
                      }}
                      className="text-[8px] uppercase tracking-widest text-white/20 hover:text-white/40 transition-colors shrink-0"
                    >
                      [Default]
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
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
              className="hidden lg:flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 hover:text-brand-orange transition-colors"
            >
              {isSidebarHidden ? "Show" : "Hide"} Panel
            </button>
          </div>

          <button
            onClick={() =>
              viewMode === "pulls" ? fetchPulls(1, true) : fetchBranches()
            }
            className="p-2 lg:p-3 border border-white/10 hover:border-brand-orange transition-all group shrink-0"
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
          style={{ width: isSidebarHidden ? 0 : undefined }}
          className={cn(
            "border-r border-white/5 bg-black/20 flex flex-col transition-all duration-300 ease-in-out z-40 relative group overflow-hidden",
            "fixed lg:relative top-14 lg:top-0 bottom-0 left-0 lg:bottom-auto lg:inset-auto bg-onyx lg:bg-black/20",
            isSidebarOpen
              ? "w-[280px] sm:w-[320px] translate-x-0"
              : "w-0 lg:w-auto -translate-x-full lg:translate-x-0",
            !isSidebarHidden && "lg:w-[var(--sidebar-width)]",
          )}
        >
          <div className="flex flex-col h-full overflow-hidden w-[280px] sm:w-[320px] lg:w-[var(--sidebar-width)]">
            <div className="p-4 lg:p-6 border-b border-white/5 pb-0">
              <div className="flex gap-4 border-b border-white/5">
                <button
                  onClick={() => setViewMode("pulls")}
                  className={cn(
                    "pb-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative",
                    viewMode === "pulls"
                      ? "text-brand-orange"
                      : "text-white/20 hover:text-white/40",
                  )}
                >
                  Pulls
                  {viewMode === "pulls" && (
                    <motion.div
                      layoutId="viewMode"
                      className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-brand-orange"
                    />
                  )}
                </button>
                <button
                  onClick={() => setViewMode("branches")}
                  className={cn(
                    "pb-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative",
                    viewMode === "branches"
                      ? "text-brand-orange"
                      : "text-white/20 hover:text-white/40",
                  )}
                >
                  Branches
                  {viewMode === "branches" && (
                    <motion.div
                      layoutId="viewMode"
                      className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-brand-orange"
                    />
                  )}
                </button>
              </div>
            </div>

            <div className="p-6 lg:p-8 border-b border-white/5 space-y-6 shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] uppercase tracking-[0.4em] opacity-40 font-bold">
                  {viewMode === "pulls" ? "Pulls" : "Branches"}
                </h2>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-mono text-brand-orange px-2 py-0.5 bg-brand-orange/10 border border-brand-orange/20">
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
                <div className="flex border border-white/5 p-1 bg-black/40">
                  {(["open", "closed", "all"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStateFilter(s)}
                      className={cn(
                        "flex-1 py-2 text-[8px] lg:text-[10px] uppercase tracking-widest font-bold transition-all",
                        stateFilter === s
                          ? "bg-brand-orange text-white"
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
                <div className="divide-y divide-white/5">
                  {viewMode === "pulls"
                    ? pulls.map((pull) => (
                        <button
                          key={pull.id}
                          onClick={() => {
                            handleSelectPull(pull);
                            setIsSidebarOpen(false);
                          }}
                          className={cn(
                            "w-full text-left p-6 lg:p-8 transition-all hover:bg-white/[0.02] relative group",
                            selectedPull?.id === pull.id
                              ? "bg-white/[0.03]"
                              : "",
                          )}
                        >
                          {selectedPull?.id === pull.id && (
                            <motion.div
                              layoutId="active-indicator"
                              className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange"
                            />
                          )}

                          <div className="space-y-3 lg:space-y-4">
                            <div className="flex items-center justify-between text-[10px] font-mono opacity-40">
                              <span className="flex items-center gap-2">
                                #{pull.number}
                              </span>
                              <span className="hidden sm:block">
                                {new Date(pull.created_at).toLocaleDateString()}
                              </span>
                            </div>

                            <h3
                              className={cn(
                                "font-serif italic text-lg lg:text-xl leading-tight transition-colors break-words",
                                selectedPull?.id === pull.id
                                  ? "text-white"
                                  : "text-white/60 group-hover:text-white",
                              )}
                            >
                              {pull.title}
                            </h3>

                            <div className="flex items-center gap-3 pt-1 lg:pt-2">
                              <img
                                src={pull.user.avatar_url}
                                alt=""
                                className="w-5 h-5 grayscale opacity-50 group-hover:opacity-100 transition-opacity border border-white/10"
                              />
                              <span className="text-[9px] lg:text-[10px] uppercase tracking-widest opacity-40 group-hover:opacity-80 transition-opacity font-bold">
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
                            "w-full text-left p-6 lg:p-8 transition-all hover:bg-white/[0.02] relative group",
                            selectedBranch?.name === branch.name
                              ? "bg-white/[0.03]"
                              : "",
                          )}
                        >
                          {selectedBranch?.name === branch.name && (
                            <motion.div
                              layoutId="active-indicator"
                              className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange"
                            />
                          )}

                          <div className="space-y-3 lg:space-y-4">
                            <div className="flex items-center justify-between text-[10px] font-mono opacity-40">
                              <span className="flex items-center gap-2">
                                <GitBranch className="w-3 h-3" />
                              </span>
                              {branch.name === repoInfo?.default_branch && (
                                <span className="text-[8px] font-bold uppercase tracking-widest text-[#00FF41]/60 px-1.5 py-0.5 border border-[#00FF41]/20">
                                  Default
                                </span>
                              )}
                            </div>

                            <h3
                              className={cn(
                                "font-serif italic text-lg lg:text-xl leading-tight transition-colors break-words",
                                selectedBranch?.name === branch.name
                                  ? "text-white"
                                  : "text-white/60 group-hover:text-white",
                              )}
                            >
                              {branch.name}
                            </h3>

                            <div className="flex items-center gap-3 pt-1 lg:pt-2">
                              <span className="text-[9px] lg:text-[10px] opacity-40 font-mono truncate">
                                {branch.commit.sha.substring(0, 7)}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}

                  {viewMode === "pulls" && hasMore && (
                    <div className="p-8 flex justify-center">
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="group flex flex-col items-center gap-3 transition-all"
                      >
                        <div
                          className={cn(
                            "w-10 h-10 border border-white/10 flex items-center justify-center transition-all group-hover:border-brand-orange group-hover:bg-brand-orange/5",
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
        {!isSidebarHidden && (
          <div
            onMouseDown={() => setIsResizing(true)}
            className="hidden lg:block w-px h-full bg-white/5 hover:bg-brand-orange cursor-col-resize transition-colors z-50 group px-1 flex-shrink-0"
          >
            <div className="w-full h-full group-hover:bg-brand-orange/20" />
          </div>
        )}

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
                className="p-4 sm:p-6 lg:p-12 space-y-8 lg:space-y-12"
              >
                {/* PR/Branch Meta Header */}
                <div className="flex flex-col xl:flex-row justify-between items-start gap-8 lg:gap-12 pb-8 lg:pb-12 border-b border-white/5">
                  <div className="space-y-4 lg:space-y-6 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 bg-brand-orange animate-pulse" />
                      <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">
                        {selectedPull ? "Pull Request" : "Branch View"}
                      </span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-6xl font-serif italic tracking-tighter leading-[1] lg:leading-[0.9] break-words">
                      {selectedPull ? selectedPull.title : selectedBranch!.name}
                    </h2>
                    <div className="flex flex-wrap gap-6 lg:gap-8 items-center pt-4">
                      {selectedPull && (
                        <div className="space-y-1">
                          <p className="text-sm font-mono text-brand-orange">
                            #{selectedPull.number}
                          </p>
                        </div>
                      )}
                      {selectedPull && (
                        <div className="w-[1px] h-8 bg-white/10 hidden sm:block" />
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
                    className="w-full xl:w-auto px-6 lg:px-10 py-4 lg:py-5 border border-white/10 text-[10px] font-bold uppercase tracking-[0.4em] hover:bg-brand-orange hover:border-brand-orange transition-all flex items-center justify-center gap-3"
                  >
                    Source <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Tabs */}
                <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-12 px-4 sm:px-6 lg:px-12 bg-onyx/95 backdrop-blur-md border-b border-white/5">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab("diff")}
                      className={cn(
                        "px-8 py-4 text-[10px] uppercase tracking-[0.4em] font-bold transition-all border-b-2",
                        activeTab === "diff"
                          ? "border-brand-orange text-white"
                          : "border-transparent text-white/30 hover:text-white/60",
                      )}
                    >
                      File Diff
                    </button>
                    {selectedPull && (
                      <button
                        onClick={() => setActiveTab("discussion")}
                        className={cn(
                          "px-8 py-4 text-[10px] uppercase tracking-[0.4em] font-bold transition-all border-b-2 flex items-center gap-3",
                          activeTab === "discussion"
                            ? "border-brand-orange text-white"
                            : "border-transparent text-white/30 hover:text-white/60",
                        )}
                      >
                        Discussion
                        {comments.length + reviewComments.length > 0 && (
                          <span className="bg-brand-orange text-white text-[8px] px-1.5 py-0.5 rounded-full">
                            {comments.length + reviewComments.length}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="space-y-12 min-h-[600px]">
                  {activeTab === "diff" ? (
                    <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {/* File List */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 mb-6">
                          <Activity className="w-5 h-5 text-brand-orange" />
                          <h3 className="text-sm font-bold uppercase tracking-[0.3em]">
                            Manifest
                          </h3>
                        </div>
                        <div className="flex flex-col border border-white/5 bg-black/40 max-h-[300px] lg:max-h-[600px] overflow-y-auto custom-scrollbar">
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
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <FileCode className="w-5 h-5 text-brand-orange" />
                            <h3 className="text-sm font-bold uppercase tracking-[0.3em]">
                              Git Diff Stream
                            </h3>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-[9px] font-mono opacity-20 uppercase tracking-widest leading-none hidden sm:block">
                              {selectedFile?.filename || "No file selected"}
                            </div>
                            <button
                              onClick={() => setIsFullscreen(!isFullscreen)}
                              className="p-2 border border-white/5 hover:border-brand-orange transition-all group"
                              title={
                                isFullscreen
                                  ? "Exit Fullscreen"
                                  : "Enter Fullscreen"
                              }
                            >
                              {isFullscreen ? (
                                <Minimize2 className="w-4 h-4 text-white/40 group-hover:text-brand-orange transition-colors" />
                              ) : (
                                <Maximize2 className="w-4 h-4 text-white/40 group-hover:text-brand-orange transition-colors" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div
                          className={cn(
                            "relative group",
                            isFullscreen && "max-w-7xl mx-auto",
                          )}
                        >
                          <div className="absolute -inset-0.5 bg-gradient-to-br from-brand-orange/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur shadow-xl" />
                          <div className="relative bg-[#0A0A0A] border border-white/5 overflow-hidden">
                            {loadingFiles ? (
                              <div className="p-20 lg:p-32 flex flex-col items-center justify-center space-y-6 text-center bg-black/40">
                                <div className="w-12 h-12 border border-brand-orange/20 border-t-brand-orange animate-spin" />
                                <p className="text-[10px] uppercase tracking-[0.5em] text-brand-orange/50 animate-pulse font-bold">
                                  Decoding Diff Buffer...
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
                                  <div className="w-fit min-w-full bg-black/40 font-mono text-[10px] sm:text-xs lg:text-sm leading-relaxed">
                                    {diffRows.map((row, index) => (
                                      <div
                                        key={`${index}-${row.content}`}
                                        className={cn(
                                          "grid min-w-full grid-cols-[4rem_4rem_1fr]",
                                          row.kind === "added" &&
                                            "bg-emerald-500/10 text-emerald-300",
                                          row.kind === "deleted" &&
                                            "bg-rose-500/10 text-rose-300",
                                          row.kind === "hunk" &&
                                            "bg-brand-orange/10 text-brand-orange/80",
                                          row.kind === "meta" &&
                                            "text-white/35",
                                          row.kind === "context" && "text-white/80",
                                        )}
                                      >
                                        <div className="border-r border-white/5 px-3 py-1 text-right text-white/25 select-none">
                                          {row.oldLine ?? ""}
                                        </div>
                                        <div className="border-r border-white/5 px-3 py-1 text-right text-white/25 select-none">
                                          {row.newLine ?? ""}
                                        </div>
                                        <pre className="px-4 py-1 whitespace-pre-wrap break-words">
                                          {row.content || " "}
                                        </pre>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <pre className="w-fit min-w-full p-4 sm:p-6 lg:p-8 text-[10px] sm:text-xs lg:text-sm font-mono leading-relaxed !bg-black/40 !m-0 overflow-x-visible text-white/60">
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
                      {/* PR Description */}
                      <section className="space-y-8">
                        <div className="bg-white/[0.02] border border-white/5 p-8 lg:p-12 prose prose-invert prose-orange max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {selectedPull.body || "_No description provided._"}
                          </ReactMarkdown>
                        </div>
                      </section>

                      {/* General Comments */}
                      {comments.length > 0 && (
                        <section className="space-y-8">
                          <div className="flex items-center gap-4">
                            <MessageSquare className="w-5 h-5 text-brand-orange" />
                            <h3 className="text-sm font-bold uppercase tracking-[0.3em]">
                              Discussion
                            </h3>
                          </div>
                          <div className="space-y-6">
                            {comments.map((comment) => (
                              <div
                                key={comment.id}
                                className="flex gap-6 p-8 border border-white/5 bg-white/[0.01]"
                              >
                                <img
                                  src={comment.user.avatar_url}
                                  alt=""
                                  className="w-10 h-10 border border-white/10 shrink-0"
                                />
                                <div className="space-y-4 flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-widest font-bold text-brand-orange">
                                      {comment.user.login}
                                    </span>
                                    <span className="text-[10px] opacity-30 font-mono italic">
                                      {new Date(
                                        comment.created_at,
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="prose prose-invert prose-sm max-w-none opacity-80 leading-relaxed">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
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
                        <section className="space-y-8">
                          <div className="flex items-center gap-4">
                            <MessageCircle className="w-5 h-5 text-brand-orange" />
                            <h3 className="text-sm font-bold uppercase tracking-[0.3em]">
                              Annotations
                            </h3>
                          </div>
                          <div className="space-y-6">
                            {reviewComments.map((comment) => (
                              <div
                                key={comment.id}
                                className="p-8 border border-white/5 bg-brand-orange/[0.02] space-y-4"
                              >
                                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                  <div className="flex items-center gap-3">
                                    <Hash className="w-3 h-3 text-brand-orange" />
                                    <span className="text-[10px] font-mono text-brand-orange/60">
                                      {comment.path}
                                    </span>
                                  </div>
                                  <a
                                    href={comment.html_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] opacity-30 hover:opacity-70 font-mono italic transition-opacity"
                                  >
                                    {formatReviewCommentLine(comment)}
                                  </a>
                                </div>
                                <div className="flex gap-6">
                                  <img
                                    src={comment.user.avatar_url}
                                    alt=""
                                    className="w-10 h-10 border border-white/10 shrink-0"
                                  />
                                  <div className="space-y-4 flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">
                                        {comment.user.login}
                                      </span>
                                      <span className="text-[10px] opacity-30 font-mono">
                                        {new Date(
                                          comment.created_at,
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="prose prose-invert prose-sm max-w-none opacity-70">
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
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

                {/* System Stats Footer */}
                <div className="pb-12" />
              </motion.div>
            ) : (
              <div className="min-h-[400px] flex items-center justify-center p-12">
                {!loading && (
                  <div className="text-center space-y-6 max-w-sm px-12">
                    <Code className="w-12 h-12 text-brand-orange/20 mx-auto" />
                    <p className="text-[10px] uppercase tracking-[0.5em] text-white/20 font-black leading-loose">
                      Select a proposal from the stream to begin diff analysis.
                    </p>
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </section>
      </main>

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
