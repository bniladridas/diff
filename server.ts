import "dotenv/config";
import express from "express";
import path from "path";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // GitHub API integration
  const REPO_OWNER = process.env.GITHUB_REPO_OWNER || "bniladridas";
  const REPO_NAME = process.env.GITHUB_REPO_NAME || "diff";

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
