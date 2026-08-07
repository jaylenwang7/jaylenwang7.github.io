/**
 * Writing index: search, strand and tag filters.
 *
 * Everything is filtered in the DOM. There is no separate JSON index to build,
 * fetch, or keep in step with the page, and every word that can be matched is
 * a word the reader can already see - so a result is always explicable.
 *
 * The three filters live in the URL (?q=, ?strand=, ?tag=), which makes a
 * filtered view a shareable link and gives the back button something sensible
 * to do. A strand filter also swaps the page's description for that strand's
 * own, so choosing "Hoops" reads as arriving at a section rather than as
 * hiding rows.
 *
 * Markup: _includes/writing/index.html · Styles: _sass/_writing-index.scss
 */
(function () {
  'use strict';

  var root = document.querySelector('[data-writing-index]');
  if (!root) return;

  var searchInput = root.querySelector('[data-w-search]');
  var clearButton = root.querySelector('[data-w-clear]');
  var standfirst = root.querySelector('[data-w-standfirst]');
  var countOutput = root.querySelector('[data-w-count]');
  var noResults = root.querySelector('[data-w-noresults]');
  var strandButtons = Array.prototype.slice.call(root.querySelectorAll('[data-w-strand]'));
  var resetButtons = Array.prototype.slice.call(root.querySelectorAll('[data-w-reset]'));
  var years = Array.prototype.slice.call(root.querySelectorAll('[data-w-year]'));
  var entries = Array.prototype.slice.call(root.querySelectorAll('.w-entry'));

  var state = { q: '', strand: '', tag: '' };

  /* ------------------------------------------------------------------ *
   * Matching
   * ------------------------------------------------------------------ */

  /** Every term must appear somewhere, in any order. */
  function matchesQuery(entry, terms) {
    if (!terms.length) return true;
    var haystack = entry.dataset.search || '';
    return terms.every(function (term) {
      return haystack.indexOf(term) !== -1;
    });
  }

  function matchesTag(entry, tag) {
    if (!tag) return true;
    var tags = (entry.dataset.tags || '').split(',');
    return tags.indexOf(tag) !== -1;
  }

  function terms() {
    return state.q.toLowerCase().split(/\s+/).filter(Boolean);
  }

  /* ------------------------------------------------------------------ *
   * Applying
   * ------------------------------------------------------------------ */

  function apply() {
    var termList = terms();
    var visible = 0;

    entries.forEach(function (entry) {
      var show = matchesQuery(entry, termList) &&
                 matchesTag(entry, state.tag) &&
                 (!state.strand || entry.dataset.strand === state.strand);

      entry.hidden = !show;
      if (show) visible += 1;
    });

    // A year with nothing left under it is a heading over a gap.
    years.forEach(function (year) {
      var any = Array.prototype.some.call(
        year.querySelectorAll('.w-entry'),
        function (entry) { return !entry.hidden; }
      );
      year.hidden = !any;
    });

    updateStrandCounts(termList);
    updateStandfirst();
    updateStatus(visible, visible === 0);

    if (noResults) noResults.hidden = visible !== 0;
    if (clearButton) clearButton.hidden = state.q === '';
  }

  /**
   * Counts ignore the strand filter itself, so the chips always answer "how
   * much is there under this heading" rather than collapsing to the one you
   * already picked.
   */
  function updateStrandCounts(termList) {
    var totals = {};
    var all = 0;

    entries.forEach(function (entry) {
      if (!matchesQuery(entry, termList) || !matchesTag(entry, state.tag)) return;
      var id = entry.dataset.strand;
      totals[id] = (totals[id] || 0) + 1;
      all += 1;
    });

    strandButtons.forEach(function (button) {
      var id = button.dataset.wStrand;
      var count = id ? (totals[id] || 0) : all;
      var output = button.querySelector('[data-w-strand-count]');

      if (output) output.textContent = String(count);

      var isActive = id === state.strand;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
      button.classList.toggle('is-empty', count === 0 && !isActive);
    });
  }

  function updateStandfirst() {
    if (!standfirst) return;

    var active = state.strand
      ? strandButtons.filter(function (b) { return b.dataset.wStrand === state.strand; })[0]
      : null;

    if (active) {
      standfirst.textContent = active.dataset.blurb || '';
      root.dataset.strand = state.strand;
      // Read off the chip rather than duplicating the palette here, so the
      // colours stay in _data/writing.yml and _sass/_tokens.scss.
      root.style.setProperty('--strand-color', active.style.getPropertyValue('--strand-color'));
    } else {
      standfirst.textContent = standfirst.dataset.default || '';
      delete root.dataset.strand;
      root.style.removeProperty('--strand-color');
    }
  }

  function updateStatus(visible, blankShowing) {
    if (!countOutput) return;

    var total = entries.length;
    var filtered = state.q !== '' || state.strand !== '' || state.tag !== '';

    if (!filtered) {
      countOutput.textContent = total + (total === 1 ? ' entry' : ' entries');
    } else if (state.tag) {
      countOutput.textContent = visible + ' of ' + total + ' · tagged ' + state.tag;
    } else {
      countOutput.textContent = visible + ' of ' + total;
    }

    resetButtons.forEach(function (button) {
      // The one inside the no-results panel appears and disappears with it.
      if (button.closest('[data-w-noresults]')) return;
      // And stands down while that panel is up, rather than offering the same
      // way out twice on one screen.
      button.hidden = !filtered || blankShowing;
    });
  }

  /* ------------------------------------------------------------------ *
   * URL
   * ------------------------------------------------------------------ */

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    state.q = params.get('q') || '';
    state.strand = params.get('strand') || '';
    state.tag = params.get('tag') || '';
    if (searchInput) searchInput.value = state.q;
  }

  /**
   * `replace` for typing, so a search doesn't bury the previous page under
   * one history entry per keystroke; `push` for a chip or a tag, which is a
   * deliberate move the reader may well want to undo.
   */
  function writeUrl(method) {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.strand) params.set('strand', state.strand);
    if (state.tag) params.set('tag', state.tag);

    var query = params.toString();
    var url = window.location.pathname + (query ? '?' + query : '');
    window.history[method === 'push' ? 'pushState' : 'replaceState'](null, '', url);
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  function setStrand(id) {
    state.strand = state.strand === id ? '' : id;
    writeUrl('push');
    apply();
  }

  function reset() {
    state.q = '';
    state.strand = '';
    state.tag = '';
    if (searchInput) searchInput.value = '';
    writeUrl('push');
    apply();
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      state.q = searchInput.value;
      writeUrl('replace');
      apply();
    });

    searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        searchInput.value = '';
        state.q = '';
        writeUrl('replace');
        apply();
      }
    });
  }

  if (clearButton) {
    clearButton.addEventListener('click', function () {
      searchInput.value = '';
      state.q = '';
      writeUrl('replace');
      apply();
      searchInput.focus();
    });
  }

  strandButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setStrand(button.dataset.wStrand);
    });
  });

  resetButtons.forEach(function (button) {
    button.addEventListener('click', reset);
  });

  // Eyebrows and tags inside entries are real links to a filtered URL, so they
  // survive without scripting and open in a new tab. With scripting they
  // filter where they stand instead of reloading the page.
  root.addEventListener('click', function (event) {
    var strandLink = event.target.closest('[data-w-strand-link]');
    if (strandLink) {
      event.preventDefault();
      state.strand = strandLink.dataset.wStrandLink;
      writeUrl('push');
      apply();
      return;
    }

    var tagLink = event.target.closest('[data-w-tag-link]');
    if (tagLink) {
      event.preventDefault();
      var tag = tagLink.dataset.wTagLink;
      state.tag = state.tag === tag ? '' : tag;
      writeUrl('push');
      apply();
    }
  });

  window.addEventListener('popstate', function () {
    readUrl();
    apply();
  });

  // "/" jumps to the search field, the convention on every archive that has
  // one. Never while the reader is already typing somewhere.
  document.addEventListener('keydown', function (event) {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;

    var active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    if (!searchInput) return;

    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  });

  readUrl();
  apply();
})();
