import "dotenv/config";
import express from "express";
import path from "path";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // GitHub API integration
  const REPO_OWNER = process.env.GITHUB_REPO_OWNER || "harpertoken";
  const REPO_NAME = process.env.GITHUB_REPO_NAME || "harper";

  const getHeaders = (accept: string) => {
    const headers: any = { Accept: accept };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
  };

  const getRepoCtx = (req: any) => ({
    owner: (req.query.owner as string) || REPO_OWNER,
    repo: (req.query.repo as string) || REPO_NAME,
  });

  const handleError = (res: any, error: any, context: string) => {
    const errorMsg =
      error.response?.data?.message || error.message || "Unknown error";
    const displayMsg =
      typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg);
    console.error(`GitHub API Error (${context}):`, displayMsg);
    res.status(error.response?.status || 500).json({ error: displayMsg });
  };

  app.get("/api/pulls", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const state = req.query.state || "open";
      const page = req.query.page || 1;
      const perPage = req.query.per_page || 30;
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}&page=${page}`,
        { headers: getHeaders("application/vnd.github.v3+json") },
      );
      res.json(response.data);
    } catch (error: any) {
      handleError(res, error, "Pulls");
    }
  });

  app.get("/api/pulls/:number/diff", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const { number } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
        { headers: getHeaders("application/vnd.github.v3.diff") },
      );
      res.send(response.data);
    } catch (error: any) {
      handleError(res, error, "Diff");
    }
  });

  app.get("/api/pulls/:number/files", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const { number } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/files`,
        { headers: getHeaders("application/vnd.github.v3+json") },
      );
      res.json(response.data);
    } catch (error: any) {
      handleError(res, error, "Files");
    }
  });

  app.get("/api/pulls/:number/comments", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const { number } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments`,
        { headers: getHeaders("application/vnd.github.v3+json") },
      );
      res.json(response.data);
    } catch (error: any) {
      handleError(res, error, "Comments");
    }
  });

  app.get("/api/pulls/:number/review-comments", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const { number } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/comments`,
        { headers: getHeaders("application/vnd.github.v3+json") },
      );
      res.json(response.data);
    } catch (error: any) {
      handleError(res, error, "ReviewComments");
    }
  });

  app.get("/api/pulls/:number/checks", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const { number } = req.params;

      const prResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
        { headers: getHeaders("application/vnd.github.v3+json") },
      );

      const headSha = prResponse.data.head.sha;
      const mergeSha = prResponse.data.merge_commit_sha;

      // Fetch checks for a specific SHA
      const fetchForSha = async (sha: string) => {
        const [checks, statuses] = await Promise.all([
          axios.get(
            `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100`,
            { headers: getHeaders("application/vnd.github.v3+json") },
          ),
          axios.get(
            `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/statuses?per_page=100`,
            { headers: getHeaders("application/vnd.github.v3+json") },
          )
        ]);
        return { checks: checks.data.check_runs || [], statuses: statuses.data || [] };
      };

      // Fetch both (merging them gives a more complete picture of PR status)
      const headData = await fetchForSha(headSha);
      let mergeData = { checks: [], statuses: [] };
      if (mergeSha && mergeSha !== headSha) {
        try {
          mergeData = await fetchForSha(mergeSha);
        } catch (e) {
          // Ignore errors for merge commit if it's not yet available or failed
        }
      }

      // Deduplicate by name/context
      const uniqueChecks = new Map();
      const uniqueStatuses = new Map();

      // Process merge commit first as it often represents the final "truth" for PRs
      [...mergeData.checks, ...headData.checks].forEach((c: any) => {
        if (!uniqueChecks.has(c.name)) {
          uniqueChecks.set(c.name, { ...c, type: "check_run" });
        }
      });

      [...mergeData.statuses, ...headData.statuses].forEach((s: any) => {
        if (!uniqueStatuses.has(s.context)) {
          uniqueStatuses.set(s.context, {
            id: s.id,
            name: s.context || "Commit Status",
            status: s.state === "pending" ? "in_progress" : "completed",
            conclusion: s.state === "success" ? "success" :
                       (s.state === "failure" || s.state === "error") ? "failure" :
                       s.state === "pending" ? null : "other",
            html_url: s.target_url,
            description: s.description,
            avatar_url: s.avatar_url,
            type: "status"
          });
        }
      });

      const allChecks = [
        ...Array.from(uniqueChecks.values()),
        ...Array.from(uniqueStatuses.values())
      ];

      res.json({ check_runs: allChecks });
    } catch (error: any) {
      handleError(res, error, "Checks");
    }
  });

  app.get("/api/branches", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/branches`,
        { headers: getHeaders("application/vnd.github.v3+json") },
      );
      res.json(response.data);
    } catch (error: any) {
      handleError(res, error, "Branches");
    }
  });

  app.get("/api/compare/:base/:head/diff", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const { base, head } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`,
        { headers: getHeaders("application/vnd.github.v3.diff") },
      );
      res.send(response.data);
    } catch (error: any) {
      handleError(res, error, "CompareDiff");
    }
  });

  app.get("/api/compare/:base/:head/files", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const { base, head } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`,
        { headers: getHeaders("application/vnd.github.v3+json") },
      );
      res.json(response.data.files);
    } catch (error: any) {
      handleError(res, error, "CompareFiles");
    }
  });

  app.get("/api/repo", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers: getHeaders("application/vnd.github.v3+json") },
      );
      res.json(response.data);
    } catch (error: any) {
      handleError(res, error, "Repo");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only listen if not running as a Vercel function
  if (process.env.VERCEL === undefined) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

export default startServer();
