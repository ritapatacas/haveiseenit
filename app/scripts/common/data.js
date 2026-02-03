(() => {
  const SHEET_ID = "1sP2Tkz00oTiVoACyCznYBOqTaUecUVbUKSQUWVsQDe4";
  const WATCHLIST_SHEET = "watchlist";

  function getCsvUrl(sheetName) {
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  }

  function canonicalFilmUri(url) {
    let u = String(url || "").trim();
    if (!u) return "";

    // Normaliza redireccionamentos comuns que vêm das sheets (http -> https, user prefix, trailing slash)
    u = u.replace(/^http:\/\//i, "https://");
    u = u.replace(/^https:\/\/letterboxd\.com\/[^/]+\/film\//i, "https://letterboxd.com/film/");
    if (u.startsWith("/")) u = `https://letterboxd.com${u}`;

    const m = u.match(/^https:\/\/letterboxd\.com\/film\/([^/?#]+)\/?/i);
    if (m) return `https://letterboxd.com/film/${m[1]}/`;

    return u.endsWith("/") ? u : `${u}/`;
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
        letterboxdUri: cols[3] || "",
        filmUri: cols[4] || "",
        image: cols[5] || "",
        poster: cols[6] || "",
        genre: cols[7] || "",
        director: cols[8] || "",
        rating: cols[9] || "",
        review: cols[10] || "",
      });
    }
    return rows;
  }

  /**
   * Faz fetch da sheet "watchlist" em CSV, faz parse e devolve apenas as entradas
   * cujo filmUri/letterboxdUri existam na lista externa (por ex. scrape recente do Letterboxd).
   *
   * @param {Array<string|object>} externalList - array de filmUri/letterboxdUri ou objetos com essas props
   * @returns {Promise<Array<object>>} linhas com o mesmo formato de parseCsv
   */
  async function fetchSheetWatchlistIntersection(externalList) {
    const filterSet = new Set();
    (externalList || []).forEach((item) => {
      if (!item) return;
      const uri =
        typeof item === "string"
          ? canonicalFilmUri(item)
          : canonicalFilmUri(item.filmUri || item.letterboxdUri);
      if (uri) filterSet.add(uri);
    });
    if (!filterSet.size) return [];

    const csvText = await fetch(getCsvUrl(WATCHLIST_SHEET)).then((res) => res.text());
    const rows = parseCsv(csvText);

    const matched = rows.filter((row) => {
      const uri = canonicalFilmUri(row.filmUri || row.letterboxdUri);
      return uri && filterSet.has(uri);
    });
    if (typeof console !== "undefined" && console.log) {
      console.log("[watchlist] intersection: external URIs=" + filterSet.size + ", sheet rows=" + rows.length + ", matches=" + matched.length);
      console.log("[watchlist] matched URIs:", matched.map((r) => canonicalFilmUri(r.filmUri || r.letterboxdUri)));
    }
    return matched;
  }

  window.AppData = {
    getCsvUrl,
    parseCsv,
    canonicalFilmUri,
    fetchSheetWatchlistIntersection,
    DEFAULT_SHEET: "films",
  };
})();
