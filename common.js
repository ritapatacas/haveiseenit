(() => {
  function buildHelpPanel() {
    const panel = document.createElement("span");
    panel.className = "help-button__panel";
    panel.innerHTML =
      "<span><strong>have i seen it?</strong></span>" +
      "<span>search</span>" +
      "<input class=\"help-search\" type=\"search\" placeholder=\"search…\" />" +
      "<span>keys:</span>" +
      "<span>toggle</span>" +
      "<span>random</span>";
    return panel;
  }

  function createHelpUI() {
    const button = document.createElement("div");
    button.className = "help-button";
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", "Help");

    const iconWrap = document.createElement("span");
    iconWrap.className = "help-button__icon";

    const icon = document.createElement("i");
    icon.className = "fa-regular fa-circle-question fa-fade";
    iconWrap.appendChild(icon);

    const panel = buildHelpPanel();

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
    if (input) {
      input.addEventListener("click", (event) => event.stopPropagation());
    }
    panel.addEventListener("click", (event) => event.stopPropagation());

    document.body.appendChild(button);
    return { button, input, open, close: closeMenu };
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
  };
})();
