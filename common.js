(() => {
  function buildHelpPanel(options) {
    const panel = document.createElement("span");
    panel.className = "help-button__panel";
    panel.innerHTML =
      "<span><strong>have i seen it?</strong></span>" +
      "<span>search</span>" +
      "<input class=\"help-search\" type=\"search\" placeholder=\"search…\" />" +
      "<span>keys:</span>" +
      "<span>toggle</span>" +
      "<span>random</span>";

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

  function createHelpUI(options) {
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
    const closeMenu = () => button.classList.remove("help-button--open");

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (target.closest(".help-button__close") || target.closest(".help-button__icon")) {
          button.classList.toggle("help-button--open");
        }
      }
    });

    document.addEventListener("click", () => {
      closeMenu();
    });

    const input = panel.querySelector(".help-search");
    const toggle = panel.querySelector(".help-toggle");
    if (input) {
      input.addEventListener("click", (event) => event.stopPropagation());
    }
    panel.addEventListener("click", (event) => event.stopPropagation());
    if (toggle && options && typeof options.onToggleList === "function") {
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const current =
          toggle.querySelector(".help-toggle__item.is-active")?.textContent || "films";
        const next = current === "films" ? "watchlist" : "films";
        options.onToggleList(next);
      });
    }

    document.body.appendChild(button);
    return { button, input, open, close: closeMenu, toggle };
  }

  function setupCommonHotkeys(help, handlers) {
    const { onToggleView, onRandom } = handlers || {};
    if (!help || !help.button) return;

    window.addEventListener("keydown", (event) => {
      const key = event.key;
      const target = event.target;
      const typingTarget =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if ((key === "Escape" || key === "Esc") && help.button.classList.contains("help-button--open")) {
        help.close();
        if (help.input) help.input.blur();
        return;
      }

      if ((key === "h" || key === "H") && !typingTarget) {
        if (help.button.classList.contains("help-button--open")) {
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

      if ((key === "r" || key === "R") && !typingTarget && typeof onRandom === "function") {
        onRandom();
        return;
      }

      if (!typingTarget && help.button.classList.contains("help-button--open") && help.input) {
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
