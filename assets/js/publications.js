/**
 * Publications page: citation drawer and BibTeX copy.
 *
 * Both entry points are attached to `window` because the markup wires them up
 * through inline onclick handlers in _includes/archive-single-pub.html.
 */
(function () {
  'use strict';

  var COPY_FEEDBACK_MS = 2000;

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

  /**
   * Swap the button's contents for a transient message.
   * `state` is appended as `is-<state>` so the styling stays in CSS.
   */
  function flashButton(button, state, icon, message) {
    // Ignore repeat clicks while a message is showing, otherwise the queued
    // timeouts would restore stale markup.
    if (button.dataset.flashing) return;

    var original = button.innerHTML;
    var stateClass = 'is-' + state;

    button.dataset.flashing = 'true';
    button.classList.add(stateClass);
    button.innerHTML = '<i class="fas ' + icon + '" aria-hidden="true"></i> ' + message;

    setTimeout(function () {
      button.innerHTML = original;
      button.classList.remove(stateClass);
      delete button.dataset.flashing;
    }, COPY_FEEDBACK_MS);
  }

  /**
   * Copy via a throwaway textarea. Used both for browsers without the async
   * clipboard API and when that API rejects. Returns whether it worked.
   */
  function copyViaTextArea(text) {
    var textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();

    var copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (e) {
      copied = false;
    }

    textArea.remove();
    return copied;
  }

  function report(button, copied) {
    if (copied) {
      flashButton(button, 'copied', 'fa-check', 'Copied');
    } else {
      flashButton(button, 'failed', 'fa-exclamation-triangle', 'Copy failed');
    }
  }

  /** Copy a publication's BibTeX entry to the clipboard. */
  function copyBibtex(id, button) {
    var source = document.getElementById('bibtex-' + id);
    if (!source) return;

    var text = formatBibtex(source.textContent);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () {
          report(button, true);
        })
        .catch(function () {
          // The async API rejects when the document isn't focused or the
          // permission is refused. Try the older path before giving up -
          // without this the button just sat there saying nothing.
          report(button, copyViaTextArea(text));
        });
      return;
    }

    report(button, copyViaTextArea(text));
  }

  window.toggleCitation = toggleCitation;
  window.copyBibtex = copyBibtex;
})();
