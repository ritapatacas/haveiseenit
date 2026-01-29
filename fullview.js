const SHEET_ID = "1sP2Tkz00oTiVoACyCznYBOqTaUecUVbUKSQUWVsQDe4";
const DEFAULT_SHEET = "films";

function getCsvUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    sheetName
  )}`;
}

const feed = document.getElementById("feed");
let cachedEntries = [];
let clipPosts = [];
let clipsReady = false;
let clipTicking = false;
let currentSheet = DEFAULT_SHEET;

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  if (rows.length <= 1) return [];
  rows.shift();

  return rows
    .filter((cols) => cols.length >= 4)
    .map((cols) => ({
      date: cols[0],
      name: cols[1],
      year: cols[2],
      letterboxdUri: cols[3] || "",
      filmUri: cols[4] || "",
      image: cols[5] || "",
      poster: cols[6] || "",
      genre: cols[7] || "",
      director: cols[8] || "",
      rating: cols[9] || "",
      review: cols[10] || "",
    }));
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

function createPost({ name, year, uri, rating, review, backdropUrl }) {
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
  link.href = uri;
  link.textContent = `${name} (${year})`;
  const stars = ratingToStars(rating);
  if (stars) {
    link.append(document.createElement("br"));
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
    link.append(ratingLine);
  }
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  title.append(link);
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
    const filtered = query
      ? cachedEntries.filter((entry) => entry.name.toLowerCase().includes(query))
      : cachedEntries;
    renderEntries(filtered);
  });
}

function renderEntries(entries) {
  feed.innerHTML = "";

  entries.forEach((entry) => {
    const backdropUrl = entry.image;
    if (!backdropUrl) return;
    const uri = entry.filmUri || entry.letterboxdUri;
    const post = createPost({
      name: entry.name,
      year: entry.year,
      uri,
      rating: entry.rating,
      review: entry.review,
      backdropUrl,
    });
    feed.appendChild(post);
  });

  if (!feed.children.length) {
    feed.innerHTML = "<div class=\"loading\">No backdrops found.</div>";
    return;
  }

  initClips();
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  currentSheet = params.get("list") === "watchlist" ? "watchlist" : "films";

  const help = window.HelpUI.createHelpUI({
    currentList: currentSheet,
    onToggleList: async (nextList) => {
      currentSheet = nextList;
      const nextParams = new URLSearchParams(window.location.search);
      if (currentSheet === "watchlist") {
        nextParams.set("list", "watchlist");
      } else {
        nextParams.delete("list");
      }
      window.history.replaceState({}, "", `?${nextParams.toString()}`);
      window.HelpUI.setListToggle(help.toggle, currentSheet);
      await loadEntries();
    },
  });
  window.HelpUI.setListToggle(help.toggle, currentSheet);
  window.HelpUI.setupCommonHotkeys(help, {
    onToggleView: () => {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("v", "col");
      window.location.search = nextParams.toString();
    },
    onRandom: randomFilm,
  });
  async function loadEntries() {
    const csvText = await fetch(getCsvUrl(currentSheet)).then((res) => res.text());
    cachedEntries = parseCsv(csvText)
      .filter((row) => row.name && row.year)
      .sort((a, b) => b.date.localeCompare(a.date));
    renderEntries(cachedEntries);
  }

  setupSearch(help.input);
  await loadEntries();
}

init();
