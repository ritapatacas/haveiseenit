(() => {
  const view = new URLSearchParams(window.location.search).get("v");
  const useColumns = view === "col";

  const feed = document.getElementById("feed");
  const columns = document.getElementById("columns");
  if (useColumns) {
    if (feed) feed.remove();
  } else if (columns) {
    columns.remove();
  }

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = useColumns ? "columnsview.css" : "fullview.css";
  document.head.appendChild(css);

  const script = document.createElement("script");
  script.src = useColumns ? "columnsview.js" : "fullview.js";
  document.body.appendChild(script);
})();
