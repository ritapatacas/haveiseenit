const feed = document.getElementById("feed");
const FULL_CONFIG = {
  mobileEntryLimit: 40,
  /** Max number of posts that get background loaded at once (viewport + buffer) */
  maxLoadedBackgrounds: 5,
  /** Root margin for Intersection Observer: load background when within this distance of viewport */
  lazyRootMargin: "100% 0px",
};
let cachedEntries = [];
let clipPosts = [];
let clipsReady = false;
let clipTicking = false;
let viewState = { currentSheet: window.AppData.DEFAULT_SHEET };
let helpRef = null;
let lazyObserver = null;

function getEntryLimit() {
  const isSmall = window.matchMedia("(max-width: 768px)").matches;
  return isSmall ? FULL_CONFIG.mobileEntryLimit : null;
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
  const margin = H * 0.5;
  let bestLayer = null;
  let bestVisible = 0;

  for (const post of clipPosts) {
    const rect = post.getBoundingClientRect();
    const layer = post.querySelector(".post__fixed");
    if (!layer) continue;

    const inRange = rect.bottom >= -margin && rect.top <= H + margin;
    if (!inRange) {
      layer.style.clipPath = `inset(${H}px 0 0 0)`;
      layer.classList.remove("post__fixed--active");
      continue;
    }

    const top = Math.max(0, rect.top);
    const bottom = Math.min(H, rect.bottom);

    if (bottom <= 0 || top >= H) {
      layer.style.clipPath = `inset(${H}px 0 0 0)`;
      layer.classList.remove("post__fixed--active");
      continue;
    }

    const insetTop = top;
    const insetBottom = H - bottom;
    layer.style.clipPath = `inset(${insetTop}px 0 ${insetBottom}px 0)`;
    layer.classList.remove("post__fixed--active");

    const visibleHeight = bottom - top;
    if (visibleHeight > bestVisible) {
      bestVisible = visibleHeight;
      bestLayer = layer;
    }
  }

  if (bestLayer) bestLayer.classList.add("post__fixed--active");
  clipTicking = false;
}

function setPostBackground(post, url) {
  const layer = post.querySelector(".post__fixed");
  if (!layer || !url) return;
  const tmdb = window.AppTmdbImages;
  const resolved = tmdb && tmdb.isTmdbImageUrl(url) ? tmdb.getTmdbUrlForContext(url, "backdrop") : url;
  layer.style.backgroundImage = `url("${resolved}")`;
}

function clearPostBackground(post) {
  const layer = post.querySelector(".post__fixed");
  if (layer) layer.style.backgroundImage = "";
}

function setupLazyBackgrounds() {
  if (lazyObserver) lazyObserver.disconnect();
  clipPosts = Array.from(document.querySelectorAll(".post"));
  if (!clipPosts.length) return;

  const loadedSet = new Set();

  lazyObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const post = entry.target;
        const url = post.dataset.bg;
        if (!url) continue;

        if (entry.isIntersecting) {
          if (!post.dataset.bgLoaded) {
            setPostBackground(post, url);
            post.dataset.bgLoaded = "1";
            loadedSet.add(post);
          }
        } else {
          if (post.dataset.bgLoaded && loadedSet.size > FULL_CONFIG.maxLoadedBackgrounds) {
            clearPostBackground(post);
            delete post.dataset.bgLoaded;
            loadedSet.delete(post);
          }
        }
      }
    },
    {
      root: null,
      rootMargin: FULL_CONFIG.lazyRootMargin,
      threshold: 0,
    }
  );

  clipPosts.forEach((post) => {
    if (post.dataset.bg) lazyObserver.observe(post);
  });

  /** Defer to after layout so getBoundingClientRect is correct (e.g. after search re-render) */
  requestAnimationFrame(() => {
    const firstInView = clipPosts.find((p) => {
      const r = p.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });
    if (firstInView && firstInView.dataset.bg) {
      setPostBackground(firstInView, firstInView.dataset.bg);
      firstInView.dataset.bgLoaded = "1";
      loadedSet.add(firstInView);
    }
  });
}

function initClips() {
  clipPosts = Array.from(document.querySelectorAll(".post"));

  setupLazyBackgrounds();

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
  /** Pre-load background so it’s loading before scroll ends (avoids flash when post was unloaded) */
  if (choice.dataset.bg) setPostBackground(choice, choice.dataset.bg);
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
  /** On mobile, only render limited posts when not searching (search uses full cachedEntries) */
  const limit = !searchQuery ? getEntryLimit() : null;
  const toRender = limit ? entries.slice(0, limit) : entries;

  toRender.forEach((entry) => {
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
