const columnsRoot = document.getElementById("columns");

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

function getEntryImage(entry) {
  if (!entry) return "";
  const poster = typeof entry.poster === "string" ? entry.poster.trim() : "";
  if (poster) return poster;
  const image = typeof entry.image === "string" ? entry.image.trim() : "";
  return image;
}

function createItem(entry) {
  const link = document.createElement("a");
  link.className = "column__item";
  link.dataset.key = `${entry.name}||${entry.year}`.toLowerCase();
  link.href = entry.filmUri || entry.letterboxdUri || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";
  img.src = getEntryImage(entry);
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
      clearHighlight();
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

      if (isProgrammaticFocus) return;
      if (!syncing && delta !== 0) clearHighlight();
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

function renderColumns(
  entries,
  offset = 0,
  focusKeys = null,
  focusKey = "",
  matchColumnMap = null
) {
  const withImages = entries.filter((entry) => getEntryImage(entry));
  const count = getColumnCount();
  const token = ++renderToken;
  columnOffset = offset;

  columnsRoot.style.setProperty("--cols", String(count));
  columnsRoot.innerHTML = "";

  const columns = Array.from({ length: count }, () => []);
  withImages.forEach((entry, index) => {
    const entryKey = `${entry.name}||${entry.year}`.toLowerCase();
    const hasMatchColumn = matchColumnMap && matchColumnMap.has(entryKey);
    const colIndex = hasMatchColumn
      ? matchColumnMap.get(entryKey)
      : (index + offset) % count;
    columns[colIndex].push(entry);
  });
  columnEls = [];
  columns.forEach((items, index) => {
    const column = document.createElement("div");
    column.className = "column";
    column.dataset.index = String(index);

    const track = buildTrack(items);
    column.appendChild(track);
    columnsRoot.appendChild(column);
    columnEls.push(column);

    setupInfiniteScroll(
      column,
      focusKeys && focusKeys.size
        ? () => queueFocusMatches(focusKeys, focusKey, token)
        : null
    );
    setupWheelScroll(column);
  });

  setupLinkedScroll(columnEls);
  if (focusKeys && focusKeys.size) {
    highlightByKeys(focusKeys);
    queueFocusMatches(focusKeys, focusKey, token);
  } else {
    clearHighlight();
  }
}

function queueFocusMatches(focusKeys, focusKey, token) {
  if (!focusKeys || !focusKeys.size) return;
  const primaryKey = focusKey || focusKeys.values().next().value;
  const run = () => {
    if (token !== renderToken) return;
    focusMatchesInColumns(focusKeys, primaryKey, token, 3);
  };
  requestAnimationFrame(run);
  window.setTimeout(run, 200);
  window.setTimeout(run, 800);
}

function getCenteredTargetTop(column, items) {
  if (!items.length) return null;
  const segmentHeight = Number(column.dataset.segmentHeight || 0);
  if (!segmentHeight) {
    const target = items[Math.floor(items.length / 2)];
    const targetCenter = target.offsetTop + target.clientHeight / 2;
    return targetCenter - column.clientHeight / 2;
  }
  const preferredTop = segmentHeight || column.scrollTop;
  const columnCenter = preferredTop + column.clientHeight / 2;
  let bestTargetTop = null;
  let bestDiff = Infinity;

  for (const item of items) {
    const itemCenter = item.offsetTop + item.clientHeight / 2;
    let candidateCenter = itemCenter;
    if (segmentHeight) {
      const shift = Math.round((preferredTop - (itemCenter - column.clientHeight / 2)) / segmentHeight);
      candidateCenter = itemCenter + shift * segmentHeight;
    }
    const candidateTop = candidateCenter - column.clientHeight / 2;
    const diff = Math.abs(candidateCenter - columnCenter);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestTargetTop = candidateTop;
    }
  }

  return bestTargetTop;
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

  const bestTargetTop = getCenteredTargetTop(column, matches);
  if (bestTargetTop === null) return;
  const maxTop = Math.max(0, column.scrollHeight - column.clientHeight);
  const clampedTop = Math.min(Math.max(0, bestTargetTop), maxTop);
  isProgrammaticFocus = true;
  column.scrollTo({ top: clampedTop, behavior: "smooth" });
  window.setTimeout(() => {
    isProgrammaticFocus = false;
  }, 1500);
}

function focusMatchesInColumns(focusKeys, focusKey, token, retriesLeft = 0) {
  if (!focusKeys || !focusKeys.size || !columnEls.length) return;
  const centerIndex = Math.floor(columnEls.length / 2);
  isProgrammaticFocus = true;
  let needsRetry = false;

  columnEls.forEach((column, index) => {
    const items = Array.from(column.querySelectorAll(".column__item"));
    if (!items.length) return;

    const matches = items.filter((item) =>
      focusKeys.has((item.dataset.key || "").toLowerCase())
    );
    if (!matches.length) return;

    matches.forEach((item) => {
      const img = item.querySelector("img");
      if (img && img.loading === "lazy") img.loading = "eager";
    });

    let targetItems = matches;
    if (index === centerIndex && focusKey) {
      const focusMatches = matches.filter(
        (item) => (item.dataset.key || "").toLowerCase() === focusKey
      );
      if (focusMatches.length) targetItems = focusMatches;
    }

    if (!Number(column.dataset.segmentHeight || 0)) {
      needsRetry = true;
    }
    const targetTop = getCenteredTargetTop(column, targetItems);
    if (targetTop === null) return;
    const maxTop = Math.max(0, column.scrollHeight - column.clientHeight);
    const clampedTop = Math.min(Math.max(0, targetTop), maxTop);
    column.scrollTop = clampedTop;
    column.scrollTo({ top: clampedTop, behavior: "auto" });
  });

  if (needsRetry && retriesLeft > 0) {
    window.setTimeout(() => {
      if (token !== renderToken) return;
      focusMatchesInColumns(focusKeys, focusKey, token, retriesLeft - 1);
    }, 250);
  }

  window.setTimeout(() => {
    isProgrammaticFocus = false;
  }, 120);
}

function setupSearch(input) {
  if (!input) return;
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      renderColumns(cachedEntries, 0, null, "", null);
      clearHighlight();
      return;
    }

    function scoreText(text, q) {
      if (!text) return 0;
      const t = text.toLowerCase();
      if (t === q) return 100;
      if (t.startsWith(q)) return 80;
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}`).test(t)) return 70;
      if (t.includes(q)) return 50;
      return 0;
    }

    const withImages = cachedEntries.filter((entry) => getEntryImage(entry));
    const scored = withImages
      .map((entry) => {
        const nameScore = scoreText(entry.name, query);
        const directorScore = scoreText(entry.director || "", query) * 0.8;
        const score = Math.max(nameScore, directorScore);
        return { entry, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return;

    const match = scored[0].entry;
    const matchIndex = withImages.findIndex(
      (entry) => entry.name === match.name && entry.year === match.year
    );
    const count = getColumnCount();
    const centerIndex = Math.floor(count / 2);
    const matchIndices = scored
      .map((item) =>
        withImages.findIndex(
          (entry) =>
            entry.name === item.entry.name && entry.year === item.entry.year
        )
      )
      .filter((index) => index >= 0);
    const offset = pickBestOffset(matchIndices, matchIndex, count, centerIndex);
    const matchKeys = scored.map(
      (item) => `${item.entry.name}||${item.entry.year}`.toLowerCase()
    );
    const focusKeys = new Set(matchKeys);
    const focusKey = `${match.name}||${match.year}`.toLowerCase();
    const matchColumnMap = buildMatchColumnMap(matchKeys, count, centerIndex);
    renderColumns(cachedEntries, offset, focusKeys, focusKey, matchColumnMap);
  });
}

function pickBestOffset(matchIndices, bestIndex, count, centerIndex) {
  if (!matchIndices.length) {
    return (centerIndex - (bestIndex % count) + count) % count;
  }
  const centers =
    count % 2 === 0 ? [Math.max(0, centerIndex - 1), centerIndex] : [centerIndex];
  let bestOffset = 0;
  let bestScore = null;

  for (let offset = 0; offset < count; offset += 1) {
    const cols = matchIndices.map((index) => (index + offset) % count);
    const bestCol = (bestIndex + offset) % count;
    const bestDistToCenter = Math.min(
      ...centers.map((center) => Math.abs(bestCol - center))
    );
    if (bestDistToCenter !== 0) continue;

    const distances = cols.map((col) =>
      Math.min(...centers.map((center) => Math.abs(col - center)))
    );
    const maxDist = Math.max(...distances);
    const sumDist = distances.reduce((sum, dist) => sum + dist, 0);
    const span = Math.max(...cols) - Math.min(...cols);
    const score = [maxDist, sumDist, span];

    if (
      !bestScore ||
      score[0] < bestScore[0] ||
      (score[0] === bestScore[0] &&
        (score[1] < bestScore[1] ||
          (score[1] === bestScore[1] && score[2] < bestScore[2])))
    ) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  if (!bestScore) {
    return (centerIndex - (bestIndex % count) + count) % count;
  }
  return bestOffset;
}

function buildMatchColumnMap(matchKeys, count, centerIndex) {
  if (!matchKeys.length) return null;
  const order = [];
  const used = new Set();
  for (let step = 0; step < count; step += 1) {
    if (step === 0) {
      order.push(centerIndex);
      used.add(centerIndex);
      continue;
    }
    const left = centerIndex - step;
    const right = centerIndex + step;
    if (left >= 0 && !used.has(left)) {
      order.push(left);
      used.add(left);
    }
    if (right < count && !used.has(right)) {
      order.push(right);
      used.add(right);
    }
    if (order.length >= count) break;
  }

  const map = new Map();
  matchKeys.forEach((key, index) => {
    const colIndex = order[index % order.length];
    map.set(key, colIndex);
  });
  return map;
}

let cachedEntries = [];
let columnEls = [];
let columnOffset = 0;
let currentSheet = window.AppData.DEFAULT_SHEET;
let renderToken = 0;
let isProgrammaticFocus = false;

function clearHighlight() {
  columnsRoot.classList.remove("is-dim");
  columnEls.forEach((col) => {
    col.querySelectorAll(".column__item.is-active").forEach((el) => {
      el.classList.remove("is-active");
    });
  });
}

function highlightByKeys(keys) {
  if (!keys || !keys.size) return;
  columnsRoot.classList.add("is-dim");
  columnEls.forEach((col) => {
    col.querySelectorAll(".column__item").forEach((el) => {
      const k = (el.dataset.key || "").toLowerCase();
      if (keys.has(k)) {
        el.classList.add("is-active");
      } else {
        el.classList.remove("is-active");
      }
    });
  });
}

function getEntryLimit() {
  const isSmall = window.matchMedia("(max-width: 768px)").matches;
  return isSmall ? 200 : null;
}

function randomInCenterColumn() {
  if (!columnEls.length) return;
  const centerIndex = Math.floor(columnEls.length / 2);
  const column = columnEls[centerIndex];
  if (!column) return;
  const items = Array.from(column.querySelectorAll(".column__item"));
  if (!items.length) return;
  const target = items[Math.floor(Math.random() * items.length)];
  const focusKey = (target.dataset.key || "").toLowerCase();
  if (!focusKey) return;
  focusInCenter(focusKey);
  window.setTimeout(() => {
    highlightByKeys(new Set([focusKey]));
  }, 800);
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
    renderColumns(cachedEntries);
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

    columnsRoot.innerHTML = `<div class="loading">Loading watchlist for ${id}…</div>`;
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

      renderColumns(cachedEntries);
    } catch (err) {
      columnsRoot.innerHTML = `<div class="loading">Falhou a watchlist de ${id}: ${err.message}</div>`;
    }
  }

  const helpOptions = {
    currentList: currentSheet,
    onToggleView: () => {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("v", "full");
      window.location.search = nextParams.toString();
    },
    onRandom: randomInCenterColumn,
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
    onClose: null,
  };
  const help = window.HelpUI.createHelpUI(helpOptions);
  helpOptions.onClose = () => {
    if (help.input) {
      help.input.value = "";
      help.input.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      renderColumns(cachedEntries, 0, null, "", null);
      clearHighlight();
    }
  };
  window.HelpUI.setListToggle(help.toggle, currentSheet);
  window.HelpUI.setupCommonHotkeys(help, {
    onToggleView: () => {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("v", "full");
      window.location.search = nextParams.toString();
    },
    onRandom: randomInCenterColumn,
    randomKey: null,
  });

  setupSearch(help.input);

  await loadEntries();

  const userFromUrl = params.get("u");
  if (userFromUrl) {
    if (help.idInput) help.idInput.value = userFromUrl;
    await loadIntersectFromId(userFromUrl);
  }
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
  if (event.key === "Escape") {
    clearHighlight();
    return;
  }
  if (event.code !== "Space") return;
  const target = event.target;
  const active = document.activeElement;
  const isTyping =
    (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) ||
    (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable));
  const isInMenu = (el) => el && typeof el.closest === "function" && el.closest(".menu");
  if (isTyping || isInMenu(target) || isInMenu(active)) return;
  event.preventDefault();
  randomInCenterColumn();
});
