/**
 * Helpers for TMDB image URLs (image.tmdb.org).
 * Use small sizes; avoid "original" except for fullscreen detail.
 * Do not force Accept or image/jpeg – let the browser request normally.
 */
(() => {
  const TMDB_BASE = "https://image.tmdb.org";
  const SIZE_PREFIX = "/t/p/";
  const SIZE_REGEX = /\/t\/p\/[^/]+\//;

  function isTmdbImageUrl(url) {
    if (typeof url !== "string" || !url.trim()) return false;
    try {
      const u = url.trim();
      return u.startsWith(TMDB_BASE + "/") || u.startsWith("https://image.tmdb.org/");
    } catch {
      return false;
    }
  }

  /**
   * Replace size segment in path. Known sizes: w92, w154, w185, w342, w500, w780, original.
   * @param {string} url - Full TMDB image URL
   * @param {string} size - e.g. 'w185', 'w342'
   * @returns {string} URL with that size, or original if not TMDB
   */
  function getTmdbUrlForSize(url, size) {
    if (!isTmdbImageUrl(url)) return url;
    return url.replace(SIZE_REGEX, `${SIZE_PREFIX}${size}/`);
  }

  /**
   * Best single URL for context. Avoids "original" except when explicitly requested.
   * @param {string} url - Full TMDB image URL
   * @param {'list'|'backdrop'} context - list = mobile grid/list (w185), backdrop = full view (w780)
   * @returns {string}
   */
  function getTmdbUrlForContext(url, context) {
    if (!isTmdbImageUrl(url)) return url;
    if (context === "backdrop") return getTmdbUrlForSize(url, "w780");
    return getTmdbUrlForSize(url, "w185");
  }

  /** TMDB width (px) -> size label */
  const WIDTH_TO_SIZE = [
    [92, "w92"],
    [154, "w154"],
    [185, "w185"],
    [342, "w342"],
    [500, "w500"],
    [780, "w780"],
  ];
  function widthToSize(w) {
    for (let i = WIDTH_TO_SIZE.length - 1; i >= 0; i--) {
      if (w >= WIDTH_TO_SIZE[i][0]) return WIDTH_TO_SIZE[i][1];
    }
    return "w92";
  }

  /**
   * Build srcset string for responsive img. Widths in pixels, e.g. [154, 342].
   * @param {string} url - Full TMDB image URL
   * @param {number[]} widths - e.g. [154, 342] -> w154, w342
   * @returns {string} "url1 154w, url2 342w" or "" if not TMDB
   */
  function getTmdbSrcset(url, widths) {
    if (!isTmdbImageUrl(url) || !Array.isArray(widths) || widths.length === 0)
      return "";
    const parts = widths.map((w) => {
      const size = widthToSize(w);
      const u = getTmdbUrlForSize(url, size);
      return `${u} ${w}w`;
    });
    return parts.join(", ");
  }

  /**
   * Default sizes attribute for mobile grid/list: small on narrow, medium on wider.
   */
  function getTmdbSizesList() {
    return "(max-width: 600px) 154px, 342px";
  }

  window.AppTmdbImages = {
    isTmdbImageUrl,
    getTmdbUrlForSize,
    getTmdbUrlForContext,
    getTmdbSrcset,
    getTmdbSizesList,
  };
})();
