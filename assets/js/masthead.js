/**
 * Gives the sticky masthead a shadow once there is content behind it.
 *
 * The masthead is the same white as the page and separated only by a hairline,
 * which is right while the page is at the top and not enough once content
 * scrolls underneath: titles slide beneath a white bar and read as vanishing
 * rather than as passing behind something.
 *
 * Watches a zero-height sentinel above the masthead rather than listening to
 * scroll, so the browser reports the crossing instead of us recomputing it on
 * every frame. `IntersectionObserver` is checked because the site still runs
 * on the theme's ES5 baseline; without it the masthead simply keeps today's
 * hairline, which is a fine resting state.
 *
 * Markup: _layouts/default.html · Styles: _sass/_masthead.scss
 */
(function () {
  'use strict';

  if (!('IntersectionObserver' in window)) return;

  var masthead = document.querySelector('.masthead');
  var sentinel = document.querySelector('.masthead-sentinel');
  if (!masthead || !sentinel) return;

  new IntersectionObserver(function (entries) {
    /* The sentinel leaving the viewport is precisely the moment the masthead
       stops sitting on the page and starts sitting over it. */
    masthead.classList.toggle('is-pinned', !entries[0].isIntersecting);
  }).observe(sentinel);
})();
