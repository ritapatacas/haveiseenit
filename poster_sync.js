const SHEET_ID = "1sP2Tkz00oTiVoACyCznYBOqTaUecUVbUKSQUWVsQDe4";
const SHEET_NAME = "films";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
  SHEET_NAME
)}`;

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_API_KEY = '98944a9305f1ae9731ca3bc4b436fec8';
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const DEFAULT_OUTPUT = "films_with_posters.csv";
const MAX_TMDB_REQUESTS = 50;

const fs = require("node:fs/promises");

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

  if (!rows.length) return { header: [], rows: [] };
  const header = rows.shift();
  return { header, rows };
}

function escapeCsv(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(header, rows) {
  const lines = [];
  lines.push(header.map(escapeCsv).join(","));
  rows.forEach((row) => {
    const normalized = header.map((_, idx) => escapeCsv(row[idx] ?? ""));
    lines.push(normalized.join(","));
  });
  return lines.join("\n");
}

function findHeaderIndex(header, name) {
  const needle = name.toLowerCase();
  return header.findIndex((value) => String(value).trim().toLowerCase() === needle);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB request failed: ${res.status}`);
  }
  return res.json();
}

async function searchMoviePoster(name, year) {
  const query = encodeURIComponent(name);
  const url = `${TMDB_API}/search/movie?api_key=${TMDB_API_KEY}&query=${query}&year=${encodeURIComponent(
    year
  )}&include_adult=false`;
  const data = await fetchJson(url);
  const match = data.results && data.results[0];
  return match && match.poster_path ? match.poster_path : "";
}

async function searchTvPoster(name, year) {
  const query = encodeURIComponent(name);
  const url = `${TMDB_API}/search/tv?api_key=${TMDB_API_KEY}&query=${query}&first_air_date_year=${encodeURIComponent(
    year
  )}&include_adult=false`;
  const data = await fetchJson(url);
  const match = data.results && data.results[0];
  return match && match.poster_path ? match.poster_path : "";
}

async function fetchPosterUrl(name, year) {
  if (!name || !year) return "";
  try {
    const moviePoster = await searchMoviePoster(name, year);
    if (moviePoster) return `${TMDB_IMAGE_BASE}${moviePoster}`;
    const tvPoster = await searchTvPoster(name, year);
    if (tvPoster) return `${TMDB_IMAGE_BASE}${tvPoster}`;
  } catch (err) {
    console.error(`TMDB lookup failed for ${name}: ${err.message}`);
  }
  return "";
}

function parseArgs(argv) {
  const out = {
    input: null,
    output: DEFAULT_OUTPUT,
    limit: null,
    onlyMissing: true,
    refresh: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out" && argv[i + 1]) {
      out.output = argv[i + 1];
      i += 1;
    } else if (arg === "--in" && argv[i + 1]) {
      out.input = argv[i + 1];
      i += 1;
    } else if (arg === "--limit" && argv[i + 1]) {
      const value = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(value) && value > 0) {
        out.limit = value;
      }
      i += 1;
    } else if (arg === "--all") {
      out.onlyMissing = false;
    } else if (arg === "--refresh") {
      out.refresh = true;
    }
  }

  return out;
}

async function readLocalCsv(path) {
  try {
    return await fs.readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function main() {
  if (!TMDB_API_KEY || TMDB_API_KEY === "REPLACE_WITH_TMDB_API_KEY") {
    throw new Error("Set TMDB_API_KEY before running.");
  }

  const args = parseArgs(process.argv);
  let csvText = null;

  if (!args.refresh) {
    const localPath = args.input || args.output;
    csvText = await readLocalCsv(localPath);
  }

  if (!csvText) {
    csvText = await fetch(CSV_URL).then((res) => res.text());
  }

  const { header, rows } = parseCsv(csvText);

  const nameIndex = findHeaderIndex(header, "name");
  const yearIndex = findHeaderIndex(header, "year");
  let posterIndex = findHeaderIndex(header, "poster");

  if (nameIndex < 0 || yearIndex < 0) {
    throw new Error('CSV must include "name" and "year" columns.');
  }

  if (posterIndex < 0) {
    header.push("poster");
    posterIndex = header.length - 1;
  }

  const requestLimit =
    args.limit != null ? Math.min(args.limit, MAX_TMDB_REQUESTS) : MAX_TMDB_REQUESTS;
  let processed = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const name = row[nameIndex];
    const year = row[yearIndex];
    const hasPoster = row[posterIndex] && row[posterIndex].trim();
    if (args.onlyMissing && hasPoster) continue;
    if (processed >= requestLimit) break;

    const posterUrl = await fetchPosterUrl(name, year);
    row[posterIndex] = posterUrl;
    processed += 1;
    console.log(`${name} (${year}) -> ${posterUrl || "no poster"}`);
  }

  const output = toCsv(header, rows);
  await fs.writeFile(args.output, output, "utf8");
  console.log(`Saved ${args.output}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
