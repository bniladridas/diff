/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
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
  Minimize2
} from 'lucide-react';
import { cn } from './lib/utils';
import Prism from 'prismjs';
import 'prismjs/components/prism-diff';
import 'prismjs/themes/prism-tomorrow.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import version from '/VERSION?raw';

interface GithubComment {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  body: string;
  created_at: string;
  path?: string; // for review comments
  position?: number; // for review comments
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

export default function App() {
  const [pulls, setPulls] = useState<PullRequest[]>([]);
  const [selectedPull, setSelectedPull] = useState<PullRequest | null>(null);
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ChangedFile | null>(null);
  const [comments, setComments] = useState<GithubComment[]>([]);
  const [reviewComments, setReviewComments] = useState<GithubComment[]>([]);
  const [activeTab, setActiveTab] = useState<'diff' | 'discussion'>('diff');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaChallenge] = useState(() => {
    const a = Math.floor(Math.random() * 5) + 1;
    const b = Math.floor(Math.random() * 5) + 1;
    return { a, b, sum: a + b };
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

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
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    setPage(1);
    fetchPulls(1, true);
  }, [stateFilter]);

  useEffect(() => {
    if (!loading && !loadingFiles && selectedFile?.patch && activeTab === 'diff' && isVerified) {
      const timer = setTimeout(() => {
        Prism.highlightAll();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedFile, activeTab, loadingFiles, loading, isVerified, isFullscreen]);

  const fetchPulls = async (pageNum = 1, reset = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const response = await fetch(`/api/pulls?state=${stateFilter}&page=${pageNum}&per_page=30`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || `Server responded with ${response.status}`;
        if (message.includes('rate limit')) {
          throw new Error('GitHub API rate limit exceeded. Please add a GITHUB_TOKEN to secrets to increase limits.');
        }
        throw new Error(message);
      }
      const data: PullRequest[] = await response.json();

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
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPulls(nextPage);
  };

  const handleSelectPull = async (pull: PullRequest) => {
    setSelectedPull(pull);
    setLoadingFiles(true);
    setLoadingComments(true);
    setFiles([]);
    setSelectedFile(null);
    setComments([]);
    setReviewComments([]);
    setActiveTab('diff');

    // Fetch Files
    try {
      const filesRes = await fetch(`/api/pulls/${pull.number}/files`);
      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data);
        if (data.length > 0) {
          setSelectedFile(data[0]);
        }
      }
    } catch (err) {
      console.error('Files fetch error:', err);
    } finally {
      setLoadingFiles(false);
    }

    // Fetch Comments
    try {
      const [commentsRes, reviewCommentsRes] = await Promise.all([
        fetch(`/api/pulls/${pull.number}/comments`),
        fetch(`/api/pulls/${pull.number}/review-comments`)
      ]);

      if (commentsRes.ok) setComments(await commentsRes.json());
      if (reviewCommentsRes.ok) setReviewComments(await reviewCommentsRes.json());
    } catch (err) {
      console.error('Comments fetch error:', err);
    } finally {
      setLoadingComments(false);
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
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-onyx/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 -ml-2 text-white/40 hover:text-brand-orange transition-colors"
            >
              <Activity className={cn("w-6 h-6 transition-transform", isSidebarOpen && "rotate-90")} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 lg:w-6 lg:h-6 bg-[#00FF41] shrink-0" />
              <div>
                <h1 className="text-xl lg:text-2xl font-mono tracking-tighter leading-none group cursor-default flex items-baseline">
                  DIFF
                  <span className="text-[8px] opacity-20 ml-3 tracking-[0.3em] font-mono">v{version}</span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-12 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
              <a href="https://github.com/harpertoken/harper" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                GitHub <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <button
              onClick={() => setIsSidebarHidden(!isSidebarHidden)}
              className="hidden lg:flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 hover:text-brand-orange transition-colors"
            >
              {isSidebarHidden ? 'Show' : 'Hide'} Panel
            </button>
          </div>

          <button
            onClick={() => fetchPulls(1, true)}
            className="p-3 border border-white/10 hover:border-brand-orange transition-all group shrink-0"
          >
            <RefreshCw className={cn("w-4 h-4 text-white/40 group-hover:text-brand-orange transition-colors", loading && "animate-spin")} />
          </button>
        </div>
      </header>

      <main
        className="pt-20 h-screen flex overflow-hidden bg-onyx"
        style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
      >
        {/* Pull Requests List */}
        <aside
          style={{ width: isSidebarHidden ? 0 : undefined }}
          className={cn(
            "border-r border-white/5 bg-black/20 flex flex-col transition-all duration-300 ease-in-out z-40 relative group overflow-hidden",
            "fixed lg:relative top-20 lg:top-0 bottom-0 left-0 lg:bottom-auto lg:inset-auto bg-onyx lg:bg-black/20",
            isSidebarOpen ? "w-[280px] sm:w-[320px] translate-x-0" : "w-0 lg:w-auto -translate-x-full lg:translate-x-0",
            !isSidebarHidden && "lg:w-[var(--sidebar-width)]"
          )}
        >
          <div className="flex flex-col h-full overflow-hidden w-[280px] sm:w-[320px] lg:w-[var(--sidebar-width)]">
            <div className="p-6 lg:p-8 border-b border-white/5 space-y-6 shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] uppercase tracking-[0.4em] opacity-40 font-bold">Pulls</h2>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-mono text-brand-orange px-2 py-0.5 bg-brand-orange/10 border border-brand-orange/20">
                    {pulls.length}
                  </span>
                  <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
                    <ChevronRight className="w-4 h-4 rotate-180 opacity-40" />
                  </button>
                </div>
              </div>

              <div className="flex border border-white/5 p-1 bg-black/40">
                {(['open', 'closed', 'all'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStateFilter(s)}
                    className={cn(
                      "flex-1 py-2 text-[8px] lg:text-[10px] uppercase tracking-widest font-bold transition-all",
                      stateFilter === s
                        ? "bg-brand-orange text-white"
                        : "text-white/30 hover:text-white/60"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-12 flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 border-2 border-brand-orange/20 border-t-brand-orange animate-spin" />
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-20">Syncing GitHub...</p>
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
              {pulls.map((pull) => (
                <button
                  key={pull.id}
                  onClick={() => {
                    handleSelectPull(pull);
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full text-left p-6 lg:p-8 transition-all hover:bg-white/[0.02] relative group",
                    selectedPull?.id === pull.id ? "bg-white/[0.03]" : ""
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
                      <span className="hidden sm:block">{new Date(pull.created_at).toLocaleDateString()}</span>
                    </div>

                    <h3 className={cn(
                      "font-serif italic text-lg lg:text-xl leading-tight transition-colors break-words",
                      selectedPull?.id === pull.id ? "text-white" : "text-white/60 group-hover:text-white"
                    )}>
                      {pull.title}
                    </h3>

                    <div className="flex items-center gap-3 pt-1 lg:pt-2">
                      <img src={pull.user.avatar_url} alt="" className="w-5 h-5 grayscale opacity-50 group-hover:opacity-100 transition-opacity border border-white/10" />
                      <span className="text-[9px] lg:text-[10px] uppercase tracking-widest opacity-40 group-hover:opacity-80 transition-opacity font-bold">
                        {pull.user.login}
                      </span>
                    </div>
                  </div>
                </button>
              ))}

              {hasMore && (
                <div className="p-8 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="group flex flex-col items-center gap-3 transition-all"
                  >
                    <div className={cn(
                      "w-10 h-10 border border-white/10 flex items-center justify-center transition-all group-hover:border-brand-orange group-hover:bg-brand-orange/5",
                      loadingMore && "animate-pulse"
                    )}>
                      {loadingMore ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-brand-orange" />
                      ) : (
                        <ChevronRight className="w-4 h-4 rotate-90 text-white/40 group-hover:text-brand-orange" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40 group-hover:opacity-100 transition-opacity">
                      {loadingMore ? 'Loading...' : 'Load More'}
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
            {selectedPull ? (
              <motion.div
                key={selectedPull.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 sm:p-6 lg:p-12 space-y-8 lg:space-y-12"
              >
                {/* PR Meta Header */}
                <div className="flex flex-col xl:flex-row justify-between items-start gap-8 lg:gap-12 pb-8 lg:pb-12 border-b border-white/5">
                  <div className="space-y-4 lg:space-y-6 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 bg-brand-orange animate-pulse" />
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-6xl font-serif italic tracking-tighter leading-[1] lg:leading-[0.9] break-words">
                      {selectedPull.title}
                    </h2>
                    <div className="flex flex-wrap gap-6 lg:gap-8 items-center pt-4">
                      <div className="space-y-1">
                        <p className="text-sm font-mono text-brand-orange">#{selectedPull.number}</p>
                      </div>
                      <div className="w-[1px] h-8 bg-white/10 hidden sm:block" />
                      <div className="space-y-1">
                        <p className="text-sm font-serif italic opacity-40">{new Date(selectedPull.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <a
                    href={selectedPull.html_url}
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
                      onClick={() => setActiveTab('diff')}
                      className={cn(
                        "px-8 py-4 text-[10px] uppercase tracking-[0.4em] font-bold transition-all border-b-2",
                        activeTab === 'diff' ? "border-brand-orange text-white" : "border-transparent text-white/30 hover:text-white/60"
                      )}
                    >
                      File Diff
                    </button>
                    <button
                      onClick={() => setActiveTab('discussion')}
                      className={cn(
                        "px-8 py-4 text-[10px] uppercase tracking-[0.4em] font-bold transition-all border-b-2 flex items-center gap-3",
                        activeTab === 'discussion' ? "border-brand-orange text-white" : "border-transparent text-white/30 hover:text-white/60"
                      )}
                    >
                      Discussion
                      {(comments.length + reviewComments.length) > 0 && (
                        <span className="bg-brand-orange text-white text-[8px] px-1.5 py-0.5 rounded-full">
                          {comments.length + reviewComments.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="space-y-12 min-h-[600px]">
                  {activeTab === 'diff' ? (
                    <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {/* File List */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 mb-6">
                          <Activity className="w-5 h-5 text-brand-orange" />
                          <h3 className="text-sm font-bold uppercase tracking-[0.3em]">Manifest</h3>
                        </div>
                        <div className="flex flex-col border border-white/5 bg-black/40 max-h-[300px] lg:max-h-[600px] overflow-y-auto custom-scrollbar">
                          {files.map((file) => (
                            <button
                              key={file.sha}
                              onClick={() => setSelectedFile(file)}
                              className={cn(
                                "text-left p-4 border-b border-white/5 transition-all group relative",
                                selectedFile?.sha === file.sha ? "bg-brand-orange/5" : "hover:bg-white/[0.02]"
                              )}
                            >
                              {selectedFile?.sha === file.sha && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange" />
                              )}
                              <div className="space-y-2">
                                <p className={cn(
                                  "text-[10px] font-mono truncate transition-colors",
                                  selectedFile?.sha === file.sha ? "text-brand-orange" : "text-white/40 group-hover:text-white/60"
                                )}>
                                  {file.filename}
                                </p>
                                <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-widest">
                                  <span className="text-emerald-500/60">+{file.additions}</span>
                                  <span className="text-rose-500/60">-{file.deletions}</span>
                                  <span className={cn(
                                    "px-1.5 py-0.5 border text-[7px]",
                                    file.status === 'modified' ? "border-amber-500/20 text-amber-500/60" :
                                    file.status === 'added' ? "border-emerald-500/20 text-emerald-500/60" :
                                    "border-rose-500/20 text-rose-500/60"
                                  )}>
                                    {file.status}
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Diff Editor */}
                      <div className={cn(
                        "space-y-8 min-w-0 transition-all duration-500",
                        isFullscreen && "fixed inset-0 z-[100] bg-onyx p-8 sm:p-12 lg:p-16 overflow-y-auto custom-scrollbar"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <FileCode className="w-5 h-5 text-brand-orange" />
                            <h3 className="text-sm font-bold uppercase tracking-[0.3em]">Git Diff Stream</h3>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-[9px] font-mono opacity-20 uppercase tracking-widest leading-none hidden sm:block">
                              {selectedFile?.filename || 'No file selected'}
                            </div>
                            <button
                              onClick={() => setIsFullscreen(!isFullscreen)}
                              className="p-2 border border-white/5 hover:border-brand-orange transition-all group"
                              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                            >
                              {isFullscreen ? (
                                <Minimize2 className="w-4 h-4 text-white/40 group-hover:text-brand-orange transition-colors" />
                              ) : (
                                <Maximize2 className="w-4 h-4 text-white/40 group-hover:text-brand-orange transition-colors" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className={cn(
                          "relative group",
                          isFullscreen && "max-w-7xl mx-auto"
                        )}>
                          <div className="absolute -inset-0.5 bg-gradient-to-br from-brand-orange/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur shadow-xl" />
                          <div className="relative bg-[#0A0A0A] border border-white/5 overflow-hidden">
                            {loadingFiles ? (
                              <div className="p-20 lg:p-32 flex flex-col items-center justify-center space-y-6 text-center bg-black/40">
                                <div className="w-12 h-12 border border-brand-orange/20 border-t-brand-orange animate-spin" />
                                <p className="text-[10px] uppercase tracking-[0.5em] text-brand-orange/50 animate-pulse font-bold">Decoding Diff Buffer...</p>
                              </div>
                            ) : (
                              <div className={cn(
                                "overflow-auto custom-scrollbar w-full",
                                isFullscreen ? "max-h-[calc(100vh-16rem)]" : "max-h-[600px] lg:max-h-[800px]"
                              )}>
                                <pre className="w-fit min-w-full p-4 sm:p-6 lg:p-8 text-[10px] sm:text-xs lg:text-sm font-mono leading-relaxed !bg-black/40 !m-0 overflow-x-visible">
                                  <code className="language-diff block min-w-full">
                                    {selectedFile?.patch || (selectedFile ? 'Binary file or no changes shown.' : 'Select a file to view its diff.')}
                                  </code>
                                </pre>
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
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedPull.body || '_No description provided._'}</ReactMarkdown>
                        </div>
                      </section>

                      {/* General Comments */}
                      {comments.length > 0 && (
                        <section className="space-y-8">
                          <div className="flex items-center gap-4">
                            <MessageSquare className="w-5 h-5 text-brand-orange" />
                            <h3 className="text-sm font-bold uppercase tracking-[0.3em]">Discussion</h3>
                          </div>
                          <div className="space-y-6">
                            {comments.map((comment) => (
                              <div key={comment.id} className="flex gap-6 p-8 border border-white/5 bg-white/[0.01]">
                                <img src={comment.user.avatar_url} alt="" className="w-10 h-10 border border-white/10 shrink-0" />
                                <div className="space-y-4 flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-widest font-bold text-brand-orange">{comment.user.login}</span>
                                    <span className="text-[10px] opacity-30 font-mono italic">{new Date(comment.created_at).toLocaleString()}</span>
                                  </div>
                                  <div className="prose prose-invert prose-sm max-w-none opacity-80 leading-relaxed">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
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
                            <h3 className="text-sm font-bold uppercase tracking-[0.3em]">Annotations</h3>
                          </div>
                          <div className="space-y-6">
                            {reviewComments.map((comment) => (
                              <div key={comment.id} className="p-8 border border-white/5 bg-brand-orange/[0.02] space-y-4">
                                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                  <div className="flex items-center gap-3">
                                    <Hash className="w-3 h-3 text-brand-orange" />
                                    <span className="text-[10px] font-mono text-brand-orange/60">{comment.path}</span>
                                  </div>
                                  <span className="text-[10px] opacity-30 font-mono italic">line {comment.position}</span>
                                </div>
                                <div className="flex gap-6">
                                  <img src={comment.user.avatar_url} alt="" className="w-10 h-10 border border-white/10 shrink-0" />
                                  <div className="space-y-4 flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">{comment.user.login}</span>
                                      <span className="text-[10px] opacity-30 font-mono">{new Date(comment.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="prose prose-invert prose-sm max-w-none opacity-70">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
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

      <style dangerouslySetInnerHTML={{ __html: `
        .language-diff .token.inserted {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          display: block;
          width: 100%;
        }
        .language-diff .token.deleted {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          display: block;
          width: 100%;
        }
        .language-diff .token.coord {
          color: #FF4D00;
          opacity: 0.6;
        }

        .bg-grid-white\/\\[0\\.5\\] {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='rgb(255 255 255 / 0.1)'%3E%3Cpath d='M0 .5H31.5V32'/%3E%3C/svg%3E");
        }
      `}} />
    </div>
  );
}
