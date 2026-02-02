#!/usr/bin/env node

// Serves the app and exposes GET /api/watchlist?user=xxx (returns array of film URIs).
// Run: node server.js [port]
// Open http://localhost:3000 (or chosen port). Submit a Letterboxd username to fetch watchlist live (no file).

const http = require("http");
const fs = require("fs");
const path = require("path");
const { fetchWatchlistTitles } = require("./fetch_letterboxd_user_watchlist.js");

const PORT = Number(process.env.PORT || process.argv[2] || 3000);
const ROOT = path.resolve(__dirname);

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, filePath) {
  const ext = path.extname(filePath);
  const type = MIME[ext] || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  stream.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  res.writeHead(200, { "Content-Type": type });
  stream.pipe(res);
}

const watchlistCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizedUser(v) {
  return String(v || "").trim().toLowerCase().replace(/^@+/, "");
}

async function handleApiWatchlist(user, res) {
  const id = normalizedUser(user);
  if (!id) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "user query param required" }));
    return;
  }
  const cached = watchlistCache.get(id);
  if (cached && Date.now() < cached.expires) {
    console.error(`[fetch] cache hit: ${id} (${cached.uris.length} URIs)`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(cached.uris));
    return;
  }
  try {
    const uris = await fetchWatchlistTitles(user, {
      urisOnly: true,
      log: true,
      maxPages: 20,
    });
    watchlistCache.set(id, { uris, expires: Date.now() + CACHE_TTL_MS });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(uris));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  if (pathname === "/api/watchlist") {
    const user = url.searchParams.get("user");
    handleApiWatchlist(user, res);
    return;
  }

  const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "").replace(/\.\./g, "");
  let filePath = path.join(ROOT, safePath);
  if (!safePath.includes(".")) {
    filePath = path.join(ROOT, "index.html");
  }
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  serveStatic(req, res, filePath);
});

server.listen(PORT, () => {
  console.log(`Server at http://localhost:${PORT}`);
  console.log("GET /api/watchlist?user=<letterboxd_username> → array of film URIs");
});
