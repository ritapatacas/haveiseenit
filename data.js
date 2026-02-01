(() => {
  const SHEET_ID = "1sP2Tkz00oTiVoACyCznYBOqTaUecUVbUKSQUWVsQDe4";

  function getCsvUrl(sheetName) {
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
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

  window.AppData = { getCsvUrl, parseCsv, DEFAULT_SHEET: "films" };
})();
