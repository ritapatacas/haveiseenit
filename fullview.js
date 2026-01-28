const SHEET_ID = "1sP2Tkz00oTiVoACyCznYBOqTaUecUVbUKSQUWVsQDe4";
const SHEET_NAME = "films";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
  SHEET_NAME
)}`;

const feed = document.getElementById("feed");
let cachedEntries = [];
let hotkeyReady = false;
let clipPosts = [];
let clipsReady = false;
let clipTicking = false;

function addHelpButton() {
  const button = document.createElement("div");
  button.className = "help-button";
  button.setAttribute("role", "button");
  button.setAttribute("aria-label", "Help");

  const iconWrap = document.createElement("span");
  iconWrap.className = "help-button__icon";

  const icon = document.createElement("i");
  icon.className = "fa-regular fa-circle-question fa-fade";
  iconWrap.appendChild(icon);

  const panel = document.createElement("span");
  panel.className = "help-button__panel";
  panel.innerHTML =
    "<span><strong>have i seen it?</strong></span>" +
    "<span>search</span>" +
    "<input class=\"help-search\" type=\"search\" placeholder=\"search…\" />" +
    "<span>keys:</span>" +
    "<span>toggle</span>" +
    "<span>random</span>";

  const close = document.createElement("button");
  close.className = "help-button__close";
  close.type = "button";
  close.setAttribute("aria-label", "Close help");
  close.textContent = "×";

  button.append(iconWrap, panel, close);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const target = event.target;
    if (target instanceof HTMLElement) {
      if (target.closest(".help-button__close") || target.closest(".help-button__icon")) {
        button.classList.toggle("help-button--open");
      }
    }
  });

  document.addEventListener("click", () => {
    button.classList.remove("help-button--open");
  });

  const input = button.querySelector(".help-search");
  const panelEl = button.querySelector(".help-button__panel");
  if (input) {
    input.addEventListener("click", (event) => event.stopPropagation());
  }
  if (panelEl) {
    panelEl.addEventListener("click", (event) => event.stopPropagation());
  }

  document.body.appendChild(button);
  return { button, input };
}

function setupHelpSearchFocus(help) {
  if (!help || !help.input || !help.button) return;
  window.addEventListener("keydown", (event) => {
    if (event.key.length !== 1) return;
    const target = event.target;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
    ) {
      return;
    }
    if (!help.button.classList.contains("help-button--open")) return;
    help.input.focus();
    help.input.value += event.key;
    help.input.dispatchEvent(new Event("input", { bubbles: true }));
    event.preventDefault();
  });
}

function setupViewToggleHotkey() {
  window.addEventListener("keydown", (event) => {
    if (event.key !== "v" && event.key !== "V") return;
    const target = event.target;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
    ) {
      return;
    }
    const next = "col";
    window.location.search = `?v=${next}`;
  });
}

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
      uri: cols[3],
      rating: cols[4] || "",
      review: cols[5] || "",
      image: cols[6] || "",
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
}

async function init() {
  const help = addHelpButton();
  setupViewToggleHotkey();
  const csvText = await fetch(CSV_URL).then((res) => res.text());
  cachedEntries = parseCsv(csvText)
    .filter((row) => row.name && row.year)
    .sort((a, b) => b.date.localeCompare(a.date));

  renderEntries(cachedEntries);
  setupSearch(help.input);
  setupHelpSearchFocus(help);
  if (!hotkeyReady) {
    setupRandomFilmHotkey();
    hotkeyReady = true;
  }
}

init();
