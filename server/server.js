#!/usr/bin/env node

// API + static app server.
// API: GET /api → index; GET /api/watchlist?user=<letterboxd_username> → array of film URIs.
// Static: serves the app (index.html, *.js, *.css, etc.).
// Run: node server.js [port]

const http = require("http");
const fs = require("fs");
const path = require("path");
const { fetchWatchlistTitles } = require("./fetch_letterboxd_user_watchlist.js");

const PORT = Number(process.env.PORT || 8080);
const ROOT = path.resolve(__dirname, "../public");

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json", ...CORS_HEADERS });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res, filePath) {
  const ext = path.extname(filePath);
  const type = MIME[ext] || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
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
    sendJson(res, 400, { error: "user query param required" });
    return;
  }
  const cached = watchlistCache.get(id);
  if (cached && Date.now() < cached.expires) {
    console.error(`[fetch] cache hit: ${id} (${cached.uris.length} URIs)`);
    sendJson(res, 200, cached.uris);
    return;
  }
  try {
    const uris = await fetchWatchlistTitles(user, {
      urisOnly: true,
      log: true,
      maxPages: 20,
    });
    watchlistCache.set(id, { uris, expires: Date.now() + CACHE_TTL_MS });
    sendJson(res, 200, uris);
  } catch (err) {
    sendJson(res, 500, { error: err.message || String(err) });
  }
}

function handleApiIndex(res) {
  sendJson(res, 200, {
    name: "ihavewatchit",
    endpoints: {
      watchlist: "GET /api/watchlist?user=<letterboxd_username> → array of film URIs",
    },
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (pathname === "/api" || pathname === "/api/") {
    handleApiIndex(res);
    return;
  }

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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server at http://0.0.0.0:${PORT}`);
});

