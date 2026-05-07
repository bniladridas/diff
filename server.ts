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

  app.get("/api/pulls/:number/reviews", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const { number } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/reviews`,
        { headers: getHeaders("application/vnd.github.v3+json") },
      );
      res.json(response.data);
    } catch (error: any) {
      handleError(res, error, "Reviews");
    }
  });

  app.get("/api/pulls/:number/commits", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const { number } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/commits`,
        { headers: getHeaders("application/vnd.github.v3+json") },
      );
      res.json(response.data);
    } catch (error: any) {
      handleError(res, error, "Commits");
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
      const [headData, mergeData] = await Promise.all([
        fetchForSha(headSha),
        (async () => {
          if (mergeSha && mergeSha !== headSha) {
            try {
              return await fetchForSha(mergeSha);
            } catch (e) {
              return { checks: [], statuses: [] };
            }
          }
          return { checks: [], statuses: [] };
        })()
      ]);

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
      const page = req.query.page || 1;
      const perPage = req.query.per_page || 30;
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=${perPage}&page=${page}`,
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

  app.get("/api/checks/:check_run_id", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const { check_run_id } = req.params;

      const runDetail = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/check-runs/${check_run_id}`,
        { headers: getHeaders("application/vnd.github.v3+json") },
      );

      const [annotations, suiteRuns, actionsJob] = await Promise.all([
        axios.get(
          `https://api.github.com/repos/${owner}/${repo}/check-runs/${check_run_id}/annotations`,
          { headers: getHeaders("application/vnd.github.v3+json") },
        ).catch(() => ({ data: [] })),
        runDetail.data.check_suite?.id
          ? axios.get(
              `https://api.github.com/repos/${owner}/${repo}/check-suites/${runDetail.data.check_suite.id}/check-runs`,
              { headers: getHeaders("application/vnd.github.v3+json") }
            ).catch(() => ({ data: { check_runs: [] } }))
          : Promise.resolve({ data: { check_runs: [] } }),
        axios.get(
          `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${check_run_id}`,
          { headers: getHeaders("application/vnd.github+json") },
        ).catch(() => ({ data: null }))
      ]);

      const actionJobData = actionsJob.data;
      const mergedSteps = Array.isArray(actionJobData?.steps) && actionJobData.steps.length > 0
        ? actionJobData.steps
        : runDetail.data.steps || [];

      res.json({
        ...runDetail.data,
        ...(actionJobData
          ? {
              steps: mergedSteps,
              runner_name: actionJobData.runner_name,
              labels: actionJobData.labels,
              started_at: actionJobData.started_at || runDetail.data.started_at,
              completed_at: actionJobData.completed_at || runDetail.data.completed_at,
            }
          : {}),
        annotations: annotations.data || [],
        suite_runs: suiteRuns.data.check_runs || []
      });
    } catch (error: any) {
      handleError(res, error, "CheckRunDetail");
    }
  });

  app.get("/api/checks/:job_id/logs", async (req, res) => {
    try {
      const { owner, repo } = getRepoCtx(req);
      const { job_id } = req.params;

      // Try to get logs from GitHub Actions Jobs API
      // Note: check_run_id and job_id are identical for GitHub Actions
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${job_id}/logs`,
        {
          headers: getHeaders("application/vnd.github+json"),
          responseType: "text",
          maxRedirects: 5,
        },
      );

      if (typeof response.data !== "string") {
        return res.status(404).json({ error: "Logs returned in unexpected format or not available" });
      }

      res.header("Content-Type", "text/plain");
      res.send(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message = status === 404
        ? "Logs are no longer available (likely expired) or this is not a GitHub Actions run."
        : "Failed to retrieve logs from GitHub.";
      res.status(status).json({ error: message, details: error.message });
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
