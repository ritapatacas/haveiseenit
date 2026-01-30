(() => {
  function buildHelpPanel(options) {
    const panel = document.createElement("span");
    panel.className = "help-button__panel";
    panel.innerHTML =
      "<span><strong>have i seen it?</strong></span>" +
      "<input class=\"help-search\" type=\"search\" placeholder=\"search\" />" +
      "<div class=\"help-section\"><span>shortcuts:</span>" +
      "<span><button type=\"button\" class=\"help-action\" data-action=\"random\">random</button> - press space</span>" +
      "<span><button type=\"button\" class=\"help-action\" data-action=\"toggle\">view</button> - press v</span>" +
      "<span>help - press h</span>" +
      "<span>search - press s</span></div>";

    if (options && typeof options.onToggleList === "function") {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "help-toggle";
      const current = options.currentList || "films";
      toggle.innerHTML =
        `<span class="help-toggle__item ${current === "films" ? "is-active" : ""}">films</span>` +
        `<span class="help-toggle__item ${current === "watchlist" ? "is-active" : ""}">watchlist</span>`;
      const keys = panel.querySelector(".help-section");
      if (keys) {
        keys.before(toggle);
      } else {
        panel.appendChild(toggle);
      }
    }
    return panel;
  }

  function buildMobileSearchPanel(options) {
    const panel = document.createElement("span");
    panel.className = "help-button__panel";
    panel.innerHTML =
      "<span><strong>search</strong></span>" +
      "<input class=\"help-search\" type=\"search\" placeholder=\"search\" />";
    if (options && typeof options.onToggleList === "function") {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "help-toggle";
      const current = options.currentList || "films";
      toggle.innerHTML =
        `<span class="help-toggle__item ${current === "films" ? "is-active" : ""}">films</span>` +
        `<span class="help-toggle__item ${current === "watchlist" ? "is-active" : ""}">watchlist</span>`;
      panel.appendChild(toggle);
    }
    return panel;
  }

  function buildMobileShortcutsPanel() {
    const panel = document.createElement("span");
    panel.className = "help-button__panel";
    panel.innerHTML =
      "<span><strong>shortcuts</strong></span>" +
      "<span>view - press v</span>" +
      "<span>random - press space</span>" +
      "<span>help - press h</span>" +
      "<span>search - press s</span>";
    return panel;
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
    icon.className = "fa-regular fa-circle-question fa-fade";
    iconWrap.appendChild(icon);

    const panel = buildHelpPanel(options);

    const close = document.createElement("button");
    close.className = "help-button__close";
    close.type = "button";
    close.setAttribute("aria-label", "Close help");
    close.textContent = "×";

    button.append(iconWrap, panel, close);

    const open = () => button.classList.add("help-button--open");
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
    const toggle = panel.querySelector(".help-toggle");
    const actions = panel.querySelectorAll(".help-action");
    if (input) {
      input.addEventListener("click", (event) => event.stopPropagation());
    }
    if (toggle && options && typeof options.onToggleList === "function") {
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const current =
          toggle.querySelector(".help-toggle__item.is-active")?.textContent || "films";
        const next = current === "films" ? "watchlist" : "films";
        options.onToggleList(next);
      });
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

    document.body.appendChild(button);
    return { button, input, open, close: closeMenu, toggle, bar: null };
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

    const open = () => wrapper.classList.add("is-open");
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
    const toggle = searchPanel.querySelector(".help-toggle");
    if (input) {
      input.addEventListener("click", (event) => event.stopPropagation());
    }

    if (toggle && options && typeof options.onToggleList === "function") {
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const current =
          toggle.querySelector(".help-toggle__item.is-active")?.textContent || "films";
        const next = current === "films" ? "watchlist" : "films";
        options.onToggleList(next);
      });
    }

    document.body.appendChild(wrapper);
    return { button: wrapper, input, open, close: closeMenu, toggle, bar: null, isOpen };
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
        help.close();
        if (help.input) help.input.blur();
      } else {
        help.open();
        if (help.input) help.input.focus();
      }
        event.preventDefault();
        return;
      }

      if ((key === "s" || key === "S") && !typingTarget) {
        help.open();
        if (help.input) help.input.focus();
        event.preventDefault();
        return;
      }

      if ((key === "v" || key === "V") && !typingTarget && typeof onToggleView === "function") {
        onToggleView();
        return;
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
      const items = toggle.querySelectorAll(".help-toggle__item");
      items.forEach((item) => {
        const isFilms = item.textContent === "films";
        const active = current === (isFilms ? "films" : "watchlist");
        item.classList.toggle("is-active", active);
      });
    },
  };
})();
