(() => {
  const MODE_PLACEHOLDER = {
    seen: "search movies you've seen",
    watchlist: "search your watchlist",
  };

  const WATCHLIST_API_URL =
    (window.AppConstants && window.AppConstants.WATCHLIST_API_URL) ||
    "https://haveiwatchit.fly.dev/api/watchlist";
  let watchlistInFlight = null;

  const isTypingTarget = (el) =>
    el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

  const normalizeMode = (value) => {
    if (value === "watchlist") return "watchlist";
    return "seen";
  };

  function normalizeId(value) {
    return String(value || "").trim().toLowerCase().replace(/^@+/, "");
  }

  async function fetchExternalUris(username) {
    const id = normalizeId(username);
    if (!id) throw new Error("Username is required");

    if (watchlistInFlight && watchlistInFlight.id === id) {
      return watchlistInFlight.promise;
    }
    const promise = (async () => {
      const res = await fetch(`${WATCHLIST_API_URL}?user=${encodeURIComponent(id)}`, { cache: "no-store" });
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

  function scoreSearchText(text, query) {
    if (!text) return 0;
    const q = (query || "").trim().toLowerCase();
    if (!q) return 0;
    const t = text.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    const escaped = q.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}`).test(t)) return 70;
    if (t.includes(q)) return 50;
    return 0;
  }

  function initView(options = {}) {
    const {
      container,
      getEntryLimit,
      renderEntries,
      toggleViewParam,
      onRandom,
      randomKey = null,
      renderLoading,
      renderError,
      onHelpCreated,
      onHelpClose,
    } = options;

    const params = new URLSearchParams(window.location.search);
    let currentSheet = params.get("or") === "shouldiwatchit" || params.get("l") === "w" ? "watchlist" : "films";
    const userFromUrl = params.get("u") || "";
    const state = { cachedEntries: [], currentSheet };

    const setLoading = (message) => {
      if (!container) return;
      const msg = message || "";
      if (typeof renderLoading === "function") {
        renderLoading(msg);
      } else {
        container.innerHTML = `<div class="loading"><span>${msg}</span></div>`;
      }
    };

    const setError = (message) => {
      if (!container) return;
      const msg = message || "";
      if (typeof renderError === "function") {
        renderError(msg);
      } else {
        setLoading(msg);
      }
    };

    const ensureWatchlistQueryOrder = () => {
      if (state.currentSheet !== "watchlist") return;
      const qs = buildSearchString(new URLSearchParams(window.location.search));
      if (window.location.search.slice(1) !== qs) {
        window.history.replaceState({}, "", `?${qs}`);
      }
    };

    ensureWatchlistQueryOrder();

    let helpRef = null;

    const loadEntries = async () => {
      const csvText = await fetch(window.AppData.getCsvUrl(state.currentSheet)).then((res) => res.text());
      const entries = window.AppData.parseCsv(csvText)
        .filter((row) => row.name && row.year)
        .sort((a, b) => b.date.localeCompare(a.date));
      state.cachedEntries = entries;
      if (typeof renderEntries === "function") renderEntries(entries, { source: "sheet", currentSheet: state.currentSheet });
      return entries;
    };

    const loadIntersectFromId = async (rawId) => {
      const id = normalizeId(rawId);
      if (!id) {
        const nextParams = new URLSearchParams(window.location.search);
        nextParams.delete("u");
        window.history.replaceState({}, "", `?${buildSearchString(nextParams)}`);
        if (helpRef && helpRef.setMatchUserMode) helpRef.setMatchUserMode(false);
        return loadEntries();
      }

      setLoading(`Loading watchlist for ${id}…`);
      try {
        const externalUris = await fetchExternalUris(id);
        if (!externalUris || !externalUris.length) {
          throw new Error("Watchlist scrape returned empty list");
        }
        const rows = await window.AppData.fetchSheetWatchlistIntersection(externalUris);
        const matches = rows
          .filter((row) => row.name && row.year)
          .sort((a, b) => b.date.localeCompare(a.date));
        state.cachedEntries = matches;

        const nextParams = new URLSearchParams(window.location.search);
        nextParams.set("u", id);
        window.history.replaceState({}, "", `?${buildSearchString(nextParams)}`);
        if (helpRef && helpRef.setMatchUserMode) helpRef.setMatchUserMode(true, id);

        if (typeof renderEntries === "function") renderEntries(matches, { source: "match", matchUser: id, currentSheet: state.currentSheet });
      } catch (err) {
        setError(`Falhou a watchlist de ${id}: ${err.message}`);
      }
    };

    const helpOptions = {
      currentList: state.currentSheet,
      matchUserMode: !!userFromUrl,
      matchUserUsername: userFromUrl || "",
      onMatchUserExit: async () => {
        const nextParams = new URLSearchParams(window.location.search);
        nextParams.delete("u");
        window.history.replaceState({}, "", `?${buildSearchString(nextParams)}`);
        if (helpRef && helpRef.setMatchUserMode) helpRef.setMatchUserMode(false);
        await loadEntries();
      },
      onToggleView: () => {
        const nextParams = new URLSearchParams(window.location.search);
        nextParams.set("in", toggleViewParam || "full");
        window.location.search = buildSearchString(nextParams);
      },
      onRandom,
      onToggleList: async (nextList) => {
        state.currentSheet = nextList;
        const nextParams = new URLSearchParams(window.location.search);
        if (state.currentSheet === "watchlist") {
          nextParams.set("or", "shouldiwatchit");
        } else {
          nextParams.delete("or");
          nextParams.delete("l");
        }
        window.history.replaceState({}, "", `?${buildSearchString(nextParams)}`);
        window.HelpUI.setListToggle(helpRef && helpRef.toggle, state.currentSheet);
        await loadEntries();
      },
      onUsersSubmit: loadIntersectFromId,
      onClose: onHelpClose || undefined,
    };

    const help = window.HelpUI.createHelpUI(helpOptions);
    helpRef = help;
    if (help.idInput && userFromUrl) help.idInput.value = userFromUrl;
    window.HelpUI.setListToggle(help.toggle, state.currentSheet);
    window.HelpUI.setupCommonHotkeys(help, {
      onToggleView: helpOptions.onToggleView,
      onRandom,
      randomKey,
    });

    if (typeof onHelpCreated === "function") {
      onHelpCreated(help, { loadEntries, loadIntersectFromId, getState: () => state });
    }

    (async () => {
      await loadEntries();
      if (userFromUrl) await loadIntersectFromId(userFromUrl);
    })();

    return { help, loadEntries, loadIntersectFromId, getState: () => state };
  }

  function buildMenu() {
    const menu = document.createElement("div");
    menu.className = "help-menu help-menu--m3";
    menu.setAttribute("role", "menu");
    menu.tabIndex = -1;

    const list = document.createElement("div");
    list.className = "help-menu__list";

    const tipsItem = document.createElement("button");
    tipsItem.type = "button";
    tipsItem.className = "help-menu__item";
    tipsItem.dataset.action = "tips";
    tipsItem.setAttribute("role", "menuitem");
    tipsItem.setAttribute("data-focusable", "true");
    tipsItem.setAttribute("aria-expanded", "false");
    tipsItem.innerHTML =
      '<span class="help-menu__label">Tips</span><span class="help-menu__icon" aria-hidden="true">💡</span>';

    const tipsDetails = document.createElement("div");
    tipsDetails.className = "help-menu__details";
    const tipsList = document.createElement("div");
    tipsList.className = "help-menu__tips";
    const tipsCopy = (window.AppCopy && Array.isArray(window.AppCopy.tips) && window.AppCopy.tips) || [];
    tipsCopy.forEach((tip) => {
      const p = document.createElement("p");
      p.className = "help-menu__tip";
      p.textContent = tip;
      tipsList.appendChild(p);
    });
    tipsDetails.append(tipsList);

    const shortcutsItem = document.createElement("button");
    shortcutsItem.type = "button";
    shortcutsItem.className = "help-menu__item help-menu__shortcuts";
    shortcutsItem.dataset.action = "shortcuts";
    shortcutsItem.setAttribute("role", "menuitem");
    shortcutsItem.setAttribute("data-focusable", "true");
    shortcutsItem.setAttribute("aria-expanded", "false");
    shortcutsItem.innerHTML =
      '<span class="help-menu__label">Shortcuts</span><span class="help-menu__icon" aria-hidden="true">⌘</span>';

    const shortcutsDetails = document.createElement("div");
    shortcutsDetails.className = "help-menu__details help-menu__shortcuts";
    const shortcutsList = document.createElement("div");
    shortcutsList.className = "menu__shortcuts-list";
    [
      ["space", "random"],
      ["tab", "toggle list"],
      ["v", "toggle view"],
      ["s", "search"],
    ].forEach(([key, desc]) => {
      const row = document.createElement("div");
      row.className = "help-modal__row";
      const keyEl = document.createElement("span");
      keyEl.className = "help-modal__key";
      keyEl.textContent = key;
      const descEl = document.createElement("span");
      descEl.className = "help-modal__desc";
      descEl.textContent = desc;
      row.append(keyEl, descEl);
      shortcutsList.appendChild(row);
    });
    shortcutsDetails.append(shortcutsList);

    tipsDetails.hidden = false;
    tipsItem.setAttribute("aria-expanded", "true");
    shortcutsDetails.hidden = false;
    shortcutsItem.setAttribute("aria-expanded", "true");

    list.append(tipsItem, tipsDetails, shortcutsItem, shortcutsDetails);
    menu.appendChild(list);

    return { menu, tipsItem, tipsDetails, shortcutsItem, shortcutsDetails };
  }

  function createHelpUI(options) {
    const opts = options || {};
    const container = document.createElement("div");
    container.className = "menu";

    const makeBtn = (icon, label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu__btn";
      btn.innerHTML = `<i class="${icon}" aria-hidden="true"></i><span class="sr-only">${label}</span>`;
      btn.setAttribute("aria-label", label);
      return btn;
    };

    const btnSeen = makeBtn("fa-regular fa-eye", "Seen");
    const btnWatch = makeBtn("fa-regular fa-eye-slash", "To watch");
    const btnUsers = makeBtn("fa-solid fa-users", "Letterboxd ID");
    const btnRandom = makeBtn("fa-solid fa-bolt", "Random pick");
    const btnSearch = makeBtn("fa-solid fa-magnifying-glass", "Search");
    const btnHelp = makeBtn("fa-solid fa-ellipsis-vertical", "Help and shortcuts");
    btnHelp.classList.add("menu__btn--help");
    btnSearch.classList.add("menu__btn--search");
    btnUsers.classList.add("menu__btn--id");
    btnRandom.classList.add("menu__btn--random");
    const inlineSearch = document.createElement("input");
    inlineSearch.type = "search";
    inlineSearch.className = "help-inline-search";
    inlineSearch.placeholder = MODE_PLACEHOLDER.seen;
    inlineSearch.setAttribute("aria-label", "Search");
    btnSearch.appendChild(inlineSearch);
    const inlineId = document.createElement("input");
    inlineId.type = "search";
    inlineId.className = "help-inline-id";
    inlineId.placeholder = "letterboxd id";
    inlineId.setAttribute("aria-label", "Letterboxd ID");
    btnUsers.appendChild(inlineId);

    const matchUserWrap = document.createElement("span");
    matchUserWrap.className = "menu__match-user-wrap";
    matchUserWrap.hidden = true;
    const matchUserName = document.createElement("span");
    matchUserName.className = "menu__match-user-name";
    const matchUserClose = document.createElement("button");
    matchUserClose.type = "button";
    matchUserClose.className = "menu__match-user-close";
    matchUserClose.setAttribute("aria-label", "Exit match user");
    matchUserClose.innerHTML = "<i class=\"fa-solid fa-xmark\" aria-hidden=\"true\"></i>";
    matchUserWrap.append(matchUserName, matchUserClose);
    btnUsers.appendChild(matchUserWrap);
    btnSeen.dataset.mode = "seen";
    btnWatch.dataset.mode = "watchlist";
    [btnSeen, btnWatch].forEach((btn) => btn.setAttribute("aria-pressed", "false"));
    btnHelp.setAttribute("aria-haspopup", "menu");
    btnHelp.setAttribute("aria-expanded", "false");

    const built = buildMenu();
    const { menu, tipsItem, tipsDetails, shortcutsItem, shortcutsDetails } = built;

    const modeGroup = document.createElement("div");
    modeGroup.className = "mode-buttons";
    modeGroup.append(btnSeen, btnWatch);

    let searchInput = inlineSearch;

    container.append(modeGroup, btnUsers, btnRandom, btnSearch, btnHelp, menu);
    document.body.appendChild(container);

    let isOpen = false;
    let activeMode = normalizeMode(opts.currentMode || opts.currentList || "films");
    let lastModeChosen = false;

    const focusables = () =>
      Array.from(menu.querySelectorAll("[data-focusable]:not([hidden])")).filter(
        (el) => !el.disabled
      );

    const updateQuestion = (mode) => {
      if (searchInput) searchInput.placeholder = MODE_PLACEHOLDER[mode];
    };

    const applyMode = (mode, notify) => {
      const normalized = normalizeMode(mode);
      activeMode = normalized;
      lastModeChosen = true;
      [btnSeen, btnWatch].forEach((btn) => {
        const isActive = btn.dataset.mode === normalized;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      menu.dataset.mode = normalized;
      updateQuestion(normalized);
      if (isOpen && searchInput) searchInput.focus();
      if (!notify) return;
      if (opts.onModeChange) opts.onModeChange(normalized);
      if (opts.onToggleList) {
        if (normalized === "seen") opts.onToggleList("films");
        if (normalized === "watchlist") opts.onToggleList("watchlist");
      }
      if (modeGroup) {
        modeGroup.dataset.mode = normalized;
        modeGroup.style.setProperty("--mode-index", normalized === "watchlist" ? "1" : "0");
      }
    };

    const positionMenu = () => {
      const anchorRect = btnHelp.getBoundingClientRect();
      // Force measurement in case layout not ready
      const measuredWidth = menu.offsetWidth || 250;
      const measuredHeight = menu.offsetHeight || 240;
      // Align right edge with buttons (they sit at right:16px); small vertical gap
      const gapY = 6;
      let left = anchorRect.right - measuredWidth;
      let top = anchorRect.bottom + gapY;
      const margin = 8;
      if (left < margin) left = margin;
      const maxLeft = window.innerWidth - measuredWidth - margin;
      if (left > maxLeft) left = maxLeft;
      const maxTop = window.innerHeight - measuredHeight - margin;
      if (top > maxTop) top = Math.max(margin, anchorRect.top - measuredHeight - gapY);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    };

    const closeMenu = () => {
      if (!isOpen) return;
      isOpen = false;
      btnHelp.setAttribute("aria-expanded", "false");
      menu.style.display = "none";
      menu.classList.remove("is-open");
      menu.setAttribute("aria-hidden", "true");
      tipsDetails.hidden = true;
      tipsItem.setAttribute("aria-expanded", "false");
      shortcutsDetails.hidden = true;
      shortcutsItem.setAttribute("aria-expanded", "false");
      collapseInlineSearch();
      collapseInlineId();
      document.removeEventListener("mousedown", handleDocumentMouseDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      if (opts.onClose) opts.onClose();
      btnHelp.focus();
    };

    const openMenu = () => {
      if (isOpen) return;
      isOpen = true;
      // Reset inline inputs to avoid auto-focus/keyboard pop-up on mobile
      collapseInlineSearch();
      collapseInlineId();

      btnHelp.setAttribute("aria-expanded", "true");
      menu.style.display = "block";
      menu.classList.add("is-open");
      menu.setAttribute("aria-hidden", "false");
      // Default: show tips and shortcuts when opening
      tipsDetails.hidden = false;
      tipsItem.setAttribute("aria-expanded", "true");
      shortcutsDetails.hidden = false;
      shortcutsItem.setAttribute("aria-expanded", "true");
      positionMenu();
      document.addEventListener("mousedown", handleDocumentMouseDown, true);
      document.addEventListener("keydown", handleKeyDown, true);
      window.addEventListener("resize", positionMenu);
      window.addEventListener("scroll", positionMenu, true);

      // Avoid focusing inputs on open (prevents mobile keyboard); focus a menu item instead
      if (shortcutsItem && shortcutsItem.focus) {
        shortcutsItem.focus();
      }
    };

    const toggleMenu = () => {
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    };

    const handleDocumentMouseDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (container.contains(target)) return;
      closeMenu();
    };

    const cycleMode = () => {
      const next = activeMode === "seen" ? "watchlist" : "seen";
      applyMode(next, true);
    };

    const toggleDetails = (detailsEl, trigger) => {
      const willOpen = detailsEl.hidden;
      detailsEl.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
      if (willOpen) {
        const firstRow = detailsEl.querySelector(".help-modal__row");
        if (firstRow && firstRow.focus) firstRow.focus();
      }
    };

    const toggleShortcutsDetails = () => toggleDetails(shortcutsDetails, shortcutsItem);
    const toggleTipsDetails = () => toggleDetails(tipsDetails, tipsItem);

    const handleKeyDown = (event) => {
      const key = event.key;
      const target = event.target;

      if (key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      // Hotkeys only when menu is open
      if (!isOpen) return;

      if ((key === "s" || key === "S") && !isTypingTarget(target)) {
        event.preventDefault();
        openInlineSearch();
        return;
      }

      if (key === "Tab" && !isTypingTarget(target)) {
        event.preventDefault();
        if (container.dataset.mode !== "match_user") cycleMode();
        return;
      }

      if ((key === "v" || key === "V") && !isTypingTarget(target)) {
        event.preventDefault();
        if (typeof opts.onToggleView === "function") opts.onToggleView();
        return;
      }

      if ((key === "h" || key === "H") && !isTypingTarget(target)) {
        event.preventDefault();
        toggleShortcutsDetails();
        return;
      }

      if (key === " " || key === "Spacebar") {
        const shouldRandom =
          !isTypingTarget(target) &&
          typeof opts.onRandom === "function" &&
          (!opts.randomKey || opts.randomKey === "Space");
        if (shouldRandom) {
          event.preventDefault();
          opts.onRandom();
          return;
        }
      }

      const focusList = focusables();
      const currentIndex = focusList.indexOf(target);
      if (key === "ArrowDown") {
        event.preventDefault();
        const next = focusList[(currentIndex + 1) % focusList.length] || focusList[0];
        if (next && next.focus) next.focus();
        return;
      }
      if (key === "ArrowUp") {
        event.preventDefault();
        const prev =
          focusList[(currentIndex - 1 + focusList.length) % focusList.length] || focusList[0];
        if (prev && prev.focus) prev.focus();
        return;
      }
      if (key === "Enter" && target instanceof HTMLElement) {
        if (target.dataset.action === "shortcuts") {
          event.preventDefault();
          toggleShortcutsDetails();
          return;
        }
        if (target.dataset.action === "tips") {
          event.preventDefault();
          toggleTipsDetails();
          return;
        }
      }
    };
    shortcutsItem.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleShortcutsDetails();
    });
    tipsItem.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTipsDetails();
    });

    // Prevent menu closing when clicking inside
    menu.addEventListener("mousedown", (event) => event.stopPropagation());
    menu.addEventListener("click", (event) => event.stopPropagation());

    // Toolbar buttons
    [btnSeen, btnWatch].forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const mode = btn.dataset.mode || "seen";
        applyMode(mode, true);
      });
    });

    let searchExpanded = false;
    // Will be assigned after ID input setup; placeholder to allow mutual collapse.
    let collapseInlineId = () => {};
    const collapseInlineSearch = () => {
      searchExpanded = false;
      btnSearch.classList.remove("is-open");
      btnSearch.setAttribute("aria-expanded", "false");
      inlineSearch.blur();
    };

    const expandInlineSearch = () => {
      collapseInlineId();
      searchExpanded = true;
      btnSearch.classList.add("is-open");
      btnSearch.setAttribute("aria-expanded", "true");
      inlineSearch.focus();
      inlineSearch.select();
      syncInlineToMenu();
    };
    const openInlineSearch = () => {
      expandInlineSearch();
    };

    const syncInlineToMenu = () => {
      if (!searchInput) return;
      // If both refs point to the same element (current setup), dispatching a new
      // "input" event would recurse forever. Only proxy when they differ.
      if (searchInput === inlineSearch) return;
      searchInput.value = inlineSearch.value || "";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    };

    btnHelp.addEventListener("click", (event) => {
      event.preventDefault();
      toggleMenu();
    });

    btnSearch.addEventListener("click", (event) => {
      if (event.target === inlineSearch) return;
      event.preventDefault();
      if (searchExpanded) {
        collapseInlineSearch();
      } else {
        expandInlineSearch();
      }
    });

    btnRandom.addEventListener("click", (event) => {
      event.preventDefault();
      if (typeof opts.onRandom === "function") opts.onRandom();
    });

    inlineSearch.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        collapseInlineSearch();
        return;
      }
      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        const start = inlineSearch.selectionStart ?? inlineSearch.value.length;
        const end = inlineSearch.selectionEnd ?? start;
        const val = inlineSearch.value;
        inlineSearch.value = val.slice(0, start) + " " + val.slice(end);
        inlineSearch.setSelectionRange(start + 1, start + 1);
        syncInlineToMenu();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
      }
    });

    inlineSearch.addEventListener("input", () => {
      syncInlineToMenu();
    });

    inlineSearch.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (!btnSearch.contains(document.activeElement)) {
          collapseInlineSearch();
        }
      }, 120);
    });

    // Inline Letterboxd ID
    let idExpanded = false;
    collapseInlineId = () => {
      idExpanded = false;
      btnUsers.classList.remove("is-open");
      btnUsers.setAttribute("aria-expanded", "false");
      inlineId.blur();
    };

    const expandInlineId = () => {
      collapseInlineSearch();
      idExpanded = true;
      btnUsers.classList.add("is-open");
      btnUsers.setAttribute("aria-expanded", "true");
      inlineId.focus();
      inlineId.select();
    };

    btnUsers.addEventListener("click", (event) => {
      if (event.target === inlineId || event.target === matchUserClose || matchUserClose.contains(event.target)) return;
      if (container.dataset.mode === "match_user") return;
      event.preventDefault();
      if (idExpanded) {
        collapseInlineId();
      } else {
        expandInlineId();
      }
    });

    matchUserClose.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof opts.onMatchUserExit === "function") opts.onMatchUserExit();
    });

    inlineId.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        collapseInlineId();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const username = (inlineId.value || "").trim();
        if (opts.onUsersSubmit && typeof opts.onUsersSubmit === "function") {
          opts.onUsersSubmit(username);
        }
        collapseInlineId();
      }
    });

    inlineId.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (!btnUsers.contains(document.activeElement)) {
          collapseInlineId();
        }
      }, 120);
    });

    applyMode(activeMode, false);

    const setMatchUserMode = (active, username) => {
      if (active && username) {
        container.dataset.mode = "match_user";
        modeGroup.hidden = true;
        inlineId.hidden = true;
        matchUserName.textContent = username;
        matchUserWrap.hidden = false;
        btnUsers.classList.remove("is-open");
        idExpanded = false;
      } else {
        delete container.dataset.mode;
        modeGroup.hidden = false;
        inlineId.hidden = false;
        matchUserWrap.hidden = true;
      }
    };

    if (opts.matchUserMode && opts.matchUserUsername) setMatchUserMode(true, opts.matchUserUsername);

    return {
      button: container,
      panel: menu,
      input: searchInput,
      idInput: inlineId,
      open: openMenu,
      close: closeMenu,
      toggle: modeGroup,
      modeState: { applyMode, getMode: () => activeMode },
      setMatchUserMode,
      isOpen: () => isOpen,
      toggleCondensed: toggleShortcutsDetails,
      openSearch: openInlineSearch,
    };
  }

  function setListToggle(toggle, current) {
    if (!toggle) return;
    const mode = normalizeMode(current === "films" ? "seen" : current);
    const items = toggle.querySelectorAll("[data-mode]");
    items.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-checked", isActive ? "true" : "false");
    });
    const bar = toggle.closest(".menu");
    if (bar) {
      bar.querySelectorAll(".menu__btn[data-mode]").forEach((btn) => {
        const active = btn.dataset.mode === mode;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const inline = bar.querySelector(".help-inline-search");
      if (inline) inline.placeholder = MODE_PLACEHOLDER[mode];
    }
  }

  function setupCommonHotkeys(help, handlers) {
    const { onToggleView, onRandom, randomKey } = handlers || {};
    if (!help || !help.button) return;

    window.addEventListener("keydown", (event) => {
      const key = event.key;
      const target = event.target;
      const openNow = help.isOpen ? help.isOpen() : false;

      if (key === "Escape" && openNow) {
        event.preventDefault();
        help.close();
        return;
      }

      if ((key === "h" || key === "H") && openNow && !isTypingTarget(target)) {
        event.preventDefault();
        if (help.toggleCondensed) help.toggleCondensed();
        return;
      }

      if ((key === "s" || key === "S" || key === "/") && !isTypingTarget(target)) {
        event.preventDefault();
        if (help.openSearch) {
          help.openSearch();
          return;
        }
        if (help.input) {
          help.input.focus();
          return;
        }
      }

      if (key === "Tab" && !isTypingTarget(target)) {
        event.preventDefault();
        if (help.button?.dataset?.mode === "match_user") return;
        if (help.modeState && typeof help.modeState.applyMode === "function") {
          const current =
            (help.modeState.getMode && help.modeState.getMode()) ||
            help.panel?.dataset.mode ||
            "seen";
          const next = current === "watchlist" ? "seen" : "watchlist";
          help.modeState.applyMode(next, true);
          return;
        }
        return;
      }

      if ((key === "v" || key === "V") && !isTypingTarget(target)) {
        event.preventDefault();
        if (typeof onToggleView === "function") onToggleView();
        return;
      }

      const isSpace = key === " " || key === "Spacebar";
      if (!isTypingTarget(target) && typeof onRandom === "function" && isSpace) {
        const allowed = !randomKey || randomKey === "Space";
        if (allowed) {
          event.preventDefault();
          onRandom();
        }
      }
    });
  }

  /**
   * Builds query string for location.search. In watchlist mode (or=shouldiwatchit) puts it first and omits l.
   * @param {URLSearchParams} params
   * @returns {string}
   */
  function buildSearchString(params) {
    const isWatchlist = params.get("or") === "shouldiwatchit" || params.get("l") === "w";
    if (!isWatchlist) return params.toString();
    const rest = new URLSearchParams(params);
    rest.delete("or");
    rest.delete("l");
    const restStr = rest.toString();
    return restStr ? `or=shouldiwatchit&${restStr}` : "or=shouldiwatchit";
  }

  window.HelpUI = { createHelpUI, setupCommonHotkeys, setListToggle, buildSearchString };
  window.AppCommon = { normalizeId, fetchExternalUris, scoreSearchText, initView };
})();
