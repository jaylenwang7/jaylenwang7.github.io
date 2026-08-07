/**
 * Copy to clipboard, and say so on the button that asked.
 *
 * Extracted from publications.js when the writing pages needed the same three
 * things: copy some text, tell the reader it worked, and fall back when the
 * async clipboard API is unavailable or refuses. Two copies of the fallback
 * path would have drifted, and the fallback is the part that is easy to get
 * subtly wrong.
 *
 * Exposes `window.copyToClipboard(text, button)`. Loaded before every consumer
 * in _includes/scripts.html.
 *
 * Styling for the transient states lives on `%chip` in _sass/_components.scss.
 */
(function () {
  'use strict';

  var FEEDBACK_MS = 2000;

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

  /**
   * Swap the button's contents for a transient message.
   * `state` is appended as `is-<state>` so the styling stays in CSS.
   */
  function flashButton(button, state, icon, message) {
    if (!button) return;

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
    }, FEEDBACK_MS);
  }

  function report(button, copied) {
    if (copied) {
      flashButton(button, 'copied', 'fa-check', 'Copied');
    } else {
      flashButton(button, 'failed', 'fa-exclamation-triangle', 'Copy failed');
    }
  }

  /**
   * Copy `text`, then report the outcome on `button`.
   * `button` is optional - without it this is a plain copy.
   */
  function copyToClipboard(text, button) {
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

  window.copyToClipboard = copyToClipboard;
})();
