/**
 * Keep hover notes on screen.
 *
 * Notes are centred on their marker and open upward, which is right until the
 * marker is near an edge: at the top of a page the note opens behind the
 * masthead, and in the last word of a line on a phone half of it lands past
 * the right of the viewport - which is enough to give the whole page a
 * horizontal scrollbar, whether or not anyone ever points at it. A hidden note
 * is transparent but still occupies layout.
 *
 * Site-wide rather than part of writing-post.js, because `.sidenote` is a
 * site-wide component - the About page has one in the middle of a paragraph,
 * and it was that page, not an entry, that scrolled sideways on a phone.
 *
 * Exposes `window.placeSidenotes()`, which is safe to call again after new
 * notes are added to the page; writing-post.js does exactly that once it has
 * built the footnote previews.
 *
 * Styles: `.sidenote` in _sass/_components.scss
 */
(function () {
  'use strict';

  var EDGE_MARGIN = 8;

  /**
   * The sticky masthead's height, so nothing opens behind it. Measured rather
   * than read from `--masthead-height`, which is the clearance the CSS
   * reserves rather than what the bar currently occupies.
   */
  function mastheadHeight() {
    var masthead = document.querySelector('.masthead');
    return masthead ? masthead.offsetHeight : 68;
  }

  function place(wrapper, note) {
    // Measure unshifted, or each pass would compound the last one's correction.
    note.style.setProperty('--sidenote-shift', '0px');

    var box = note.getBoundingClientRect();
    var marker = wrapper.getBoundingClientRect();

    wrapper.classList.toggle(
      'sidenote--below',
      marker.top - box.height < mastheadHeight() + EDGE_MARGIN
    );

    // `clientWidth`, not `innerWidth`: the latter counts the scrollbar, which
    // left the note a scrollbar's width past the edge of what is actually
    // readable - and therefore still scrolling the page sideways.
    var limit = document.documentElement.clientWidth;
    var shift = 0;

    if (box.left < EDGE_MARGIN) {
      shift = EDGE_MARGIN - box.left;
    } else if (box.right > limit - EDGE_MARGIN) {
      shift = limit - EDGE_MARGIN - box.right;
    }

    note.style.setProperty('--sidenote-shift', Math.round(shift) + 'px');
  }

  var placers = [];

  /** Place every note on the page, binding any it has not seen before. */
  function placeSidenotes() {
    Array.prototype.forEach.call(document.querySelectorAll('.sidenote'), function (wrapper) {
      var note = wrapper.querySelector('.sidenote__note');
      if (!note || wrapper.dataset.sidenoteBound) return;

      var placeThis = function () { place(wrapper, note); };

      // The vertical half of the placement depends on scroll position and has
      // to be redone on the way in; the horizontal half does not.
      wrapper.addEventListener('pointerenter', placeThis);
      wrapper.addEventListener('focusin', placeThis);
      wrapper.dataset.sidenoteBound = 'true';
      placers.push(placeThis);
    });

    placers.forEach(function (placeThis) { placeThis(); });
  }

  var pending;
  window.addEventListener('resize', function () {
    window.clearTimeout(pending);
    pending = window.setTimeout(placeSidenotes, 150);
  });

  window.placeSidenotes = placeSidenotes;
  placeSidenotes();
})();
