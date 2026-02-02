#!/usr/bin/env node

// Fetches a user's Letterboxd watchlist.
// Without --out: prints a JSON array of film URIs to stdout (pipe-friendly).
// With --out: writes that array (or full objects if --full) to a file.
// Usage (CLI):
//   node fetch_letterboxd_user_watchlist.js <username> [--pages N] [--out file.json] [--full] [--log]

const fs = require("fs");
const path = require("path");

const DEFAULT_MAX_PAGES = 15;
const MAX_PAGES_HARD_LIMIT = 50;

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase().replace(/^@+/, "");
}

function canonicalFilmUrl(url) {
  let u = String(url || "").trim();
  if (!u) return "";

  if (u.startsWith("/")) u = `https://letterboxd.com${u}`;
  u = u.replace(/^http:\/\//i, "https://");
  u = u.replace(/^https:\/\/letterboxd\.com\/[^/]+\/film\//i, "https://letterboxd.com/film/");

  const m = u.match(/^https:\/\/letterboxd\.com\/film\/([^/?#]+)\/?/i);
  if (m) return `https://letterboxd.com/film/${m[1]}/`;

  return u.endsWith("/") ? u : `${u}/`;
}

function decodeHtml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseWatchlistHtml(html) {
  const out = [];

  const reTargetLink = /data-target-link="(\/film\/[^"\/]+\/)"/gi;
  const reFilmSlug = /data-film-slug="([^"]+)"/gi;
  const reHrefFilm = /href="(\/film\/[^"]+)"/gi;

  function extractNameYearNear(idx) {
    const start = Math.max(0, idx - 600);
    const end = Math.min(html.length, idx + 600);
    const chunk = html.slice(start, end);

    let name = "";
    let year = "";

    const mName = chunk.match(/data-film-name="([^"]+)"/i);
    if (mName && mName[1]) name = decodeHtml(mName[1]);

    const mAlt = !name ? chunk.match(/alt="([^"]+)"/i) : null;
    if (!name && mAlt && mAlt[1]) name = decodeHtml(mAlt[1]);

    const mYear1 = chunk.match(/data-film-release-year="(\d{4})"/i);
    const mYear2 = !mYear1 ? chunk.match(/data-release-year="(\d{4})"/i) : null;
    const mYear3 = !mYear1 && !mYear2 ? chunk.match(/data-film-year="(\d{4})"/i) : null;

    const ym = (mYear1 && mYear1[1]) || (mYear2 && mYear2[1]) || (mYear3 && mYear3[1]);
    if (ym) year = ym;

    return { name, year };
  }

  function pushFilm(filmPath, idx, sourceUri) {
    if (!filmPath) return;

    const absolute = filmPath.startsWith("http")
      ? filmPath
      : `https://letterboxd.com${filmPath.startsWith("/") ? "" : "/"}${filmPath}`;

    const filmUri = canonicalFilmUrl(absolute);
    if (!filmUri) return;

    const mm = filmUri.match(/^https:\/\/letterboxd\.com\/film\/([^/]+)\/$/i);
    const slug = mm ? mm[1] : "";
    const fallbackName = slug ? slug.replace(/-/g, " ") : filmUri;

    const { name, year } = extractNameYearNear(idx);

    out.push({
      name: name || fallbackName,
      year: year || "",
      letterboxdUri: sourceUri || filmUri,
      filmUri,
    });
  }

  let m1;
  while ((m1 = reTargetLink.exec(html)) !== null) {
    pushFilm(m1[1], m1.index, `https://letterboxd.com${m1[1]}`);
  }

  let m2;
  while ((m2 = reFilmSlug.exec(html)) !== null) {
    pushFilm(`/film/${m2[1]}/`, m2.index, `https://letterboxd.com/film/${m2[1]}/`);
  }

  let m3;
  while ((m3 = reHrefFilm.exec(html)) !== null) {
    const href = m3[1];
    if (!href.startsWith("/film/")) continue;
    pushFilm(href, m3.index, `https://letterboxd.com${href}`);
  }

  const seen = new Set();
  const deduped = [];
  for (const f of out) {
    const k = String(f.filmUri || "").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    deduped.push(f);
  }

  return deduped;
}

async function fetchWatchlistTitles(username, opts = {}) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error("Username is required");

  const maxPages = Math.min(
    Math.max(1, Number(opts.maxPages) || DEFAULT_MAX_PAGES),
    MAX_PAGES_HARD_LIMIT,
  );

  if (opts.log) {
    console.error(`[fetch] username=${normalizedUsername} maxPages=${maxPages} urisOnly=${!!opts.urisOnly}`);
  }

  const films = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    const url =
      page === 1
        ? `https://letterboxd.com/${encodeURIComponent(normalizedUsername)}/watchlist/`
        : `https://letterboxd.com/${encodeURIComponent(normalizedUsername)}/watchlist/page/${page}/`;

    if (opts.log) console.error(`[fetch] page ${page} GET ${url}`);

    const res = await fetch(url, {
      headers: {
        "user-agent": "ihavewatchit/0.1 (+https://letterboxd.com)",
      },
    });

    if (!res.ok) {
      if (opts.log) console.error(`[fetch] page ${page} HTTP ${res.status}`);
      if (page === 1) throw new Error(`Failed to fetch watchlist: HTTP ${res.status}`);
      break;
    }

    const html = await res.text();
    const parsed = parseWatchlistHtml(html);

    if (opts.log) console.error(`[fetch] page ${page} parsed ${parsed.length} films (total so far: ${films.length + parsed.length})`);

    if (!parsed.length) break;

    for (const f of parsed) {
      const key = f.filmUri || f.letterboxdUri;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      films.push(f);
    }
  }

  if (opts.log) console.error(`[fetch] done: ${films.length} films`);

  if (opts.urisOnly) {
    return films
      .map((f) => f.filmUri || f.letterboxdUri || f.sourceUri || "")
      .filter(Boolean);
  }

  return films;
}

module.exports = { fetchWatchlistTitles, parseWatchlistHtml };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (!args.length) {
      console.error("Usage: node fetch_watchlist_titles.js <username> [--pages N] [--out file.json]");
      process.exit(1);
    }

    let username = "";
    let maxPages = DEFAULT_MAX_PAGES;
    let outFile = "";
    let urisOnly = true;
    let log = false;

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (!username && !arg.startsWith("--")) {
        username = arg;
        continue;
      }
      if (arg === "--pages" && args[i + 1]) {
        maxPages = Number(args[i + 1]) || DEFAULT_MAX_PAGES;
        i += 1;
        continue;
      }
      if (arg === "--out" && args[i + 1]) {
        outFile = args[i + 1];
        i += 1;
        continue;
      }
      if (arg === "--full") {
        urisOnly = false;
      }
      if (arg === "--log") {
        log = true;
      }
    }

    try {
      const items = await fetchWatchlistTitles(username, { maxPages, urisOnly, log });
      if (outFile) {
        await fs.promises.mkdir(path.dirname(outFile), { recursive: true });
        await fs.promises.writeFile(outFile, JSON.stringify(items, null, 2), "utf8");
        if (log) console.error(`[fetch] wrote ${items.length} items to ${outFile}`);
        console.log(`Saved ${items.length} items to ${outFile}`);
      } else {
        if (log) console.error(`[fetch] output ${items.length} URIs to stdout`);
        console.log(JSON.stringify(items, null, 2));
      }
    } catch (err) {
      console.error(err.message || String(err));
      process.exit(1);
    }
  })();
}
