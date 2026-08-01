/**
 * Live saved-count for the Spotify playlist mentioned on the homepage.
 *
 * Reads assets/data/playlist_saves.json, which a scheduled GitHub Action
 * regenerates and commits (see .github/workflows/update_playlist_saves.yml).
 * The .yml alongside it is the older format, kept as a fallback for the window
 * where the JSON hasn't been written yet.
 *
 * Markup: the spans in _pages/about.md.
 */
(function () {
  'use strict';

  var DATA_JSON = '/assets/data/playlist_saves.json';
  var DATA_YAML = '/assets/data/playlist_saves.yml';

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function formatDelta(n) {
    if (typeof n !== 'number' || isNaN(n)) return '';
    return (n > 0 ? '+' : '') + n;
  }

  function renderFromJson(data) {
    if (!data) return;

    if (typeof data.saves === 'number') setText('playlist-saves', ' ' + data.saves);
    if (data.last_updated) setText('last-updated', data.last_updated);

    var history = Array.isArray(data.history) ? data.history : [];
    if (history.length < 2) return;

    var latest = history[history.length - 1].saves || 0;
    setText('delta-1d', formatDelta(latest - (history[history.length - 2].saves || 0)));
    setText('delta-7d', formatDelta(latest - (history[0].saves || 0)));

    var deltas = document.getElementById('deltas-wrapper');
    if (deltas) deltas.hidden = false;
  }

  function renderFromYaml(text) {
    var lines = text.split('\n');
    if (lines.length < 3) return;

    setText('playlist-saves', ' ' + lines[0].split(':')[1].trim());
    setText('last-updated', lines[2].split(': ')[1].trim().replace(/^'|'$/g, ''));
  }

  function fetchOk(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' returned ' + r.status);
      return r;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('playlist-saves')) return;

    fetchOk(DATA_JSON)
      .then(function (r) { return r.json(); })
      .then(renderFromJson)
      .catch(function () {
        return fetchOk(DATA_YAML)
          .then(function (r) { return r.text(); })
          .then(renderFromYaml);
      })
      .catch(function (error) {
        // Both sources failed. The surrounding sentence still reads without a
        // number, so leave the placeholders empty rather than showing an error.
        console.warn('Playlist saves unavailable:', error.message);
      });
  });
})();
