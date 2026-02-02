const feed = document.getElementById("feed");
let cachedEntries = [];
let clipPosts = [];
let clipsReady = false;
let clipTicking = false;
let currentSheet = window.AppData.DEFAULT_SHEET;

function normalizeId(value) {
  return String(value || "").trim().toLowerCase().replace(/^@+/, "");
}

let watchlistInFlight = null;

async function fetchExternalUris(username) {
  const id = normalizeId(username);
  if (!id) throw new Error("Username is required");

  if (watchlistInFlight && watchlistInFlight.id === id) {
    return watchlistInFlight.promise;
  }
  const promise = (async () => {
    const res = await fetch(`/api/watchlist?user=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const uris = await res.json();
    if (!Array.isArray(uris)) throw new Error("Invalid response: expected array of URIs");
    return uris;
  })();
  watchlistInFlight = { id, promise };
  try {
    return await promise;
  } finally {
    if (watchlistInFlight && watchlistInFlight.id === id) watchlistInFlight = null;
  }
}

function getEntryLimit() {
  const isSmall = window.matchMedia("(max-width: 768px)").matches;
  return isSmall ? 40 : null;
}

function ratingToStars(rating) {
  const value = Number.parseFloat(rating);
  if (!Number.isFinite(value) || value <= 0) return "";

  const clamped = Math.min(5, Math.max(0, value));
  const full = Math.floor(clamped);
  const hasHalf = clamped - full >= 0.5;
  const stars = "★".repeat(full) + (hasHalf ? "½" : "");
  return stars;
}

function createPost({ name, year, director, letterboxdUri, rating, review, backdropUrl }) {
  const section = document.createElement("section");
  section.className = "post";
  section.dataset.bg = backdropUrl;

  const fixed = document.createElement("div");
  fixed.className = "post__fixed";

  const ui = document.createElement("div");
  ui.className = "post__ui";

  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("h2");
  const link = document.createElement("a");
  link.href = letterboxdUri || "#";
  const strong = document.createElement("strong");
  strong.textContent = name;
  link.append(strong);
  const stars = ratingToStars(rating);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  title.append(link);
  const metaText = director ? ` (${year}), ${director}` : ` (${year})`;
  title.append(document.createTextNode(metaText));
  if (stars) {
    title.append(document.createElement("br"));
    const ratingLine = document.createElement("span");
    ratingLine.className = "rating";
    if (stars.includes("½")) {
      const splitIndex = stars.indexOf("½");
      const fullStars = stars.slice(0, splitIndex);
      ratingLine.append(fullStars);
      const half = document.createElement("span");
      half.className = "rating__half";
      half.textContent = "½";
      ratingLine.append(half);
    } else {
      ratingLine.textContent = stars;
    }
    title.append(ratingLine);
  }
  card.append(title);
  if (review) {
    const reviewText = document.createElement("p");
    reviewText.textContent = review;
    card.append(reviewText);
  }
  ui.append(card);
  section.append(fixed, ui);
  return section;
}

function updateClips() {
  const H = window.innerHeight;

  for (const post of clipPosts) {
    const rect = post.getBoundingClientRect();
    const layer = post.querySelector(".post__fixed");

    const top = Math.max(0, rect.top);
    const bottom = Math.min(H, rect.bottom);

    if (bottom <= 0 || top >= H) {
      layer.style.clipPath = `inset(${H}px 0 0 0)`;
      continue;
    }

    const insetTop = top;
    const insetBottom = H - bottom;

    layer.style.clipPath = `inset(${insetTop}px 0 ${insetBottom}px 0)`;
  }

  clipTicking = false;
}

function initClips() {
  clipPosts = Array.from(document.querySelectorAll(".post"));
  const vh = () => window.innerHeight;

  for (const post of clipPosts) {
    const layer = post.querySelector(".post__fixed");
    layer.style.backgroundImage = `url("${post.dataset.bg}")`;
  }

  function onScrollOrResize() {
    if (clipTicking) return;
    clipTicking = true;
    requestAnimationFrame(updateClips);
  }

  if (!clipsReady) {
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    clipsReady = true;
  }

  updateClips();
}

function randomFilm() {
  const posts = Array.from(document.querySelectorAll(".post"));
  if (!posts.length) return;
  const choice = posts[Math.floor(Math.random() * posts.length)];
  choice.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupSearch(input) {
  if (!input) return;
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      renderEntries(cachedEntries, "");
      return;
    }

    function scoreText(text, q) {
      if (!text) return 0;
      const t = text.toLowerCase();
      if (t === q) return 100;
      if (t.startsWith(q)) return 80;
      if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t)) return 70;
      if (t.includes(q)) return 50;
      return 0;
    }

    const scored = cachedEntries
      .map((entry) => {
        const nameScore = scoreText(entry.name, query);
        const directorScore = scoreText(entry.director || "", query) * 0.8;
        const score = Math.max(nameScore, directorScore);
        return { entry, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date))
      .map((item) => item.entry);

    renderEntries(scored, query);
  });
}

function renderEntries(entries, searchQuery = "") {
  feed.innerHTML = "";
  const usePoster = window.matchMedia("(orientation: portrait)").matches;

  entries.forEach((entry) => {
    const backdropUrl = usePoster ? entry.poster || entry.image : entry.image || entry.poster;
    if (!backdropUrl) return;
    const post = createPost({
      name: entry.name,
      year: entry.year,
      director: entry.director,
      letterboxdUri: entry.letterboxdUri,
      rating: entry.rating,
      review: entry.review,
      backdropUrl,
    });
    feed.appendChild(post);
  });

  if (!feed.children.length) {
    const q = (searchQuery || "it").trim() || "it";
    const letterboxdWatchlist = "https://letterboxd.com/ritsaptcs/watchlist/";
    const letterboxdSearch = `https://letterboxd.com/search/${encodeURIComponent(q)}`;
    const msg =
      currentSheet === "watchlist"
        ? `Should I watch <u>${q}</u>?\n\nmaybe, but it's not in your <a href="${letterboxdWatchlist}" target="_blank" rel="noopener noreferrer">watchlist</a>`
        : `Have I seen <u>${q}</u>?\nno. (<a href="${letterboxdSearch}" target="_blank" rel="noopener noreferrer">did I</a>?)`;
    feed.innerHTML = `<div class="loading"><span>${msg.replace(/\n/g, "<br>")}</span></div>`;
    return;
  }

  initClips();
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  currentSheet = params.get("l") === "w" ? "watchlist" : "films";

  async function loadEntries() {
    const csvText = await fetch(window.AppData.getCsvUrl(currentSheet)).then((res) => res.text());
    cachedEntries = window.AppData.parseCsv(csvText)
      .filter((row) => row.name && row.year)
      .sort((a, b) => b.date.localeCompare(a.date));
    const limit = getEntryLimit();
    if (limit) cachedEntries = cachedEntries.slice(0, limit);
    renderEntries(cachedEntries, help.input?.value?.trim() ?? "");
  }

  async function loadIntersectFromId(rawId) {
    const id = normalizeId(rawId);
    if (!id) {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete("u");
      window.history.replaceState({}, "", `?${nextParams.toString()}`);
      await loadEntries();
      return;
    }

    feed.innerHTML = `<div class="loading"><span>Loading watchlist for ${id}…</span></div>`;
    try {
      const externalUris = await fetchExternalUris(id);
      if (!externalUris || !externalUris.length) {
        throw new Error("Watchlist scrape returned empty list");
      }
      const rows = await window.AppData.fetchSheetWatchlistIntersection(externalUris);
      const matches = rows
        .filter((row) => row.name && row.year)
        .sort((a, b) => b.date.localeCompare(a.date));
      console.log("[watchlist] matches found:", matches.length, matches.map((r) => ({ name: r.name, year: r.year, uri: r.filmUri || r.letterboxdUri })));
      cachedEntries = matches;

      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("u", id);
      window.history.replaceState({}, "", `?${nextParams.toString()}`);

      renderEntries(cachedEntries, help.input?.value?.trim() ?? "");
    } catch (err) {
      feed.innerHTML = `<div class="loading"><span>Falhou a watchlist de ${id}: ${err.message}</span></div>`;
    }
  }

  const help = window.HelpUI.createHelpUI({
    currentList: currentSheet,
    onToggleView: () => {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("v", "col");
      window.location.search = nextParams.toString();
    },
    onRandom: randomFilm,
    onToggleList: async (nextList) => {
      currentSheet = nextList;
      const nextParams = new URLSearchParams(window.location.search);
      if (currentSheet === "watchlist") {
        nextParams.set("l", "w");
      } else {
        nextParams.delete("l");
      }
      window.history.replaceState({}, "", `?${nextParams.toString()}`);
      window.HelpUI.setListToggle(help.toggle, currentSheet);
      await loadEntries();
    },
    onUsersSubmit: loadIntersectFromId,
  });
  window.HelpUI.setListToggle(help.toggle, currentSheet);
  window.HelpUI.setupCommonHotkeys(help, {
    onToggleView: () => {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("v", "col");
      window.location.search = nextParams.toString();
    },
    onRandom: randomFilm,
    randomKey: "Space",
  });

  setupSearch(help.input);

  await loadEntries();

  const userFromUrl = params.get("u");
  if (userFromUrl) {
    if (help.idInput) help.idInput.value = userFromUrl;
    await loadIntersectFromId(userFromUrl);
  }
}

init();
