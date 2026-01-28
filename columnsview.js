const SHEET_ID = "1sP2Tkz00oTiVoACyCznYBOqTaUecUVbUKSQUWVsQDe4";
const SHEET_NAME = "films";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
  SHEET_NAME
)}`;

const columnsRoot = document.getElementById("columns");

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
    if (cols.length < 7) continue;
    rows.push({
      date: cols[0],
      name: cols[1],
      year: cols[2],
      uri: cols[3],
      rating: cols[4] || "",
      review: cols[5] || "",
      image: cols[6] || "",
      poster: cols[7] || "",
    });
  }

  return rows;
}

function getColumnCount() {
  const w = window.innerWidth;
  if (w <= 520) return 2;
  if (w <= 680) return 3;
  if (w <= 840) return 4;
  if (w <= 1000) return 5;
  if (w <= 1160) return 6;
  if (w <= 1320) return 7;
  if (w <= 1480) return 8;
  if (w <= 1640) return 9;
  if (w <= 1800) return 10;
  if (w <= 1960) return 11;
  return 12;
}

function createItem(entry) {
  const link = document.createElement("a");
  link.className = "column__item";
  link.dataset.key = `${entry.name}||${entry.year}`.toLowerCase();
  link.href = entry.uri || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";
  img.src = entry.poster || entry.image;
  img.alt = `${entry.name} (${entry.year})`;
  link.appendChild(img);
  return link;
}

function buildTrack(entries) {
  const track = document.createElement("div");
  track.className = "column__track";

  for (let copy = 0; copy < 3; copy += 1) {
    for (const entry of entries) {
      track.appendChild(createItem(entry));
    }
  }

  return track;
}

function setupInfiniteScroll(column, onReady) {
  const track = column.querySelector(".column__track");
  if (!track) return;

  function updateSegmentHeight() {
    const segmentHeight = track.scrollHeight / 3;
    if (!Number.isFinite(segmentHeight) || segmentHeight <= 0) return;
    column.dataset.segmentHeight = String(segmentHeight);
    column.scrollTop = segmentHeight;
    if (typeof onReady === "function") onReady();
  }

  const images = Array.from(track.querySelectorAll("img"));
  if (!images.length) return;

  let loaded = 0;
  const onLoad = () => {
    loaded += 1;
    if (loaded >= images.length) {
      updateSegmentHeight();
    }
  };

  images.forEach((img) => {
    if (img.complete) {
      onLoad();
    } else {
      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", onLoad, { once: true });
    }
  });

  column.addEventListener("scroll", () => {
    const segmentHeight = Number(column.dataset.segmentHeight || 0);
    if (!segmentHeight) return;
    if (column.scrollTop < segmentHeight * 0.5) {
      column.scrollTop += segmentHeight;
    } else if (column.scrollTop > segmentHeight * 1.5) {
      column.scrollTop -= segmentHeight;
    }
  });
}

function setupWheelScroll(column) {
  column.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      column.scrollTop += event.deltaY;
    },
    { passive: false }
  );
}

function setupLinkedScroll(columns) {
  const lastScrollTop = new WeakMap();
  let syncing = false;

  columns.forEach((column) => {
    lastScrollTop.set(column, column.scrollTop);

    column.addEventListener("scroll", () => {
      const current = column.scrollTop;
      const last = lastScrollTop.get(column) ?? current;
      const delta = current - last;
      lastScrollTop.set(column, current);

      if (syncing || delta === 0) return;

      syncing = true;
      columns.forEach((other) => {
        if (other === column) return;
        const distance = Math.abs(other.dataset.index - column.dataset.index);
        const factor = 0.6 / Math.max(1, distance);
        other.scrollTop += delta * factor;
        lastScrollTop.set(other, other.scrollTop);
      });
      syncing = false;
    });
  });
}

function renderColumns(entries, offset = 0, focusKey = "") {
  const withImages = entries.filter((entry) => entry.poster || entry.image);
  const count = getColumnCount();
  columnOffset = offset;

  columnsRoot.style.setProperty("--cols", String(count));
  columnsRoot.innerHTML = "";

  const columns = Array.from({ length: count }, () => []);
  withImages.forEach((entry, index) => {
    const colIndex = (index + offset) % count;
    columns[colIndex].push(entry);
  });
  columnData = columns;

  columnEls = [];
  columns.forEach((items, index) => {
    const column = document.createElement("div");
    column.className = "column";
    column.dataset.index = String(index);

    const track = buildTrack(items);
    column.appendChild(track);
    columnsRoot.appendChild(column);
    columnEls.push(column);

    const isCenter = focusKey && index === Math.floor(count / 2);
    setupInfiniteScroll(column, isCenter ? () => focusInCenter(focusKey) : null);
    setupWheelScroll(column);
  });

  setupLinkedScroll(columnEls);
}

function focusInCenter(focusKey) {
  if (!focusKey || !columnEls.length) return;
  const centerIndex = Math.floor(columnEls.length / 2);
  const column = columnEls[centerIndex];
  if (!column) return;

  const items = Array.from(column.querySelectorAll(".column__item"));
  if (!items.length) return;

  const matches = items.filter(
    (item) => (item.dataset.key || "").toLowerCase() === focusKey
  );
  if (!matches.length) return;

  const segmentHeight = Number(column.dataset.segmentHeight || 0);
  let target = matches[Math.floor(matches.length / 2)];
  if (segmentHeight) {
    let best = null;
    let bestDiff = Infinity;
    for (const item of matches) {
      const diff = Math.abs(item.offsetTop - segmentHeight);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = item;
      }
    }
    if (best) target = best;
  }
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  column.scrollTop += Math.round(column.clientHeight * 3.04);
}

let cachedEntries = [];
let columnEls = [];
let columnData = [];
let columnOffset = 0;

function triggerSlotSpin() {
  if (!columnEls.length) return;

  const states = columnEls.map((col, index) => {
    const segmentHeight = Number(col.dataset.segmentHeight || 0);
    const duration = 2000 + Math.random() * 3000;
    const baseSpeed = 6 + Math.random() * 6;
    const speed = baseSpeed * (1 + (columnEls.length - 1 - index) * 0.05);
    return { col, duration, speed, start: performance.now(), segmentHeight };
  });

  function step(now) {
    let active = false;
    states.forEach((state) => {
      const elapsed = now - state.start;
      if (elapsed >= state.duration) return;
      active = true;
      const t = elapsed / state.duration;
      const ease = (1 - t) * (1 - t);
      const delta = state.speed * ease * 16;
      state.col.scrollTop += delta;
    });
    if (active) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
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
    const next = "full";
    window.location.search = `?v=${next}`;
  });
}

async function init() {
  setupViewToggleHotkey();
  const csvText = await fetch(CSV_URL).then((res) => res.text());
  cachedEntries = parseCsv(csvText)
    .filter((row) => row.name && row.year)
    .sort((a, b) => b.date.localeCompare(a.date));

  renderColumns(cachedEntries);
}

let resizeTimer = null;
window.addEventListener("resize", () => {
  if (!cachedEntries.length) return;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    renderColumns(cachedEntries);
  }, 200);
});

init();

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space") return;
  const target = event.target;
  if (
    target &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  ) {
    return;
  }
  event.preventDefault();
  triggerSlotSpin();
});
