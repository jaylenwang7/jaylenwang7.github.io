---
layout: default
title: "Survey Results"
permalink: /survey-results/
---

<div id="passcode-form" style="text-align: center; margin: 50px 0;">
  <h2>Enter Survey Access Code</h2>
  <p style="margin: 20px 0; color: #666;">
    Need the access code? 
    <a href="https://forms.gle/MUb6fduRtoqTf79t5" target="_blank" style="color: #007cba; text-decoration: none; font-weight: bold;">
      Fill out the fun survey first! 📝
    </a>
  </p>
  <div style="margin: 20px 0;">
    <input type="password" id="passcode" placeholder="Enter passcode" style="
      padding: 10px; 
      font-size: 16px; 
      border: 2px solid #ddd; 
      border-radius: 5px;
      margin-right: 10px;
      min-width: 200px;
    ">
    <button onclick="checkPasscode()" style="
      padding: 10px 20px; 
      font-size: 16px; 
      background: #007cba; 
      color: white; 
      border: none; 
      border-radius: 5px;
      cursor: pointer;
    ">View Results</button>
  </div>
  <p id="error-message" style="color: red; display: none; margin-top: 15px;">Incorrect passcode!</p>
</div>

<div id="survey-results" style="display: none;">
  <h1>Fun Survey Results! 📊</h1>
  <div id="loading">Loading latest results...</div>
  <div id="general-stats"></div>
  <div id="stats-container"></div>
</div>

<script src="/assets/js/survey-results.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<script>
// Add Enter key support for passcode input
document.addEventListener('DOMContentLoaded', function() {
    const passcodeInput = document.getElementById('passcode');
    
    passcodeInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            checkPasscode();
        }
    });
    
    // Focus on the input field when page loads
    passcodeInput.focus();
});
</script>