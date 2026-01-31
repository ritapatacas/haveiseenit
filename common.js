(() => {
  function buildHelpPanel(options) {
    const panel = document.createElement("span");
    panel.className = "help-button__panel";
    panel.innerHTML =
      "<span class=\"help-title help-title--row\">have I seen it?</span>" +
      "<div class=\"help-body\">" +
      "<div class=\"help-modes\" role=\"tablist\" aria-label=\"Search mode\">" +
      "<button type=\"button\" class=\"help-mode\" data-mode=\"seen\">seen</button>" +
      "<button type=\"button\" class=\"help-mode\" data-mode=\"watchlist\">to watch</button>" +
      "<button type=\"button\" class=\"help-mode\" data-mode=\"shared\">together</button>" +
      "</div>" +
      "<input class=\"help-search\" type=\"search\" />" +
      "<div class=\"help-shared\">" +
      "<span class=\"help-shared__hint\">Find films you both want to watch · watchlist matching</span>" +
      "<form class=\"help-shared__form\" autocomplete=\"off\" data-lpignore=\"true\" data-1p-ignore=\"true\">" +
      "<input class=\"help-shared__input\" type=\"search\" name=\"lb-user\" autocomplete=\"off\" autocapitalize=\"none\" autocorrect=\"off\" spellcheck=\"false\" inputmode=\"text\" data-lpignore=\"true\" data-1p-ignore=\"true\" data-bwignore=\"true\" data-kwignore=\"true\" data-form-type=\"other\" />" +
      "</form>" +
      "<span class=\"help-shared__status\" aria-live=\"polite\"></span>" +
      "</div>" +
      "<div class=\"help-section\"><span class=\"help-section__title\">shortcuts</span>" +
      "<span><strong>Space</strong> — random</span>" +
      "<span><strong>V</strong> — mode</span>" +
      "<span><strong>H</strong> — shortcuts</span>" +
      "<span><strong>S</strong> — search</span></div>" +
      "</div>";
    return panel;
  }

  function buildMobileSearchPanel(options) {
    const panel = document.createElement("span");
    panel.className = "help-button__panel";
    panel.innerHTML =
      "<span class=\"help-title help-title--row\">have I seen it?</span>" +
      "<div class=\"help-body\">" +
      "<div class=\"help-modes\" role=\"tablist\" aria-label=\"Search mode\">" +
      "<button type=\"button\" class=\"help-mode\" data-mode=\"seen\">seen</button>" +
      "<button type=\"button\" class=\"help-mode\" data-mode=\"watchlist\">to watch</button>" +
      "<button type=\"button\" class=\"help-mode\" data-mode=\"shared\">together</button>" +
      "</div>" +
      "<input class=\"help-search\" type=\"search\" />" +
      "<div class=\"help-shared\">" +
      "<span class=\"help-shared__hint\">Find films you both want to watch · watchlist matching</span>" +
      "<form class=\"help-shared__form\" autocomplete=\"off\" data-lpignore=\"true\" data-1p-ignore=\"true\">" +
      "<input class=\"help-shared__input\" type=\"search\" name=\"lb-user\" placeholder=\"Enter Letterboxd username\" autocomplete=\"off\" autocapitalize=\"none\" autocorrect=\"off\" spellcheck=\"false\" inputmode=\"text\" data-lpignore=\"true\" data-1p-ignore=\"true\" data-bwignore=\"true\" data-kwignore=\"true\" data-form-type=\"other\" />" +
      "</form>" +
      "<span class=\"help-shared__status\" aria-live=\"polite\"></span>" +
      "</div>" +
      "<div class=\"help-section\"><span class=\"help-section__title\">shortcuts</span>" +
      "<span><strong>Space</strong> — random</span>" +
      "<span><strong>V</strong> — mode</span>" +
      "<span><strong>H</strong> — shortcuts</span>" +
      "<span><strong>S</strong> — search</span></div>" +
      "</div>";
    return panel;
  }

  function buildMobileShortcutsPanel() {
    const panel = document.createElement("span");
    panel.className = "help-button__panel";
    panel.innerHTML =
      "<span><strong>shortcuts</strong></span>" +
      "<span><strong>Space</strong> — random</span>" +
      "<span><strong>V</strong> — mode</span>" +
      "<span><strong>H</strong> — shortcuts</span>" +
      "<span><strong>S</strong> — search</span>";
    return panel;
  }

  function normalizeMode(value) {
    if (value === "watchlist") return "watchlist";
    if (value === "shared") return "shared";
    return "seen";
  }

  function modeTitle(mode) {
    if (mode === "watchlist") return "should I watch it?";
    if (mode === "shared") return "should we watch it?";
    return "have I seen it?";
  }

  function modePlaceholder(mode) {
    if (mode === "watchlist") return "Search your watchlist";
    if (mode === "shared") return "Search shared watchlist";
    return "Search movies you've seen";
  }

  function updateSearchPlaceholder(panel, mode) {
    const input = panel.querySelector(".help-search");
    if (!input) return;
    input.placeholder = modePlaceholder(mode);
    input.classList.add("is-placeholder-fade");
    window.setTimeout(() => input.classList.remove("is-placeholder-fade"), 120);
  }

  function updateModeTitle(panel, mode) {
    const title = panel.querySelector(".help-title");
    if (!title) return;
    title.textContent = modeTitle(mode);
  }

  function updateSharedVisibility(panel, mode) {
    const shared = panel.querySelector(".help-shared");
    if (!shared) return;
    const isShared = mode === "shared";
    panel.classList.toggle("is-shared-mode", isShared);
    if (!isShared) setSharedStatus(panel, "", "");
  }

  function isPanelOpen(panel) {
    const desktop = panel.closest(".help-button");
    if (desktop && !desktop.classList.contains("help-button--open")) return false;
    const mobile = panel.closest(".mobile-help");
    if (mobile && !mobile.classList.contains("is-open")) return false;
    return true;
  }

  function focusSearch(panel) {
    const input = panel.querySelector(".help-search");
    if (input) input.focus();
  }

  function focusShared(panel) {
    const sharedInput = panel.querySelector(".help-shared__input");
    if (sharedInput) sharedInput.focus();
  }

  function setSharedStatus(panel, message, state) {
    const status = panel.querySelector(".help-shared__status");
    const shared = panel.querySelector(".help-shared");
    if (!status || !shared) return;
    status.textContent = message || "";
    shared.classList.toggle("is-error", state === "error");
    shared.classList.toggle("is-loading", state === "loading");
  }

  function setupSharedWatchlist(panel, options) {
    const input = panel.querySelector(".help-shared__input");
    if (!input) return null;
    const form = panel.querySelector(".help-shared__form");
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
      });
    }
    const storageKey = "help:shared-username";
    const stored = window.localStorage ? window.localStorage.getItem(storageKey) : "";
    if (stored) input.value = stored;

    const isValid = (value) => /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value);

    const submit = async () => {
      const username = String(input.value || "").trim();
      if (!username) {
        setSharedStatus(panel, "Enter a username first.", "error");
        return;
      }
      if (!isValid(username)) {
        setSharedStatus(panel, "Invalid username.", "error");
        return;
      }

      if (window.localStorage) {
        window.localStorage.setItem(storageKey, username);
      }

      setSharedStatus(panel, "Loading…", "loading");

      if (options && typeof options.onSharedWatchlistSubmit === "function") {
        try {
          const result = await options.onSharedWatchlistSubmit(username);
          if (result && result.ok === false) {
            setSharedStatus(panel, result.error || "Failed to load.", "error");
          } else if (result && Array.isArray(result.items) && result.items.length === 0) {
            setSharedStatus(panel, "No shared films found.", "");
          } else {
            setSharedStatus(panel, "", "");
          }
        } catch (err) {
          setSharedStatus(panel, err && err.message ? err.message : "Failed to load.", "error");
        }
        return;
      }

      setSharedStatus(panel, "Shared watchlist not connected.", "error");
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });

    return { submit, input };
  }

  function setupHelpModes(panel, options) {
    const modes = Array.from(panel.querySelectorAll(".help-mode"));
    const currentList = options && options.currentList ? options.currentList : "films";
    const initialMode = normalizeMode(options && options.currentMode ? options.currentMode : currentList);

    const applyMode = (mode, notify) => {
      const normalized = normalizeMode(mode);
      modes.forEach((btn) => {
        const isActive = btn.getAttribute("data-mode") === normalized;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      panel.dataset.mode = normalized;
      updateModeTitle(panel, normalized);
      updateSearchPlaceholder(panel, normalized);
      updateSharedVisibility(panel, normalized);
      if (isPanelOpen(panel)) {
        const sharedInput = panel.querySelector(".help-shared__input");
        if (normalized === "shared" && sharedInput && !sharedInput.value.trim()) {
          focusShared(panel);
        } else {
          focusSearch(panel);
        }
      }
      if (!notify) return;
      if (options && typeof options.onModeChange === "function") {
        options.onModeChange(normalized);
      }
      if (options && typeof options.onToggleList === "function") {
        if (normalized === "seen") options.onToggleList("films");
        if (normalized === "watchlist") options.onToggleList("watchlist");
      }
    };

    modes.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const mode = btn.getAttribute("data-mode") || "seen";
        applyMode(mode, true);
      });
    });

    applyMode(initialMode, false);
    return { applyMode };
  }

  function createHelpUI(options) {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      return createMobileHelpUI(options);
    }

    const button = document.createElement("div");
    button.className = "help-button";
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", "Help");

    const iconWrap = document.createElement("span");
    iconWrap.className = "help-button__icon";

    const icon = document.createElement("i");
    icon.className = "fa-regular fa-question fa-fade";
    iconWrap.appendChild(icon);

    const panel = buildHelpPanel(options);

    const close = document.createElement("button");
    close.className = "help-button__close";
    close.type = "button";
    close.setAttribute("aria-label", "Close help");
    close.textContent = "×";

    panel.prepend(iconWrap);
    button.append(panel, close);

    const open = () => {
      button.classList.add("help-button--open");
      const mode = panel.dataset.mode || "seen";
      if (mode === "shared") {
        const sharedInput = panel.querySelector(".help-shared__input");
        if (sharedInput && !sharedInput.value.trim()) {
          sharedInput.focus();
          return;
        }
      }
      if (input) input.focus();
    };
    const closeMenu = () => {
      if (!button.classList.contains("help-button--open")) return;
      button.classList.remove("help-button--open");
      if (options && typeof options.onClose === "function") {
        options.onClose();
      }
    };

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (target.closest(".help-button__close") || target.closest(".help-button__icon")) {
          if (button.classList.contains("help-button--open")) {
            closeMenu();
          } else {
            open();
          }
        }
      }
    });

    document.addEventListener("click", () => {
      closeMenu();
    });

    const input = panel.querySelector(".help-search");
    const toggle = panel.querySelector(".help-modes");
    const actions = panel.querySelectorAll(".help-action");
    setupSharedWatchlist(panel, options);
    const modeState = setupHelpModes(panel, options);
    if (input) {
      input.addEventListener("click", (event) => event.stopPropagation());
    }
    actions.forEach((action) => {
      action.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!options) return;
        const type = action.getAttribute("data-action");
        if (type === "toggle" && typeof options.onToggleView === "function") {
          options.onToggleView();
        }
        if (type === "random" && typeof options.onRandom === "function") {
          options.onRandom();
        }
      });
    });
    if (toggle && modeState) {
      toggle.addEventListener("click", (event) => event.stopPropagation());
    }

    let condensed = false;
    const toggleCondensed = () => {
      condensed = !condensed;
      panel.classList.toggle("is-condensed", condensed);
    };

    document.body.appendChild(button);
    return {
      button,
      panel,
      input,
      open,
      close: closeMenu,
      toggle,
      bar: null,
      toggleCondensed,
      modeState,
    };
  }

  function createMobileHelpUI(options) {
    const wrapper = document.createElement("div");
    wrapper.className = "mobile-help";

    const trigger = document.createElement("button");
    trigger.className = "mobile-help-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-label", "Menu");
    trigger.textContent = "...";

    const menu = document.createElement("div");
    menu.className = "mobile-help-menu";

    const randomBtn = document.createElement("button");
    randomBtn.type = "button";
    randomBtn.className = "mobile-help-menu__btn mobile-help-menu__btn--random";
    randomBtn.setAttribute("aria-label", "Random");
    randomBtn.innerHTML = '<i class="fa-solid fa-bolt-lightning"></i>';

    const searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.className = "mobile-help-menu__btn mobile-help-menu__btn--search";
    searchBtn.setAttribute("aria-label", "Search");
    searchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';

    const helpBtn = document.createElement("button");
    helpBtn.type = "button";
    helpBtn.className = "mobile-help-menu__btn mobile-help-menu__btn--help";
    helpBtn.setAttribute("aria-label", "Help");
    helpBtn.innerHTML = '<i class="fa-solid fa-circle-question"></i>';

    menu.append(randomBtn, searchBtn, helpBtn);

    const searchPanel = buildMobileSearchPanel(options);
    searchPanel.classList.add("mobile-help-search");

    wrapper.append(trigger, menu, searchPanel);

    const open = () => {
      wrapper.classList.add("is-open");
      const mode = searchPanel.dataset.mode || "seen";
      if (mode === "shared") {
        const sharedInput = searchPanel.querySelector(".help-shared__input");
        if (sharedInput && !sharedInput.value.trim()) {
          sharedInput.focus();
          return;
        }
      }
      if (input) input.focus();
    };
    const closeMenu = () => wrapper.classList.remove("is-open");
    const isOpen = () => wrapper.classList.contains("is-open");

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (isOpen()) {
        closeMenu();
      } else {
        open();
      }
    });

    randomBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (options && typeof options.onRandom === "function") options.onRandom();
    });

    searchBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      open();
      searchPanel.classList.add("is-open");
      const input = searchPanel.querySelector(".help-search");
      if (input) input.focus();
    });

    helpBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      open();
      searchPanel.classList.remove("is-open");
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && wrapper.contains(target)) return;
      closeMenu();
      searchPanel.classList.remove("is-open");
    });

    const input = searchPanel.querySelector(".help-search");
    const toggle = searchPanel.querySelector(".help-modes");
    setupSharedWatchlist(searchPanel, options);
    const modeState = setupHelpModes(searchPanel, options);
    if (input) {
      input.addEventListener("click", (event) => event.stopPropagation());
    }

    if (toggle && modeState) {
      toggle.addEventListener("click", (event) => event.stopPropagation());
    }

    let condensed = false;
    const toggleCondensed = () => {
      condensed = !condensed;
      searchPanel.classList.toggle("is-condensed", condensed);
    };

    document.body.appendChild(wrapper);
    return {
      button: wrapper,
      panel: searchPanel,
      input,
      open,
      close: closeMenu,
      toggle,
      bar: null,
      isOpen,
      toggleCondensed,
      modeState,
    };
  }

  function createMobileBar() {
    return null;
  }

  function setupCommonHotkeys(help, handlers) {
    const { onToggleView, onRandom, randomKey } = handlers || {};
    if (!help || !help.button) return;

    window.addEventListener("keydown", (event) => {
      const key = event.key;
      const target = event.target;
      const typingTarget =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

    const openNow = help.isOpen
      ? help.isOpen()
      : help.button.classList.contains("help-button--open") ||
        help.button.classList.contains("is-open");
    if ((key === "Escape" || key === "Esc") && openNow) {
      help.close();
      if (help.input) help.input.blur();
      return;
    }

    if ((key === "h" || key === "H") && !typingTarget) {
      if (openNow) {
        if (typeof help.toggleCondensed === "function") {
          help.toggleCondensed();
        }
      } else {
        help.open();
      }
      event.preventDefault();
      return;
    }

      if ((key === "s" || key === "S" || key === "/") && !typingTarget) {
        help.open();
        if (help.input) help.input.focus();
        event.preventDefault();
        return;
      }

      if ((key === "v" || key === "V") && !typingTarget) {
        if (help.modeState && typeof help.modeState.applyMode === "function") {
          const current = help.button.querySelector(".help-mode.is-active")?.getAttribute("data-mode") || "seen";
          const next = current === "seen" ? "watchlist" : current === "watchlist" ? "shared" : "seen";
          help.modeState.applyMode(next, true);
          event.preventDefault();
          return;
        }
        if (typeof onToggleView === "function") {
          onToggleView();
          return;
        }
      }

      if (!typingTarget && typeof onRandom === "function" && randomKey) {
        const isSpace = randomKey === "Space" && event.code === "Space";
        const isChar =
          typeof randomKey === "string" &&
          randomKey.length === 1 &&
          (key === randomKey || key === randomKey.toUpperCase());
        if (isSpace || isChar) {
          onRandom();
          event.preventDefault();
          return;
        }
      }

    if (!typingTarget && openNow && help.input) {
      if (key.length === 1) {
        help.input.focus();
        help.input.value += key;
          help.input.dispatchEvent(new Event("input", { bubbles: true }));
          event.preventDefault();
        }
      }
    });
  }

  window.HelpUI = {
    createHelpUI,
    setupCommonHotkeys,
    setListToggle(toggle, current) {
      if (!toggle) return;
      const mode = normalizeMode(current === "films" || current === "watchlist" ? current : current);
      const items = toggle.querySelectorAll(".help-mode");
      items.forEach((item) => {
        const active = item.getAttribute("data-mode") === mode;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
      const panel = toggle.closest(".help-button__panel");
      if (panel) {
        updateModeTitle(panel, mode);
        updateSearchPlaceholder(panel, mode);
        updateSharedVisibility(panel, mode);
      }
    },
  };
})();
