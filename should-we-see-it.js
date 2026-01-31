(() => {
  const root = document.documentElement;
  const form = document.getElementById("scrape-form");
  const input = document.getElementById("username");
  const statusEl = document.getElementById("status");
  const resultsEl = document.getElementById("results");
  const resultsList = document.getElementById("results-list");
  const resultsMeta = document.getElementById("results-meta");
  const pickBtn = document.getElementById("pick");
  const pickResult = document.getElementById("pick-result");
  const linksWrap = document.getElementById("links");
  const sheetLink = document.getElementById("sheet-link");
  const csvLink = document.getElementById("csv-link");
  const submitBtn = document.getElementById("submit");

  const SCRIPT_WEBAPP_URL = root.dataset.scriptUrl || "";

  function setStatus(message, isError) {
    statusEl.textContent = message || "";
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^@+/, "");
  }

  function jsonpRequest(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `jsonp_cb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Timeout"));
      }, 90000);

      function cleanup() {
        window.clearTimeout(timeout);
        if (script.parentNode) script.parentNode.removeChild(script);
        delete window[callbackName];
      }

      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };

      const sep = url.includes("?") ? "&" : "?";
      script.src = `${url}${sep}callback=${callbackName}`;
      script.onerror = () => {
        cleanup();
        reject(new Error("Network error"));
      };
      document.body.appendChild(script);
    });
  }

  function renderResults(items, count, username) {
    resultsList.innerHTML = "";
    if (!items.length) {
      resultsMeta.textContent = "Sem filmes encontrados.";
      resultsEl.hidden = false;
      return;
    }

    resultsMeta.textContent = `${count} filmes na watchlist de ${username}`;

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.style.setProperty("--delay", `${index * 24}ms`);
      const name = document.createElement("strong");
      name.textContent = item.name || "Untitled";
      const year = document.createElement("span");
      year.textContent = item.year ? item.year : "";
      li.append(name, year);
      resultsList.appendChild(li);
    });

    resultsEl.hidden = false;
  }

  function pickRandom(items) {
    if (!items.length) return;
    const picked = items[Math.floor(Math.random() * items.length)];
    pickResult.textContent = `Hoje: ${picked.name}${picked.year ? ` (${picked.year})` : ""}`;
    pickResult.hidden = false;
  }

  async function scrape(username) {
    if (!SCRIPT_WEBAPP_URL) {
      setStatus("Define o SCRIPT_WEBAPP_URL no atributo data-script-url do HTML.", true);
      return;
    }

    submitBtn.disabled = true;
    setStatus("A raspar a watchlist...", false);
    resultsEl.hidden = true;
    pickResult.hidden = true;
    linksWrap.hidden = true;

    try {
      const url = `${SCRIPT_WEBAPP_URL}?action=scrapeWatchlist&username=${encodeURIComponent(username)}`;
      const data = await jsonpRequest(url);
      if (!data || !data.ok) {
        throw new Error((data && data.error) || "Falha no scraping");
      }

      const items = Array.isArray(data.items) ? data.items : [];
      setStatus(`Feito. Criada a sheet temporaria: ${data.sheetName}`, false);

      if (data.sheetUrl) {
        sheetLink.href = data.sheetUrl;
        sheetLink.hidden = false;
      } else {
        sheetLink.hidden = true;
      }
      if (data.csvUrl) {
        csvLink.href = data.csvUrl;
        csvLink.hidden = false;
      } else {
        csvLink.hidden = true;
      }
      linksWrap.hidden = sheetLink.hidden && csvLink.hidden;

      renderResults(items, data.count || items.length, username);
      pickBtn.onclick = () => pickRandom(items);
    } catch (err) {
      setStatus(err.message || "Erro inesperado", true);
    } finally {
      submitBtn.disabled = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = normalizeUsername(input.value);
    if (!username) {
      setStatus("Escreve um username valido.", true);
      return;
    }
    scrape(username);
  });
})();
