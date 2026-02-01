(() => {
  const MODE_ORDER = ["seen", "watchlist"];
  const MODE_TITLES = {
    seen: "have i seen it",
    watchlist: "should i watch it"
  };
  const MODE_PLACEHOLDER = {
    seen: "search movies you've seen",
    watchlist: "search your watchlist",
  };
  const STORAGE_KEY = "help:shared-username";

  const isTypingTarget = (el) =>
    el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

  const normalizeMode = (value) => {
    if (value === "watchlist") return "watchlist";
    return "seen";
  };

  function buildMenu() {
    const menu = document.createElement("div");
    menu.className = "help-menu help-menu--m3";
    menu.setAttribute("role", "menu");
    menu.tabIndex = -1;

    const list = document.createElement("div");
    list.className = "help-menu__list";

    const matchItem = document.createElement("button");
    matchItem.type = "button";
    matchItem.className = "help-menu__item";
    matchItem.dataset.mode = "shared";
    matchItem.setAttribute("role", "menuitem");
    matchItem.setAttribute("data-focusable", "true");
    matchItem.setAttribute("aria-expanded", "false");
    matchItem.innerHTML =
      '<span class="help-menu__label">Match watchlist (WIP)</span><span class="help-menu__chevron" aria-hidden="true">▸</span>';

    const matchDetails = document.createElement("div");
    matchDetails.className = "help-menu__details";
    const matchHint = document.createElement("div");
    matchHint.textContent = "should we watch it?";
    const matchInput = document.createElement("input");
    matchInput.type = "search";
    matchInput.name = "lb-usr";
    matchInput.id = "lb-usr";
    matchInput.placeholder = "letterboxd user";
    matchInput.className = "help-inline-field";
    matchInput.setAttribute("autocomplete", "off");
    matchInput.setAttribute("spellcheck", "false");
    matchInput.setAttribute("data-focusable", "true");
    matchDetails.append(matchHint, matchInput);
    matchDetails.hidden = true;

    const divider = document.createElement("div");
    divider.className = "help-menu__divider";

    const shortcutsItem = document.createElement("button");
    shortcutsItem.type = "button";
    shortcutsItem.className = "help-menu__item";
    shortcutsItem.dataset.action = "shortcuts";
    shortcutsItem.setAttribute("role", "menuitem");
    shortcutsItem.setAttribute("data-focusable", "true");
    shortcutsItem.setAttribute("aria-expanded", "true");
    shortcutsItem.innerHTML =
      '<span class="help-menu__label">Shortcuts</span><span class="help-menu__icon" aria-hidden="true">⌘</span>';

    const shortcutsDetails = document.createElement("div");
    shortcutsDetails.className = "help-menu__details";
    const shortcutsList = document.createElement("div");
    shortcutsList.className = "menu__shortcuts-list";
    const shortcutItems = [
      ["space", "random"],
      ["tab", "toggle list"],
      ["v", "toggle view"],
      ["s", "search"],
    ];
    shortcutItems.forEach(([key, desc]) => {
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
    shortcutsDetails.hidden = false;

    list.append(matchItem, matchDetails, divider, shortcutsItem, shortcutsDetails);
    menu.appendChild(list);

    return {
      menu,
      matchItem,
      matchDetails,
      shortcutsItem,
      shortcutsDetails,
    };
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
    const btnSearch = makeBtn("fa-solid fa-magnifying-glass", "Search");
    const btnHelp = makeBtn("fa-solid fa-ellipsis-vertical", "Help and shortcuts");
    btnHelp.classList.add("menu__btn--help");
    btnSearch.classList.add("menu__btn--search");
    const inlineSearch = document.createElement("input");
    inlineSearch.type = "search";
    inlineSearch.className = "help-inline-search";
    inlineSearch.placeholder = MODE_PLACEHOLDER.seen;
    inlineSearch.setAttribute("aria-label", "Search");
    btnSearch.appendChild(inlineSearch);
    btnSeen.dataset.mode = "seen";
    btnWatch.dataset.mode = "watchlist";
    [btnSeen, btnWatch].forEach((btn) => btn.setAttribute("aria-pressed", "false"));
    btnHelp.setAttribute("aria-haspopup", "menu");
    btnHelp.setAttribute("aria-expanded", "false");

    const built = buildMenu(opts);
    const { menu, matchItem, matchDetails, shortcutsItem, shortcutsDetails } = built;
    const modeButtons = [];

    const modeGroup = document.createElement("div");
    modeGroup.className = "mode-buttons";
    modeGroup.append(btnSeen, btnWatch);

    let searchInput = inlineSearch;

    container.append(modeGroup, btnSearch, btnHelp, menu);
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
      modeButtons.forEach((btn) => {
        const isActive = btn.dataset.mode === normalized;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-checked", isActive ? "true" : "false");
        if (btn.classList.contains("help-mode-item--expand")) {
          btn.setAttribute("aria-expanded", isActive ? "true" : "false");
          const chev = btn.querySelector(".help-mode-item__chevron");
          if (chev) chev.textContent = isActive ? "▾" : "▸";
        }
      });
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
        const firstMode = modeButtons[0] || matchItem;
        if (firstMode && firstMode.focus) firstMode.focus();
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
        cycleMode();
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
      }
    };

    // Match watchlist item (expand/collapse)
    const closeAllDetails = () => {
      matchDetails.hidden = true;
      matchItem.setAttribute("aria-expanded", "false");
      const chev = matchItem.querySelector(".help-menu__chevron");
      if (chev) chev.textContent = "▸";
      // shortcuts section stays visible
      shortcutsDetails.hidden = false;
      shortcutsItem.setAttribute("aria-expanded", "true");
    };

    const toggleMatchDetails = () => {
      const willOpen = matchDetails.hidden;
      closeAllDetails();
      matchDetails.hidden = !willOpen ? true : false; // ensure current state respected after closeAll
      if (willOpen) {
        matchDetails.hidden = false;
        matchItem.setAttribute("aria-expanded", "true");
        const chev = matchItem.querySelector(".help-menu__chevron");
        if (chev) chev.textContent = "▾";
      }
    };

    const toggleShortcutsDetails = () => {
      // Keep shortcuts always visible; just ensure focus lands inside.
      shortcutsDetails.hidden = false;
      shortcutsItem.setAttribute("aria-expanded", "true");
      const firstShortcut = shortcutsDetails.querySelector(".help-modal__row");
      if (firstShortcut && firstShortcut.focus) firstShortcut.focus();
    };

    matchItem.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMatchDetails();
    });

    // Shortcuts modal helpers
    shortcutsItem.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleShortcutsDetails();
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

    return {
      button: container,
      panel: menu,
      input: searchInput,
      open: openMenu,
      close: closeMenu,
      toggle: modeGroup,
      modeState: { applyMode, getMode: () => activeMode },
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
    const menu = toggle.closest(".help-menu");
    if (menu) {
      const title = menu.querySelector(".help-menu__title");
      if (title) title.textContent = MODE_TITLES[mode];
    }
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

  window.HelpUI = { createHelpUI, setupCommonHotkeys, setListToggle };
})();
