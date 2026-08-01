/**
 * Survey results page.
 *
 * Adding a question is a one-line change: append an entry to CHART_SPECS and
 * point it at a renderer. The renderers, the palette, and the Chart.js theme
 * are shared, so every chart on the page stays visually consistent.
 *
 * Colours come from the CSS custom properties defined in _sass/_tokens.scss -
 * this file deliberately hardcodes none, so the site palette stays the single
 * source of truth.
 *
 * Note: the access code below is obfuscation, not security. Everything it
 * gates is public JSON; it only stops casual spoiling of the survey.
 */
(function () {
  'use strict';

  var ACCESS_CODE = 'SHOWME';
  var DATA_URL = '/data/survey-stats.json';
  var EGG_BIN_SIZE = 10;
  var FRUITS_PER_PAGE = 10;

  /* ---------------------------------------------------------------------
     Theme - read once from the site's design tokens
     --------------------------------------------------------------------- */

  function token(name, fallback) {
    var value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  }

  var theme = {
    ink: token('--color-ink', '#16201b'),
    sage: token('--color-sage', '#62796d'),
    rule: token('--color-rule', '#dde5e0'),
    ground: token('--color-ground', '#ffffff'),
    primary: token('--color-moss', '#2e6b4f'),
    fontBody: token('--font-body', 'sans-serif'),
    fontMono: token('--font-mono', 'monospace'),
    // Fixed assignment order - see the note in _tokens.scss. Never cycled.
    series: [1, 2, 3, 4, 5, 6].map(function (n) {
      return token('--series-' + n, '#2e7d52');
    })
  };

  /**
   * Single-series magnitude charts use one hue: the category is already named
   * on the axis, so colouring each bar differently would encode nothing.
   * The categorical ramp is reserved for charts where colour carries identity.
   */
  function seriesColors(count) {
    var colors = [];
    for (var i = 0; i < count; i += 1) {
      colors.push(theme.series[i % theme.series.length]);
    }
    return colors;
  }

  function applyChartTheme() {
    Chart.defaults.font.family = theme.fontBody;
    Chart.defaults.font.size = 12;
    Chart.defaults.color = theme.sage;
    Chart.defaults.borderColor = theme.rule;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.backgroundColor = theme.ink;
    Chart.defaults.plugins.tooltip.titleFont = { family: theme.fontBody, weight: '600' };
    Chart.defaults.plugins.tooltip.bodyFont = { family: theme.fontMono };
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.displayColors = false;
  }

  /** Axis config shared by every bar chart, so grids and ticks match. */
  function valueAxis(label) {
    return {
      beginAtZero: true,
      title: { display: Boolean(label), text: label, color: theme.sage },
      ticks: { precision: 0, color: theme.sage },
      grid: { color: theme.rule, drawTicks: false },
      border: { display: false }
    };
  }

  function categoryAxis() {
    return {
      ticks: { color: theme.ink, autoSkip: false },
      grid: { display: false },
      border: { color: theme.rule }
    };
  }

  /* ---------------------------------------------------------------------
     Small helpers
     --------------------------------------------------------------------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** Sort a { label: count } map into [label, count] pairs, highest first. */
  function rankEntries(data) {
    return Object.keys(data)
      .map(function (key) { return [key, data[key]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
  }

  function sumValues(data) {
    return Object.keys(data).reduce(function (total, key) {
      return total + data[key];
    }, 0);
  }

  /**
   * The question exactly as it was asked on the form, revealed on hover or
   * focus. The card titles are shortened for the grid, and some of the
   * original wording carries the joke that the title has to drop.
   *
   * Reuses the `.sidenote` component from _sass/_components.scss rather than
   * introducing a second tooltip: it already solves keyboard and touch access
   * with a real <button> and `aria-describedby`.
   */
  function buildQuestionNote(spec) {
    var wrap = el('span', 'sidenote');
    var id = 'question-' + spec.key;

    var marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'sidenote__marker sidenote__marker--icon';
    marker.setAttribute('aria-describedby', id);
    marker.setAttribute('aria-label', 'Show the original question from the form');

    var icon = document.createElement('i');
    icon.className = 'fas fa-info-circle';
    icon.setAttribute('aria-hidden', 'true');
    marker.appendChild(icon);

    var note = el('span', 'sidenote__note', spec.question);
    note.id = id;
    note.setAttribute('role', 'tooltip');

    wrap.appendChild(marker);
    wrap.appendChild(note);
    return wrap;
  }

  /** Build a card shell and return the body element renderers draw into. */
  function createCard(spec) {
    var card = el('section', 'survey-card');

    var title = el('h2', 'survey-card__title');
    title.appendChild(el('span', 'survey-card__emoji', spec.emoji));
    title.appendChild(document.createTextNode(spec.title));
    if (spec.question) {
      title.appendChild(buildQuestionNote(spec));
    }
    card.appendChild(title);

    if (spec.note) {
      card.appendChild(el('p', 'survey-card__note', spec.note));
    }

    var body = el('div', 'survey-card__body');
    card.appendChild(body);

    document.getElementById('stats-container').appendChild(card);
    return body;
  }

  function createCanvas(parent) {
    var frame = el('div', 'survey-card__chart');
    var canvas = document.createElement('canvas');
    frame.appendChild(canvas);
    parent.appendChild(frame);
    return canvas;
  }

  /* ---------------------------------------------------------------------
     Renderers
     --------------------------------------------------------------------- */

  /** Horizontal bar chart, ranked by value. Paginates when `perPage` is set. */
  function renderRankedBar(spec, data) {
    var body = createCard(spec);
    var entries = rankEntries(data);
    var maxValue = Math.max.apply(null, entries.map(function (e) { return e[1]; }));
    var perPage = spec.perPage || entries.length;
    var pageCount = Math.ceil(entries.length / perPage);
    var page = 0;
    var chart = null;
    var pager = null;

    if (pageCount > 1) {
      pager = buildPager(body, function (next) {
        page = next;
        draw();
      });
    }

    var canvas = createCanvas(body);

    function draw() {
      var start = page * perPage;
      var slice = entries.slice(start, start + perPage);

      if (pager) {
        pager.update(page, pageCount, start + 1, start + slice.length, entries.length);
      }
      if (chart) chart.destroy();

      chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: slice.map(function (e) { return e[0]; }),
          datasets: [{
            label: spec.axis || 'Votes',
            data: slice.map(function (e) { return e[1]; }),
            backgroundColor: theme.primary,
            borderRadius: 3,
            borderSkipped: false,
            barThickness: 'flex',
            maxBarThickness: 22
          }]
        },
        options: {
          indexAxis: 'y',
          // A fixed max keeps bar lengths comparable across pages.
          scales: { x: valueAxis(spec.axis), y: categoryAxis() },
          plugins: { tooltip: { callbacks: { label: countLabel } } }
        }
      });
      chart.options.scales.x.max = maxValue;
    }

    draw();
  }

  /** Vertical bar chart preserving a caller-supplied order. */
  function renderBar(spec, data) {
    var body = createCard(spec);
    var keys = Object.keys(data);
    if (spec.sortNumeric) {
      keys.sort(function (a, b) { return Number(a) - Number(b); });
    }

    new Chart(createCanvas(body), {
      type: 'bar',
      data: {
        labels: keys,
        datasets: [{
          label: spec.axis || 'Votes',
          data: keys.map(function (k) { return data[k]; }),
          backgroundColor: theme.primary,
          borderRadius: 3,
          borderSkipped: false,
          maxBarThickness: 56
        }]
      },
      options: {
        scales: { y: valueAxis(spec.axis), x: categoryAxis() },
        plugins: { tooltip: { callbacks: { label: countLabel } } }
      }
    });
  }

  /** Pie chart - used only where colour carries identity, so it gets a legend. */
  function renderPie(spec, data) {
    var body = createCard(spec);
    var labels = Object.keys(data);

    new Chart(createCanvas(body), {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: labels.map(function (k) { return data[k]; }),
          backgroundColor: seriesColors(labels.length),
          // A ring in the page colour keeps adjacent slices separable.
          borderColor: theme.ground,
          borderWidth: 2
        }]
      },
      options: {
        cutout: '52%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: theme.ink,
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 14
            }
          },
          tooltip: { callbacks: { label: countLabel } }
        }
      }
    });
  }

  /** Histogram of a numeric distribution, plus its summary statistics. */
  function renderHistogram(spec, data) {
    var body = createCard(spec);
    var size = spec.binSize || EGG_BIN_SIZE;
    var bins = {};

    data.data.forEach(function (value) {
      var floor = Math.floor(value / size) * size;
      var key = floor + '–' + (floor + size - 1);
      bins[key] = (bins[key] || 0) + 1;
    });

    var labels = Object.keys(bins).sort(function (a, b) {
      return parseInt(a, 10) - parseInt(b, 10);
    });

    new Chart(createCanvas(body), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: spec.axis || 'Responses',
          data: labels.map(function (k) { return bins[k]; }),
          backgroundColor: theme.primary,
          borderRadius: 3,
          borderSkipped: false
        }]
      },
      options: {
        scales: { y: valueAxis(spec.axis), x: categoryAxis() },
        plugins: { tooltip: { callbacks: { label: countLabel } } }
      }
    });

    var summary = el('dl', 'survey-stats');
    [
      ['Average', data.average],
      ['Max', data.max],
      ['Min', data.min]
    ].forEach(function (pair) {
      var group = el('div', 'survey-stats__item');
      group.appendChild(el('dt', 'survey-stats__label', pair[0]));
      group.appendChild(el('dd', 'survey-stats__value', String(pair[1])));
      summary.appendChild(group);
    });
    body.appendChild(summary);
  }

  /** Long tail of free-text answers - a ranked list reads better than a chart. */
  function renderRankedList(spec, data) {
    var body = createCard(spec);
    var entries = rankEntries(data);
    var total = sumValues(data);

    body.appendChild(el(
      'p',
      'survey-card__note',
      entries.length + ' ' + (spec.unit || 'answers') + ', ranked'
    ));

    var list = el('ol', 'survey-list');
    entries.forEach(function (entry) {
      var share = total ? ((entry[1] / total) * 100).toFixed(1) : '0.0';
      var item = el('li', 'survey-list__item');
      // textContent throughout: these are free-text survey answers.
      item.appendChild(el('span', 'survey-list__label', entry[0]));
      item.appendChild(el(
        'span',
        'survey-list__value',
        entry[1] + (entry[1] === 1 ? ' vote' : ' votes') + ' · ' + share + '%'
      ));
      list.appendChild(item);
    });

    body.appendChild(list);
  }

  function countLabel(context) {
    var value = context.parsed.x !== undefined && context.chart.options.indexAxis === 'y'
      ? context.parsed.x
      : context.parsed.y !== undefined ? context.parsed.y : context.parsed;
    return value + (value === 1 ? ' vote' : ' votes');
  }

  /** Previous/next control shared by paginated charts. */
  function buildPager(parent, onChange) {
    var nav = el('div', 'survey-pager');
    var prev = el('button', 'survey-pager__button', '← Previous');
    var status = el('span', 'survey-pager__status');
    var next = el('button', 'survey-pager__button', 'Next →');

    prev.type = 'button';
    next.type = 'button';
    nav.appendChild(prev);
    nav.appendChild(status);
    nav.appendChild(next);
    parent.appendChild(nav);

    var current = 0;
    var pages = 1;

    prev.addEventListener('click', function () {
      if (current > 0) onChange(current - 1);
    });
    next.addEventListener('click', function () {
      if (current < pages - 1) onChange(current + 1);
    });

    return {
      update: function (page, pageCount, from, to, total) {
        current = page;
        pages = pageCount;
        status.textContent = from + '–' + to + ' of ' + total;
        prev.disabled = page === 0;
        next.disabled = page === pageCount - 1;
      }
    };
  }

  /* ---------------------------------------------------------------------
     What gets rendered, in page order
     --------------------------------------------------------------------- */

  var CHART_SPECS = [
    { key: 'fruits', emoji: '🍎', title: 'Favorite fruits', render: renderRankedBar, axis: 'Votes', perPage: FRUITS_PER_PAGE,
      question: 'What is your favorite fruit?' },
    { key: 'grapes', emoji: '🍇', title: 'Grape preferences', render: renderBar, axis: 'Votes',
      question: 'Do you prefer green grapes or red grapes?' },
    { key: 'toast_levels', emoji: '🍞', title: 'Ideal toast level', render: renderBar, axis: 'Votes', sortNumeric: true, note: 'On a scale of 1 (barely warm) to 7 (charcoal)',
      question: 'Let’s say you were to make toast to eat with just butter on top, what would your preferred toast level be?' },
    { key: 'eggs', emoji: '🥚', title: 'Egg eating challenge', render: renderHistogram, axis: 'Responses', binSize: EGG_BIN_SIZE,
      question: 'Given a normal waking day (e.g., 8am – midnight), how many eggs do you think you could eat? Assume you are trying to eat as many eggs as possible by the end of the day (i.e., you’re getting paid $1000 per egg eaten). Eggs can be prepared in any way.' },
    { key: 'sandwiches', emoji: '🥪', title: 'Sandwich supremacy', render: renderPie,
      question: 'What is the superior sandwich?' },
    { key: 'taco_shells', emoji: '🌮', title: 'Taco shell showdown', render: renderPie,
      question: 'Preferred taco shell?' },
    { key: 'potatoes', emoji: '🍟', title: 'Fried potato battle', render: renderRankedBar, axis: 'Votes',
      question: 'What is the best type of fried potato?' },
    { key: 'pasta_shapes', emoji: '🍝', title: 'Pasta shape preferences', render: renderRankedBar, axis: 'Votes',
      question: 'What is your preferred pasta shape?' },
    { key: 'trader_joes', emoji: '🛒', title: 'Trader Joe’s favorites', render: renderRankedList, unit: 'items',
      question: 'Favorite Trader Joe’s item (can say ‘idk’ or ‘don’t shop there’)' },
    { key: 'plane_drinks', emoji: '✈️', title: 'Airplane drinks', render: renderRankedList, unit: 'drinks',
      question: 'Plane drink of choice (i.e., what drink you’re likely to order on a flight)' }
  ];

  function renderOverview(general) {
    var overview = el('div', 'survey-overview');

    // The response count is the headline; the timestamp is supporting detail
    // and is deliberately not given the same weight.
    var count = el('div', 'survey-overview__item');
    count.appendChild(el('span', 'survey-overview__value', String(general.total_responses)));
    count.appendChild(el('span', 'survey-overview__label', 'Responses'));
    overview.appendChild(count);

    overview.appendChild(el(
      'p',
      'survey-overview__updated',
      'Last updated ' + general.last_updated
    ));

    var host = document.getElementById('general-stats');
    host.innerHTML = '';
    host.appendChild(overview);
  }

  function renderAll(data) {
    applyChartTheme();
    renderOverview(data.general);

    CHART_SPECS.forEach(function (spec) {
      var section = data[spec.key];
      // Skip questions the current dataset doesn't include rather than
      // throwing and losing every chart after this one.
      if (!section) return;
      try {
        spec.render(spec, section);
      } catch (error) {
        console.error('Could not render "' + spec.key + '"', error);
      }
    });
  }

  /* ---------------------------------------------------------------------
     Load and gate
     --------------------------------------------------------------------- */

  function loadSurveyData() {
    var loading = document.getElementById('loading');

    // Cache-bust: GitHub Pages serves this JSON with a long-lived cache and a
    // scheduled job rewrites it daily.
    fetch(DATA_URL + '?v=' + Date.now())
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        loading.hidden = true;
        renderAll(data);
      })
      .catch(function (error) {
        console.error('Error loading survey data:', error);
        loading.textContent = 'Could not load the results. Try again in a moment.';
      });
  }

  function initGate() {
    var form = document.getElementById('passcode-form');
    var results = document.getElementById('survey-results');
    var input = document.getElementById('passcode');
    var submit = document.getElementById('passcode-submit');
    var error = document.getElementById('error-message');
    if (!form || !input) return;

    function check() {
      if (input.value.trim().toUpperCase() !== ACCESS_CODE) {
        error.hidden = false;
        input.select();
        return;
      }
      error.hidden = true;
      form.hidden = true;
      results.hidden = false;
      loadSurveyData();
    }

    submit.addEventListener('click', check);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        check();
      }
    });
    input.addEventListener('input', function () {
      error.hidden = true;
    });

    input.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGate);
  } else {
    initGate();
  }
})();
