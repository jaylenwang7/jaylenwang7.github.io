/**
 * News timeline: category filtering, search, and collapse/expand.
 *
 * All display logic funnels through a single `render()` driven by three pieces
 * of state, so there is one place to reason about what is visible and why.
 *
 * Markup: _includes/news.html · Styles: _sass/_news.scss
 */
(function () {
  'use strict';

  var SEARCH_DEBOUNCE_MS = 150;

  function initNewsTimeline() {
    var root = document.querySelector('.news');
    if (!root) return;

    var searchInput = root.querySelector('#newsSearch');
    var filters = Array.prototype.slice.call(root.querySelectorAll('.news__filter'));
    var items = Array.prototype.slice.call(root.querySelectorAll('.news__item'));
    var yearMarkers = Array.prototype.slice.call(root.querySelectorAll('.news__year'));
    var emptyState = root.querySelector('.news__empty');
    var toggle = root.querySelector('.news__toggle');
    var collapsedCount = parseInt(root.dataset.collapsedCount, 10) || 8;

    var activeCategory = 'all';
    var searchTerm = '';
    var expanded = false;

    // Searchable text is fixed for the life of the page - index it once
    // instead of re-reading the DOM on every keystroke.
    var searchIndex = new Map();
    items.forEach(function (item) {
      var headline = item.querySelector('.news__headline');
      var body = item.querySelector('.news__body');
      searchIndex.set(item, [
        headline ? headline.textContent : '',
        body ? body.textContent : '',
        item.dataset.category || ''
      ].join(' ').toLowerCase());
    });

    function matches(item) {
      var categoryOk = activeCategory === 'all' || item.dataset.category === activeCategory;
      var searchOk = !searchTerm || searchIndex.get(item).indexOf(searchTerm) !== -1;
      return categoryOk && searchOk;
    }

    function render() {
      // While filtering, showing a partial list would hide matches the reader
      // explicitly asked for, so the collapse limit only applies at rest.
      var isFiltering = activeCategory !== 'all' || searchTerm !== '';
      var showAll = expanded || isFiltering;
      var matchCount = 0;
      var shown = 0;

      items.forEach(function (item) {
        var isMatch = matches(item);
        if (isMatch) matchCount += 1;

        var visible = isMatch && (showAll || shown < collapsedCount);
        item.hidden = !visible;
        if (visible) shown += 1;
      });

      // A year marker only earns its place while it still heads visible items.
      yearMarkers.forEach(function (marker) {
        marker.hidden = !items.some(function (item) {
          return !item.hidden && item.dataset.year === marker.dataset.year;
        });
      });

      emptyState.hidden = matchCount > 0;

      var canCollapse = !isFiltering && matchCount > collapsedCount;
      toggle.hidden = !canCollapse;
      toggle.textContent = expanded
        ? 'Show fewer updates'
        : 'Show all ' + matchCount + ' updates';
      toggle.setAttribute('aria-expanded', String(expanded));
    }

    function setFilterCounts() {
      var counts = items.reduce(function (acc, item) {
        var category = item.dataset.category;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      filters.forEach(function (filter) {
        var countEl = filter.querySelector('.news__filter-count');
        if (!countEl) return;
        var category = filter.dataset.category;
        countEl.textContent = category === 'all'
          ? items.length
          : (counts[category] || 0);
      });
    }

    filters.forEach(function (filter) {
      filter.addEventListener('click', function () {
        filters.forEach(function (f) { f.classList.remove('is-active'); });
        filter.classList.add('is-active');
        activeCategory = filter.dataset.category;
        expanded = false;
        render();
      });
    });

    if (searchInput) {
      var searchTimeout;
      searchInput.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function () {
          searchTerm = searchInput.value.trim().toLowerCase();
          expanded = false;
          render();
        }, SEARCH_DEBOUNCE_MS);
      });
    }

    toggle.addEventListener('click', function () {
      expanded = !expanded;
      render();
    });

    setFilterCounts();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewsTimeline);
  } else {
    initNewsTimeline();
  }
})();
