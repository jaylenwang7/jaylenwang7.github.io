/*
 * Likes on a writing entry.
 *
 * The API owns the count and whether this browser has liked the entry. A small
 * local set paints the remembered heart state before the read completes, then
 * the response corrects it. The raw browser id is sent only from entry pages:
 * this file is not included on the writing index.
 *
 * Progressive enhancement is strict here. If the initial read fails, nothing
 * is revealed. If localStorage cannot survive a write/read/remove probe, the
 * count is still shown but the button is omitted and no visitor id is minted.
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-w-likes]");
  if (!root || !window.fetch) return;

  var button = root.querySelector("[data-w-like]");
  var icon = root.querySelector("[data-w-like-icon]");
  var label = root.querySelector("[data-w-like-label]");
  var countNode = root.querySelector("[data-w-like-count]");
  var errorNode = root.querySelector("[data-w-like-error]");
  var apiBase = (root.getAttribute("data-api") || "").replace(/\/$/, "");
  var subject = root.getAttribute("data-subject") || "";

  if (!button || !icon || !label || !countNode || !errorNode || !apiBase || !subject) return;

  var VISITOR_KEY = "jw.visitor.v1";
  var LIKED_KEY = "jw.liked.v1";
  var MAX_SAFE_COUNT = 9007199254740991;
  var UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var storageOkay = storageAvailable();
  var visitorId = storageOkay ? readVisitorId() : null;
  var inFlight = false;
  var state = { count: 0, liked: false };

  if (storageOkay && !visitorId) {
    // A remembered heart without the identity that created it cannot be
    // reconciled. Discard it rather than presenting a state the server cannot
    // confirm.
    removeStoredValue(LIKED_KEY);
  }

  if (storageOkay && visitorId) {
    state.liked = readLikedSubjects().indexOf(subject) !== -1;
    renderState();
  }

  button.addEventListener("click", toggleLike);

  readState()
    .then(function (serverState) {
      state = serverState;
      renderState();

      if (storageOkay && visitorId && !rememberLiked(state.liked)) {
        storageOkay = false;
      }

      root.hidden = false;
      button.hidden = !canInteract();
    })
    .catch(function () {
      // An absent control is more honest than a stale count or a button whose
      // result cannot be established.
    });

  function storageAvailable() {
    var probe = "jw.storage.probe." + Date.now();
    try {
      window.localStorage.setItem(probe, probe);
      var persisted = window.localStorage.getItem(probe) === probe;
      window.localStorage.removeItem(probe);
      return persisted;
    } catch (error) {
      return false;
    }
  }

  function readStoredValue(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      storageOkay = false;
      return null;
    }
  }

  function writeStoredValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return window.localStorage.getItem(key) === value;
    } catch (error) {
      storageOkay = false;
      return false;
    }
  }

  function removeStoredValue(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      storageOkay = false;
      return false;
    }
  }

  function readVisitorId() {
    var stored = readStoredValue(VISITOR_KEY);
    if (!stored) return null;
    if (UUID_V4.test(stored)) return stored.toLowerCase();

    removeStoredValue(VISITOR_KEY);
    removeStoredValue(LIKED_KEY);
    return null;
  }

  function readLikedSubjects() {
    var stored = readStoredValue(LIKED_KEY);
    if (!stored) return [];

    try {
      var parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (value, index, values) {
        return typeof value === "string" && values.indexOf(value) === index;
      });
    } catch (error) {
      return [];
    }
  }

  function rememberLiked(liked) {
    var subjects = readLikedSubjects().filter(function (value) {
      return value !== subject;
    });
    if (liked) subjects.push(subject);
    return writeStoredValue(LIKED_KEY, JSON.stringify(subjects));
  }

  function canMintVisitorId() {
    return Boolean(window.crypto &&
      (typeof window.crypto.randomUUID === "function" ||
       typeof window.crypto.getRandomValues === "function"));
  }

  function canInteract() {
    return storageOkay && Boolean(visitorId || canMintVisitorId());
  }

  function mintVisitorId() {
    if (!canMintVisitorId()) return null;

    if (typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID().toLowerCase();
    }

    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = Array.prototype.map.call(bytes, function (byte) {
      return (byte + 0x100).toString(16).slice(1);
    }).join("");

    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" +
      hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }

  function ensureVisitorId() {
    if (visitorId) return visitorId;

    var created = mintVisitorId();
    if (!created || !writeStoredValue(VISITOR_KEY, created)) {
      storageOkay = false;
      button.hidden = true;
      return null;
    }

    visitorId = created;
    return visitorId;
  }

  function request(method, identified) {
    var headers = { "Accept": "application/json" };
    if (identified && visitorId) headers["X-Visitor-Id"] = visitorId;

    return window.fetch(apiBase + "/v1/likes/" + encodeURIComponent(subject), {
      method: method,
      headers: headers,
      credentials: "omit"
    }).then(function (response) {
      if (!response.ok) throw new Error("Like request failed");
      return response.json();
    }).then(validState);
  }

  function validState(envelope) {
    var data = envelope && envelope.ok === true ? envelope.data : null;
    var safeInteger = data && typeof data.count === "number" &&
      isFinite(data.count) && Math.floor(data.count) === data.count &&
      data.count >= 0 && data.count <= MAX_SAFE_COUNT;

    if (!safeInteger || typeof data.liked !== "boolean") {
      throw new Error("Invalid like response");
    }

    return { count: data.count, liked: data.liked };
  }

  function readState() {
    // Never create an identity to read a count. An existing identity is sent
    // so the server can correct the local instant-paint state.
    return request("GET", Boolean(visitorId));
  }

  function renderState() {
    button.setAttribute("aria-pressed", state.liked ? "true" : "false");
    button.classList.toggle("is-liked", state.liked);
    icon.className = (state.liked ? "fas" : "far") + " fa-heart";
    label.textContent = state.liked ? "Liked" : "Like";
    countNode.textContent = state.count + (state.count === 1 ? " like" : " likes");
  }

  function toggleLike() {
    if (inFlight || !canInteract()) return;
    hideError();

    var id = ensureVisitorId();
    if (!id) {
      showError();
      return;
    }

    var previous = { count: state.count, liked: state.liked };
    var nextLiked = !state.liked;
    state = {
      count: Math.max(0, state.count + (nextLiked ? 1 : -1)),
      liked: nextLiked
    };
    renderState();
    animate(nextLiked);

    inFlight = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");

    request(nextLiked ? "PUT" : "DELETE", true)
      .then(function (serverState) {
        state = serverState;
        renderState();
        if (!rememberLiked(state.liked)) {
          storageOkay = false;
          button.hidden = true;
        }
      })
      .catch(function () {
        state = previous;
        renderState();
        showError();
      })
      .then(finishWrite, finishWrite);
  }

  function finishWrite() {
    inFlight = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.classList.remove("is-pulsing");
    countNode.classList.remove("is-ticking");
  }

  function showError() {
    errorNode.hidden = false;
  }

  function hideError() {
    errorNode.hidden = true;
  }

  function animate(liked) {
    if (liked) button.classList.add("is-pulsing");
    countNode.classList.add("is-ticking");
  }
}());
