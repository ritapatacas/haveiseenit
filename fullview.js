const feed = document.getElementById("feed");
let cachedEntries = [];
let clipPosts = [];
let clipsReady = false;
let clipTicking = false;
let viewState = { currentSheet: window.AppData.DEFAULT_SHEET };
let helpRef = null;

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
      renderEntries(cachedEntries, "", viewState.currentSheet);
      return;
    }

    const scored = cachedEntries
      .map((entry) => {
        const nameScore = window.AppCommon.scoreSearchText(entry.name, query);
        const directorScore =
          window.AppCommon.scoreSearchText(entry.director || "", query) * 0.8;
        const score = Math.max(nameScore, directorScore);
        return { entry, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date))
      .map((item) => item.entry);

    renderEntries(scored, query, viewState.currentSheet);
  });
}

function renderEntries(entries, searchQuery = "", sheet = window.AppData.DEFAULT_SHEET) {
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
      sheet === "watchlist"
        ? `Should I watch <u>${q}</u>?\n\nmaybe, but it's not in your <a href="${letterboxdWatchlist}" target="_blank" rel="noopener noreferrer">watchlist</a>`
        : `Have I seen <u>${q}</u>?\nno. (<a href="${letterboxdSearch}" target="_blank" rel="noopener noreferrer">did I</a>?)`;
    feed.innerHTML = `<div class="loading"><span>${msg.replace(/\n/g, "<br>")}</span></div>`;
    return;
  }

  initClips();
}

window.AppCommon.initView({
  container: feed,
  getEntryLimit,
  renderEntries: (entries, meta = {}) => {
    cachedEntries = entries;
    viewState.currentSheet = meta.currentSheet || viewState.currentSheet;
    const searchValue = helpRef?.input?.value?.trim() ?? "";
    renderEntries(entries, searchValue, viewState.currentSheet);
  },
  toggleViewParam: "slot",
  onRandom: randomFilm,
  randomKey: "Space",
  renderLoading: (message) => {
    feed.innerHTML = `<div class=\"loading\"><span>${message}</span></div>`;
  },
  renderError: (message) => {
    feed.innerHTML = `<div class=\"loading\"><span>${message}</span></div>`;
  },
  onHelpCreated: (help) => {
    helpRef = help;
    setupSearch(help.input);
  },
});
