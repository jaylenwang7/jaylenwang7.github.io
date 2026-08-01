---
layout: single
title: "Survey Results"
permalink: /survey-results/
author_profile: false
hide_title: true
---

<div class="survey">
  <div id="passcode-form" class="survey-gate">
    <h1 class="survey-gate__title">Survey results</h1>
    <p class="survey-gate__lead">
      Enter the access code you got after filling out the survey.
    </p>

    <div class="survey-gate__field">
      <label class="visually-hidden" for="passcode">Access code</label>
      <input type="password" id="passcode" class="survey-gate__input"
             placeholder="Access code" autocomplete="off">
      <button type="button" id="passcode-submit" class="survey-gate__button">
        View results
      </button>
    </div>

    <p id="error-message" class="survey-gate__error" role="alert" hidden>
      That code isn't right. Check the message you got after submitting the survey.
    </p>

    <p class="survey-gate__help">
      Don't have a code? <a href="https://forms.gle/MUb6fduRtoqTf79t5" target="_blank" rel="noopener">Fill out the survey</a> to get one.
      Already filled it out? Send me an email and I'll pass it along.
    </p>
  </div>

  <div id="survey-results" hidden>
    <h1 class="survey__title">Survey results</h1>
    <div id="general-stats"></div>
    <p id="loading" class="survey__loading">Loading the latest results…</p>
    <div id="stats-container" class="survey__grid"></div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="{{ '/assets/js/survey-results.js' | relative_url }}"></script>
