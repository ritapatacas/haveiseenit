const SHEET_ID = "1sP2Tkz00oTiVoACyCznYBOqTaUecUVbUKSQUWVsQDe4";
const SHEET_NAME = "films";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
  SHEET_NAME
)}`;

const feed = document.getElementById("feed");

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
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 4) continue;
    rows.push({
      date: cols[0],
      name: cols[1],
      year: cols[2],
      uri: cols[3],
      rating: cols[4] || "",
      review: cols[5] || "",
      image: cols[6] || "",
    });
  }

  return rows;
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

function initClips() {
  const posts = Array.from(document.querySelectorAll(".post"));
  const vh = () => window.innerHeight;

  for (const post of posts) {
    const layer = post.querySelector(".post__fixed");
    layer.style.backgroundImage = `url("${post.dataset.bg}")`;
  }

  let ticking = false;

  function updateClips() {
    const H = vh();

    for (const post of posts) {
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

    ticking = false;
  }

  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateClips);
  }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize);

  updateClips();
}

function setupRandomFilmHotkey() {
  function onKeyDown(event) {
    if (event.key !== "r" && event.key !== "R") return;
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

    const posts = Array.from(document.querySelectorAll(".post"));
    if (!posts.length) return;
    const choice = posts[Math.floor(Math.random() * posts.length)];
    choice.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  window.addEventListener("keydown", onKeyDown);
}

async function init() {
  const csvText = await fetch(CSV_URL).then((res) => res.text());
  const entries = parseCsv(csvText)
    .filter((row) => row.name && row.year)
    .sort((a, b) => b.date.localeCompare(a.date));

  feed.innerHTML = "";

  entries.forEach((entry) => {
    const backdropUrl = entry.image;
    if (!backdropUrl) return;
    const post = createPost({
      name: entry.name,
      year: entry.year,
      uri: entry.uri,
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
  setupRandomFilmHotkey();
}

init();
