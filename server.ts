import express from "express";
import path from "path";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // GitHub API integration
  const REPO_OWNER = "harpertoken";
  const REPO_NAME = "harper";

  const getHeaders = (accept: string) => {
    const headers: any = { Accept: accept };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
  };

  app.get("/api/pulls", async (req, res) => {
    try {
      const state = req.query.state || "open";
      const page = req.query.page || 1;
      const perPage = req.query.per_page || 30;
      const response = await axios.get(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=${state}&per_page=${perPage}&page=${page}`,
        { headers: getHeaders("application/vnd.github.v3+json") }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("GitHub API Error (Pulls):", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ error: error.response?.data?.message || error.message });
    }
  });

  app.get("/api/pulls/:number/diff", async (req, res) => {
    try {
      const { number } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${number}`,
        { headers: getHeaders("application/vnd.github.v3.diff") }
      );
      res.send(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({ error: error.response?.data?.message || error.message });
    }
  });

  app.get("/api/pulls/:number/files", async (req, res) => {
    try {
      const { number } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${number}/files`,
        { headers: getHeaders("application/vnd.github.v3+json") }
      );
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({ error: error.response?.data?.message || error.message });
    }
  });

  app.get("/api/pulls/:number/comments", async (req, res) => {
    try {
      const { number } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${number}/comments`,
        { headers: getHeaders("application/vnd.github.v3+json") }
      );
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({ error: error.response?.data?.message || error.message });
    }
  });

  app.get("/api/pulls/:number/review-comments", async (req, res) => {
    try {
      const { number } = req.params;
      const response = await axios.get(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${number}/comments`,
        { headers: getHeaders("application/vnd.github.v3+json") }
      );
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({ error: error.response?.data?.message || error.message });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
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
