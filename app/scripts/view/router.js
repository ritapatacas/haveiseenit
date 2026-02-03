(() => {
  const params = new URLSearchParams(window.location.search);
  let inParam = params.get("in");
  const vParam = params.get("v");
  if (!inParam && (vParam === "col" || vParam === "full")) {
    inParam = vParam === "col" ? "slot" : "full";
    params.delete("v");
    params.set("in", inParam);
    const qs = params.toString();
    if (qs) window.history.replaceState({}, "", `?${qs}`);
  }
  const useSlot = inParam === "slot" || (!inParam && vParam === "col");

  const feed = document.getElementById("feed");
  const slot = document.getElementById("slot");
  if (useSlot) {
    if (feed) feed.remove();
  } else if (slot) {
    slot.remove();
  }

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = useSlot ? "app/styles/slotview.css" : "app/styles/fullview.css";
  document.head.appendChild(css);

  const commonCss = document.createElement("link");
  commonCss.rel = "stylesheet";
  commonCss.href = "app/styles/common.css";
  document.head.appendChild(commonCss);

  const fa = document.createElement("link");
  fa.rel = "stylesheet";
  fa.href =
    (window.AppConstants && window.AppConstants.FONT_AWESOME_URL) ||
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css";
  fa.referrerPolicy = "no-referrer";
  document.head.appendChild(fa);

  const commonScript = document.createElement("script");
  commonScript.src = "app/scripts/common/common.js";
  commonScript.onload = () => {
    const dataScript = document.createElement("script");
    dataScript.src = "app/scripts/common/data.js";
    dataScript.onload = () => {
      const script = document.createElement("script");
      script.src = useSlot
        ? "app/scripts/view/slot/slotview.js"
        : "app/scripts/view/full/fullview.js";
      document.body.appendChild(script);
    };
    document.body.appendChild(dataScript);
  };
  document.body.appendChild(commonScript);
})();
