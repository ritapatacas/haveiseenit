const assert = require('assert');

function scoreSearchText(text, query) {
  if (!text) return 0;
  const q = (query || '').trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${escaped}`).test(t)) return 70;
  if (t.includes(q)) return 50;
  return 0;
}

function determineInitialSheet(params) {
  const or = params.get('or');
  const l = params.get('l');
  return or === 'shouldiwatchit' || l === 'w' ? 'watchlist' : 'films';
}

function buildSearchString(params) {
  const isWatchlist = params.get('or') === 'shouldiwatchit' || params.get('l') === 'w';
  if (!isWatchlist) return params.toString();
  const rest = new URLSearchParams(params);
  rest.delete('or');
  rest.delete('l');
  const restStr = rest.toString();
  return restStr ? `or=shouldiwatchit&${restStr}` : 'or=shouldiwatchit';
}

(function testScoreSearchText() {
  assert.equal(scoreSearchText('Alien', 'alien'), 100);
  assert.equal(scoreSearchText('Alien', 'ali'), 80);
  assert.equal(scoreSearchText('The Alien', 'alien'), 70);
  assert.equal(scoreSearchText('Solaris', 'lar'), 50);
  assert.equal(scoreSearchText('Solaris', ''), 0);
})();

(function testInitialSheetDetection() {
  assert.equal(determineInitialSheet(new URLSearchParams('or=shouldiwatchit')), 'watchlist');
  assert.equal(determineInitialSheet(new URLSearchParams('l=w')), 'watchlist');
  assert.equal(determineInitialSheet(new URLSearchParams('')), 'films');
})();

(function testWatchlistQueryOrdering() {
  const qs = buildSearchString(new URLSearchParams('or=shouldiwatchit&foo=1'));
  assert.equal(qs, 'or=shouldiwatchit&foo=1');
  const qs2 = buildSearchString(new URLSearchParams('foo=1&or=shouldiwatchit&bar=2'));
  assert.equal(qs2, 'or=shouldiwatchit&foo=1&bar=2');
  const qs3 = buildSearchString(new URLSearchParams('foo=1'));
  assert.equal(qs3, 'foo=1');
})();

console.log('smoke tests passed');
