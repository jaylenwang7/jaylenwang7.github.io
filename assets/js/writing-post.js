/**
 * Writing entry: reading enhancements.
 *
 * Five small things, each of which the page works without:
 *
 *   1. Footnote markers preview their note on hover, focus, or tap. The author
 *      writes `[^1]` and gets both the preview and the numbered note at the
 *      end - one syntax, both behaviours. This reuses the site's `.sidenote`
 *      component wholesale rather than inventing a second kind of popover.
 *   2. Code blocks get a bar naming the language, with a copy button.
 *   3. `toc: true` fills the margin rail from the headings actually present.
 *   4. Figures rise into view as you reach them.
 *   5. The citation block copies itself three ways.
 *
 * Nothing here is required to read the entry. Load order matters for
 * copy-button.js and sidenotes.js, which _includes/scripts.html puts first.
 *
 * Markup: _layouts/writing.html, _includes/writing/*
 * Styles: _sass/_writing-post.scss
 */
(function () {
  'use strict';

  var body = document.querySelector('[data-w-body]');
  if (!body) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /**
   * The sticky masthead's height, so nothing is scrolled to behind it.
   * Measured rather than read from `--masthead-height`, which is the clearance
   * the CSS reserves rather than what the bar currently occupies. sidenotes.js
   * measures it the same way and for the same reason; three lines duplicated
   * is cheaper than either file depending on the other for a number.
   */
  function mastheadHeight() {
    var masthead = document.querySelector('.masthead');
    return masthead ? masthead.offsetHeight : 68;
  }

  /* ------------------------------------------------------------------ *
   * 1. Footnote previews
   * ------------------------------------------------------------------ */

  function buildFootnotePreviews() {
    var markers = body.querySelectorAll('sup[id^="fnref"]');

    Array.prototype.forEach.call(markers, function (marker) {
      var link = marker.querySelector('a');
      if (!link) return;

      var target = document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
      if (!target) return;

      // The note without its back-link: that arrow is for someone who jumped
      // to the bottom of the page, and there is nowhere to go back to from a
      // preview sitting over the sentence it belongs to.
      var copy = target.cloneNode(true);
      Array.prototype.forEach.call(copy.querySelectorAll('.reversefootnote'), function (back) {
        back.remove();
      });

      var note = document.createElement('span');
      note.className = 'sidenote__note';
      note.setAttribute('role', 'tooltip');
      note.id = 'preview-' + marker.id;
      note.textContent = copy.textContent.trim();

      var wrapper = document.createElement('span');
      wrapper.className = 'sidenote';
      marker.parentNode.insertBefore(wrapper, marker);
      wrapper.appendChild(marker);
      wrapper.appendChild(note);

      link.setAttribute('aria-describedby', note.id);
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. Code blocks
   * ------------------------------------------------------------------ */

  var LANGUAGE_NAMES = {
    js: 'JavaScript',
    jsx: 'JavaScript',
    ts: 'TypeScript',
    py: 'Python',
    rb: 'Ruby',
    sh: 'Shell',
    bash: 'Shell',
    zsh: 'Shell',
    yml: 'YAML',
    md: 'Markdown',
    cpp: 'C++',
    plaintext: ''
  };

  function languageOf(block) {
    var match = /(?:^|\s)language-([\w+-]+)/.exec(block.className);
    if (!match) return '';
    var raw = match[1];
    if (Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, raw)) return LANGUAGE_NAMES[raw];
    return raw;
  }

  function decorateCodeBlocks() {
    // `div.`, because kramdown puts the same class on inline `<code>`. Those
    // have no `<code>` inside them and would fall out of the loop below
    // anyway, but a bar and a copy button are not something to leave resting
    // on that.
    var blocks = body.querySelectorAll('div.highlighter-rouge');

    Array.prototype.forEach.call(blocks, function (block) {
      var code = block.querySelector('code');
      if (!code) return;

      var bar = document.createElement('div');
      bar.className = 'post__code-bar';

      var label = document.createElement('span');
      label.className = 'post__code-lang';
      label.textContent = languageOf(block);
      bar.appendChild(label);

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i> Copy';
      button.addEventListener('click', function () {
        window.copyToClipboard(code.textContent, button);
      });
      bar.appendChild(button);

      var wrapper = document.createElement('div');
      wrapper.className = 'post__code';
      block.parentNode.insertBefore(wrapper, block);
      wrapper.appendChild(bar);
      wrapper.appendChild(block);
    });
  }

  /* ------------------------------------------------------------------ *
   * 3. Contents rail
   * ------------------------------------------------------------------ */

  function buildToc() {
    var rail = document.querySelector('[data-w-toc]');
    if (!rail) return;

    var headings = Array.prototype.slice.call(body.querySelectorAll('h2[id]'));

    // A contents list of one item is a label pretending to be navigation.
    if (headings.length < 2) return;

    var title = document.createElement('h2');
    title.className = 'w-toc__title';
    title.textContent = 'Contents';
    rail.appendChild(title);

    var list = document.createElement('ul');
    list.className = 'w-toc__list';

    var links = headings.map(function (heading) {
      var item = document.createElement('li');
      item.className = 'w-toc__item';

      var link = document.createElement('a');
      link.className = 'w-toc__link';
      link.href = '#' + heading.id;
      link.textContent = heading.textContent;

      item.appendChild(link);
      list.appendChild(item);
      return link;
    });

    rail.appendChild(list);
    rail.hidden = false;

    // Scroll position rather than an observer: what "current" means here is
    // simply the last heading you have passed, and that is one comparison.
    var ticking = false;
    var mark = function () {
      var line = mastheadHeight() + 48;
      var current = 0;

      headings.forEach(function (heading, index) {
        if (heading.getBoundingClientRect().top <= line) current = index;
      });

      links.forEach(function (link, index) {
        link.classList.toggle('is-current', index === current);
      });

      ticking = false;
    };

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(mark);
    }, { passive: true });

    mark();
  }

  /* ------------------------------------------------------------------ *
   * 4. Figures
   * ------------------------------------------------------------------ */

  function revealFigures() {
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return;

    var figures = body.querySelectorAll('.w-figure');
    if (!figures.length) return;

    var observer = new IntersectionObserver(function (records) {
      records.forEach(function (record) {
        if (!record.isIntersecting) return;
        record.target.classList.add('is-revealed');
        observer.unobserve(record.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });

    Array.prototype.forEach.call(figures, function (figure) {
      // Set here, not in the template: a figure that starts at opacity 0 must
      // only ever do so when something is guaranteed to bring it back.
      figure.setAttribute('data-w-reveal', '');
      observer.observe(figure);
    });
  }

  /** Looping videos autoplay in the markup; this is the preference honouring it. */
  function honourMotionPreference() {
    if (!reducedMotion.matches) return;

    Array.prototype.forEach.call(body.querySelectorAll('[data-w-loop]'), function (video) {
      video.pause();
      video.removeAttribute('autoplay');
      video.removeAttribute('loop');
      video.setAttribute('controls', '');
    });
  }

  /* ------------------------------------------------------------------ *
   * 5. Citation
   * ------------------------------------------------------------------ */

  function wireCitation() {
    var sources = {
      citation: document.querySelector('[data-w-citation]'),
      bibtex: document.querySelector('[data-w-bibtex]'),
      link: document.querySelector('[data-w-link]')
    };

    Array.prototype.forEach.call(document.querySelectorAll('[data-w-copy]'), function (button) {
      button.addEventListener('click', function () {
        var source = sources[button.dataset.wCopy];
        if (!source) return;
        window.copyToClipboard(source.textContent.trim(), button);
      });
    });
  }

  // Order matters once: the footnote previews are new `.sidenote`s, and
  // sidenotes.js has already placed the ones that were in the markup.
  buildFootnotePreviews();
  if (window.placeSidenotes) window.placeSidenotes();
  decorateCodeBlocks();
  buildToc();
  revealFigures();
  honourMotionPreference();
  wireCitation();
})();
