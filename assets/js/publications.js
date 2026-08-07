/**
 * Publications page: citation drawer and BibTeX copy.
 *
 * Both entry points are attached to `window` because the markup wires them up
 * through inline onclick handlers in _includes/archive-single-pub.html.
 *
 * Clipboard handling lives in copy-button.js, which loads first.
 */
(function () {
  'use strict';

  /** Show or hide the citation for a publication. */
  function toggleCitation(id, button) {
    var citation = document.getElementById(id);
    if (!citation) return;

    var willShow = citation.hidden;
    citation.hidden = !willShow;
    button.setAttribute('aria-expanded', String(willShow));

    var label = button.querySelector('.citation-button-text');
    if (label) {
      label.textContent = willShow ? 'Hide citation' : 'Citation';
    }
  }

  /** Re-indent a BibTeX entry stored as a single front-matter string. */
  function formatBibtex(text) {
    return text
      .trim()
      .replace(/,\s+(\w+)\s+=\s+/g, ',\n  $1 = ')
      .replace(/}$/m, '\n}');
  }

  /** Copy a publication's BibTeX entry to the clipboard. */
  function copyBibtex(id, button) {
    var source = document.getElementById('bibtex-' + id);
    if (!source) return;

    window.copyToClipboard(formatBibtex(source.textContent), button);
  }

  window.toggleCitation = toggleCitation;
  window.copyBibtex = copyBibtex;
})();
