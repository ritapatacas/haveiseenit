const SHEET_ID = "1sP2Tkz00oTiVoACyCznYBOqTaUecUVbUKSQUWVsQDe4";
const SHEET_NAME = "films";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
  SHEET_NAME
)}`;

const columnsRoot = document.getElementById("columns");

function addHelpButton() {
  const button = document.createElement("button");
  button.className = "help-button";
  button.type = "button";
  button.setAttribute("aria-label", "Help");

  const icon = document.createElement("i");
  icon.className = "fa-regular fa-circle-question fa-fade";
  button.appendChild(icon);

  document.body.appendChild(button);
  return button;
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

function setupInfiniteScroll(column) {
  const track = column.querySelector(".column__track");
  if (!track) return;

  function updateSegmentHeight() {
    const segmentHeight = track.scrollHeight / 3;
    if (!Number.isFinite(segmentHeight) || segmentHeight <= 0) return;
    column.dataset.segmentHeight = String(segmentHeight);
    column.scrollTop = segmentHeight;
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

function renderColumns(entries) {
  const withImages = entries.filter((entry) => entry.poster || entry.image);
  const count = getColumnCount();

  columnsRoot.style.setProperty("--cols", String(count));
  columnsRoot.innerHTML = "";

  const columns = Array.from({ length: count }, () => []);
  withImages.forEach((entry, index) => {
    columns[index % count].push(entry);
  });

  columns.forEach((items) => {
    const column = document.createElement("div");
    column.className = "column";

    const track = buildTrack(items);
    column.appendChild(track);
    columnsRoot.appendChild(column);

    setupInfiniteScroll(column);
    setupWheelScroll(column);
  });
}

let cachedEntries = [];

async function init() {
  addHelpButton();
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
