(() => {
  const MODE_ORDER = ["seen", "watchlist", "shared"];
  const MODE_TITLES = {
    seen: "have i seen it",
    watchlist: "should I watch it",
    shared: "should we watch it",
  };
  const MODE_PLACEHOLDER = {
    seen: "Search movies you've seen",
    watchlist: "Search your watchlist",
    shared: "Search shared watchlist",
  };
  const STORAGE_KEY = "help:shared-username";

  const isTypingTarget = (el) =>
    el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

  const normalizeMode = (value) => {
    if (value === "watchlist") return "watchlist";
    if (value === "shared") return "shared";
    return "seen";
  };

  function buildMenu(options) {
    const menu = document.createElement("div");
    menu.className = "help-menu";
    menu.setAttribute("role", "menu");
    menu.tabIndex = -1;

    // Section: Modes
    const modesSection = document.createElement("div");
    modesSection.className = "help-menu__section help-menu__section--modes";
    const modesLabel = document.createElement("div");
    modesLabel.className = "help-menu__section-label";
    modesLabel.textContent = "have i seen it";
    const modesGroup = document.createElement("div");
    modesGroup.className = "help-menu__modes";
    modesGroup.setAttribute("role", "group");
    const modeButtons = MODE_ORDER.map((mode) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "help-mode-item";
      btn.dataset.mode = mode;
      btn.setAttribute("data-focusable", "true");
      btn.setAttribute("role", "menuitemradio");
      btn.setAttribute("aria-checked", mode === "seen" ? "true" : "false");
      btn.textContent = mode === "watchlist" ? "To watch" : mode === "shared" ? "Together" : "Seen";
      modesGroup.appendChild(btn);
      return btn;
    });
    modesSection.append(modesLabel, modesGroup);

    // Section: Question + Search
    const questionBlock = document.createElement("div");
    questionBlock.className = "help-menu__section help-menu__question";
    const questionTitle = document.createElement("div");
    questionTitle.className = "help-menu__title";
    questionTitle.textContent = MODE_TITLES.seen;
    const searchWrap = document.createElement("div");
    searchWrap.className = "help-menu__search";
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "help-input help-input--search";
    searchInput.placeholder = MODE_PLACEHOLDER.seen;
    searchInput.setAttribute("data-focusable", "true");
    searchInput.setAttribute("aria-label", "Search");
    searchWrap.appendChild(searchInput);
    questionBlock.append(questionTitle, searchWrap);

    // Section: Together-only
    const sharedSection = document.createElement("div");
    sharedSection.className = "help-menu__section help-menu__shared";
    sharedSection.hidden = true;
    const sharedHint = document.createElement("div");
    sharedHint.className = "help-menu__micro";
    sharedHint.textContent = "Find films you both want to watch · watchlist matching";
    const sharedInput = document.createElement("input");
    sharedInput.type = "search";
    sharedInput.className = "help-input help-input--shared";
    sharedInput.placeholder = "Letterboxd username";
    sharedInput.setAttribute("autocomplete", "off");
    sharedInput.setAttribute("spellcheck", "false");
    sharedInput.setAttribute("inputmode", "text");
    sharedInput.setAttribute("data-focusable", "true");
    const sharedStatus = document.createElement("div");
    sharedStatus.className = "help-shared__status";
    sharedSection.append(sharedHint, sharedInput, sharedStatus);

    // Section: Actions
    const actionsSection = document.createElement("div");
    actionsSection.className = "help-menu__section help-menu__actions";
    const randomBtn = document.createElement("button");
    randomBtn.type = "button";
    randomBtn.className = "help-menu__action";
    randomBtn.textContent = "Random";
    randomBtn.setAttribute("data-focusable", "true");
    randomBtn.dataset.action = "random";
    randomBtn.setAttribute("aria-keyshortcuts", "Space");

    const shortcutsToggle = document.createElement("button");
    shortcutsToggle.type = "button";
    shortcutsToggle.className = "help-menu__action";
    shortcutsToggle.textContent = "Shortcuts";
    shortcutsToggle.setAttribute("data-focusable", "true");
    shortcutsToggle.dataset.action = "shortcuts";
    shortcutsToggle.setAttribute("aria-expanded", "false");

    const shortcutsWrap = document.createElement("div");
    shortcutsWrap.className = "help-shortcuts";
    const shortcutsGrid = document.createElement("div");
    shortcutsGrid.className = "help-shortcuts__grid";
    const shortcutItems = [
      ["Space", "random"],
      ["V", "mode"],
      ["H", "shortcuts"],
      ["S", "search"],
    ];
    shortcutItems.forEach(([key, desc]) => {
      const row = document.createElement("div");
      row.className = "help-shortcuts__item";
      const keyEl = document.createElement("span");
      keyEl.className = "help-shortcuts__key";
      keyEl.textContent = key;
      const descEl = document.createElement("span");
      descEl.className = "help-shortcuts__desc";
      descEl.textContent = desc;
      row.append(keyEl, descEl);
      shortcutsGrid.appendChild(row);
    });
    shortcutsWrap.appendChild(shortcutsGrid);

    actionsSection.append(randomBtn, shortcutsToggle, shortcutsWrap);

    menu.append(modesSection, questionBlock, sharedSection, actionsSection);

    return {
      menu,
      modesGroup,
      modeButtons,
      questionTitle,
      searchInput,
      sharedSection,
      sharedInput,
      sharedStatus,
      randomBtn,
      shortcutsToggle,
      shortcutsWrap,
    };
  }

  function createHelpUI(options) {
    const opts = options || {};
    const container = document.createElement("div");
    container.className = "help-bar";

    const makeBtn = (icon, label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "help-bar__btn";
      btn.innerHTML = `<i class="${icon}" aria-hidden="true"></i><span class="sr-only">${label}</span>`;
      btn.setAttribute("aria-label", label);
      return btn;
    };

    const btnSeen = makeBtn("fa-regular fa-eye", "Seen");
    const btnWatch = makeBtn("fa-regular fa-eye-slash", "To watch");
    const btnSearch = makeBtn("fa-solid fa-magnifying-glass", "Search");
    const btnHelp = makeBtn("fa-solid fa-ellipsis-vertical", "Help and shortcuts");
    btnHelp.classList.add("help-bar__btn--help");
    btnSearch.classList.add("help-bar__btn--search");
    const inlineSearch = document.createElement("input");
    inlineSearch.type = "search";
    inlineSearch.className = "help-inline-search";
    inlineSearch.placeholder = "Search";
    inlineSearch.setAttribute("aria-label", "Search");
    btnSearch.appendChild(inlineSearch);
    btnSeen.dataset.mode = "seen";
    btnWatch.dataset.mode = "watchlist";
    [btnSeen, btnWatch].forEach((btn) => btn.setAttribute("aria-pressed", "false"));
    btnHelp.setAttribute("aria-haspopup", "menu");
    btnHelp.setAttribute("aria-expanded", "false");

    const built = buildMenu(opts);
    const {
      menu,
      modesGroup,
      modeButtons,
      questionTitle,
      searchInput,
      sharedSection,
      sharedInput,
      sharedStatus,
      randomBtn,
      shortcutsToggle,
      shortcutsWrap,
    } = built;

    const modeGroup = document.createElement("div");
    modeGroup.className = "mode-buttons";
    modeGroup.append(btnSeen, btnWatch);

    container.append(modeGroup, btnSearch, btnHelp, menu);
    document.body.appendChild(container);

    let isOpen = false;
    let shortcutsOpen = false;
    let activeMode = normalizeMode(opts.currentMode || opts.currentList || "films");
    let lastModeChosen = false;

    const setSharedStatus = (message, state) => {
      sharedStatus.textContent = message || "";
      sharedSection.classList.toggle("is-loading", state === "loading");
      sharedSection.classList.toggle("is-error", state === "error");
    };

    const toggleShortcuts = (force) => {
      shortcutsOpen = typeof force === "boolean" ? force : !shortcutsOpen;
      shortcutsToggle.setAttribute("aria-expanded", shortcutsOpen ? "true" : "false");
      shortcutsWrap.style.maxHeight = shortcutsOpen ? `${shortcutsWrap.scrollHeight}px` : "0px";
      shortcutsWrap.classList.toggle("is-open", shortcutsOpen);
    };

    const focusables = () =>
      Array.from(menu.querySelectorAll("[data-focusable]:not([hidden])")).filter(
        (el) => !el.disabled
      );

    const updateQuestion = (mode) => {
      questionTitle.textContent = MODE_TITLES[mode];
      searchInput.placeholder = MODE_PLACEHOLDER[mode];
    };

    const updateSharedVisibility = (mode) => {
      const isShared = mode === "shared";
      sharedSection.hidden = !isShared;
      menu.classList.toggle("is-shared-mode", isShared);
      if (!isShared) setSharedStatus("", "");
    };

    const applyMode = (mode, notify) => {
      const normalized = normalizeMode(mode);
      activeMode = normalized;
      lastModeChosen = true;
      modeButtons.forEach((btn) => {
        const isActive = btn.dataset.mode === normalized;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-checked", isActive ? "true" : "false");
      });
      [btnSeen, btnWatch].forEach((btn) => {
        const isActive = btn.dataset.mode === normalized;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      menu.dataset.mode = normalized;
      updateQuestion(normalized);
      updateSharedVisibility(normalized);
      if (isOpen) {
        if (normalized === "shared" && (!sharedInput.value || !sharedInput.value.trim())) {
          sharedInput.focus();
        } else {
          searchInput.focus();
        }
      }
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
      const measuredWidth = menu.offsetWidth || 320;
      const measuredHeight = menu.offsetHeight || 240;
      let left = anchorRect.right - measuredWidth;
      let top = anchorRect.bottom + 8;
      const margin = 8;
      if (left < margin) left = margin;
      const maxLeft = window.innerWidth - measuredWidth - margin;
      if (left > maxLeft) left = maxLeft;
      const maxTop = window.innerHeight - measuredHeight - margin;
      if (top > maxTop) top = Math.max(margin, anchorRect.top - measuredHeight - 8);
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
      btnHelp.setAttribute("aria-expanded", "true");
      menu.style.display = "block";
      menu.classList.add("is-open");
      menu.setAttribute("aria-hidden", "false");
      positionMenu();
      document.addEventListener("mousedown", handleDocumentMouseDown, true);
      document.addEventListener("keydown", handleKeyDown, true);
      window.addEventListener("resize", positionMenu);
      window.addEventListener("scroll", positionMenu, true);

      // Focus rule
      if (lastModeChosen) {
        searchInput.focus();
      } else {
        const firstMode = modeButtons[0];
        if (firstMode) firstMode.focus();
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
      const idx = MODE_ORDER.indexOf(activeMode);
      const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
      applyMode(next, true);
    };

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
        searchInput.focus();
        return;
      }

      if ((key === "v" || key === "V") && !isTypingTarget(target)) {
        event.preventDefault();
        cycleMode();
        return;
      }

      if ((key === "h" || key === "H") && !isTypingTarget(target)) {
        event.preventDefault();
        toggleShortcuts();
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
        if (target.dataset.action === "random") {
          event.preventDefault();
          if (opts.onRandom) opts.onRandom();
          return;
        }
        if (target.dataset.action === "shortcuts") {
          event.preventDefault();
          toggleShortcuts();
          return;
        }
      }
    };

    // Wire mode buttons
    modeButtons.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const mode = btn.dataset.mode || "seen";
        applyMode(mode, true);
      });
    });

    // Shared input submit
    const submitShared = async () => {
      const username = String(sharedInput.value || "").trim();
      if (!username) {
        setSharedStatus("Enter a username first.", "error");
        return;
      }
      const valid = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(username);
      if (!valid) {
        setSharedStatus("Invalid username.", "error");
        return;
      }
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, username);
      }
      if (opts.onSharedWatchlistSubmit) {
        try {
          setSharedStatus("Loading…", "loading");
          const result = await opts.onSharedWatchlistSubmit(username);
          if (result && result.ok === false) {
            setSharedStatus(result.error || "Failed to load.", "error");
          } else if (result && Array.isArray(result.items) && result.items.length === 0) {
            setSharedStatus("No shared films found.", "");
          } else {
            setSharedStatus("", "");
          }
        } catch (err) {
          setSharedStatus(err && err.message ? err.message : "Failed to load.", "error");
        }
      } else {
        setSharedStatus("Shared watchlist not connected.", "error");
      }
    };

    sharedInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitShared();
      }
    });

    // Load stored username
    if (window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) sharedInput.value = stored;
    }

    // Random
    randomBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (opts.onRandom) opts.onRandom();
    });

    // Shortcuts toggle
    shortcutsToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleShortcuts();
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
    const collapseInlineSearch = () => {
      searchExpanded = false;
      btnSearch.classList.remove("is-open");
      btnSearch.setAttribute("aria-expanded", "false");
      inlineSearch.blur();
    };

    const expandInlineSearch = () => {
      searchExpanded = true;
      btnSearch.classList.add("is-open");
      btnSearch.setAttribute("aria-expanded", "true");
      inlineSearch.focus();
      inlineSearch.select();
      syncInlineToMenu();
    };

    const syncInlineToMenu = () => {
      if (!searchInput) return;
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

    inlineSearch.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        collapseInlineSearch();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        openMenu();
        syncInlineToMenu();
        if (searchInput) searchInput.focus();
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

    applyMode(activeMode, false);
    updateSharedVisibility(activeMode);

    return {
      button: container,
      panel: menu,
      input: searchInput,
      open: openMenu,
      close: closeMenu,
      toggle: modesGroup,
      modeState: { applyMode },
      isOpen: () => isOpen,
      toggleCondensed: toggleShortcuts,
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
    const menu = toggle.closest(".help-menu");
    if (menu) {
      const title = menu.querySelector(".help-menu__title");
      const search = menu.querySelector(".help-input--search");
      const shared = menu.querySelector(".help-menu__shared");
      if (title) title.textContent = MODE_TITLES[mode];
      if (search) search.placeholder = MODE_PLACEHOLDER[mode];
      if (shared) shared.hidden = mode !== "shared";
    }
    const bar = toggle.closest(".help-bar");
    if (bar) {
      bar.querySelectorAll(".help-bar__btn[data-mode]").forEach((btn) => {
        const active = btn.dataset.mode === mode;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
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
        help.open();
        if (help.input) help.input.focus();
        return;
      }

      if ((key === "v" || key === "V") && !isTypingTarget(target)) {
        event.preventDefault();
        if (help.modeState && typeof help.modeState.applyMode === "function") {
          const current = help.button.querySelector(".help-mode-item.is-active")?.dataset.mode || "seen";
          const next = current === "seen" ? "watchlist" : current === "watchlist" ? "shared" : "seen";
          help.modeState.applyMode(next, true);
          return;
        }
        if (typeof onToggleView === "function") onToggleView();
        return;
      }

      const isSpace = key === " " || key === "Spacebar";
      if (!isTypingTarget(target) && openNow && typeof onRandom === "function" && isSpace) {
        const allowed = !randomKey || randomKey === "Space";
        if (allowed) {
          event.preventDefault();
          onRandom();
        }
      }
    });
  }

  window.HelpUI = { createHelpUI, setupCommonHotkeys, setListToggle };
})();
