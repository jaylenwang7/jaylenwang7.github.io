---
permalink: /
title: "About me"
excerpt: "About me"
author_profile: true
redirect_from: 
  - /about/
  - /about.html
---

Hello! I'm a third-year PhD candidate in CMU's ECE program working with [Prof. Akshitha Sriraman](https://users.ece.cmu.edu/~asrirama/). My research passion lies in finding novel ways to make cloud/web systems more sustainable by targeting more efficient use of data center resources (particularly hardware) in order to reduce carbon emissions, e-waste, and other environmental impacts from hyperscale systems. This has manifested in research projects focusing on 1) extending the useful lifetime of servers used in hyperscale web systems through intelligent scheduling and 2) designing a framework to evaluate server designs while considering data center-scale carbon impacts.

Prior to starting my PhD, I graduated from Harvard University (Class of 2022), where I studied Electrical Engineering and Computer Science. I was fortunate to work with Profs. [David Brooks](https://www.eecs.harvard.edu/~dbrooks/) and [Gu-Yeon Wei](https://www.eecs.harvard.edu/~gywei/) on projects related to sustainable computing and fault analysis for machine learning.

While you're here, participate in my anonymous, very scientific ✨**<a href="https://forms.gle/NiYerAvgQ5JkidE5A" target="_blank">data collection</a>**✨. I'm trying to see some things. Once you fill it out, you'll get a passcode which you can use to view the [survey results]({{ site.url }}/survey-results/).

The best way to contact me is through email: `jaylenw [at] andrew.cmu.edu`.

What've I been up to?
======
{% include news.html %}

Research interests
======
* Data center systems
* Sustainable computing
* Computer architecture
* Hardware/software co-design

Hobbies/interests (not that you asked)
======
* 🎾 I've played tennis most of my life. I still enjoy playing regularly (through CMU's club tennis team and with friends). Still trying to figure out how a backhand volley works (seems like there's a gap in the literature in this).
* 🏀 I'm a big fan of the NBA, particularly of the Boston Celtics. If there's a Celtics game on, I'll either be watching or wishing I were watching. If you also love Derrick White and Al Horford, we'll get along.
* 🍽️ I love making, talking about, and eating food. I may ask you questions such as "what fruit do you think is underrated?". I apologize in advance.
* 🌲 I enjoy hiking and basically anything with fresh air. Always chasing the thrill of eating a day-old PB&J after reaching the top.
* 🎧 I love listening to podcasts (of almost any kind) and reading books (especially non-fiction, memoirs, and poetry). Please give me recs :)
* 🎵 My proudest achievement is making a [Spotify playlist](https://open.spotify.com/playlist/4XbLl7tRLmlxVxLR08Fxs2) with <span id="playlist-saves"></span> followers<span id="deltas-wrapper" style="display: none;"> (<span id="delta-1d"></span> today, <span id="delta-7d"></span> past week)</span> as of <span id="last-updated"></span>. And one of the greatest gifts I've received is a [fun website](https://isamsiu.github.io/spotify_saves_tracker/) that tracks and plots the saves over time.

<script>
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded. Starting playlist script.");

  function formatDelta(n) {
    if (typeof n !== 'number' || isNaN(n)) return '';
    return (n > 0 ? '+' : '') + n;
  }

  function renderFromJson(data) {
    console.log("Attempting to render from JSON data:", data);
    try {
      const saves = data && typeof data.saves === 'number' ? data.saves : null;
      const lastUpdated = data && data.last_updated ? data.last_updated : '';
      const history = Array.isArray(data && data.history) ? data.history : [];

      if (saves !== null) {
        document.getElementById('playlist-saves').textContent = ' ' + saves;
      }
      if (lastUpdated) {
        document.getElementById('last-updated').textContent = lastUpdated;
      }

      if (history.length >= 2) {
        document.getElementById('deltas-wrapper').style.display = 'inline';
        const delta1d = (history[history.length - 1].saves || 0) - (history[history.length - 2].saves || 0);
        const delta7d = (history[history.length - 1].saves || 0) - (history[0].saves || 0);

        document.getElementById('delta-1d').textContent = formatDelta(delta1d);
        document.getElementById('delta-7d').textContent = formatDelta(delta7d);
      }
      console.log("Successfully rendered from JSON.");
    } catch (e) {
      console.error("Error inside renderFromJson:", e);
    }
  }

  function renderFromYaml(text) { // fallback when JSON isn't available yet
    console.log("Attempting to render from YAML text:", text);
    try {
      const lines = text.split('\n');
      const saves = lines[0].split(':')[1].trim();
      const lastUpdated = lines[2].split(': ')[1].trim().replace(/^'|'$/g, '');
      document.getElementById('playlist-saves').textContent = ' ' + saves;
      document.getElementById('last-updated').textContent = lastUpdated;
      console.log("Successfully rendered from YAML.");
    } catch (e) {
      console.error("Error inside renderFromYaml:", e);
    }
  }

  console.log("Fetching JSON data from /assets/data/playlist_saves.json...");
  fetch('/assets/data/playlist_saves.json')
    .then(function(r) {
      console.log("JSON fetch response:", r);
      if (!r.ok) {
        throw new Error('JSON fetch failed with status: ' + r.status);
      }
      return r.json();
    })
    .then(function(data) {
        console.log("Successfully parsed JSON data.");
        renderFromJson(data);
    })
    .catch(function(jsonError) {
      console.error("Failed to load or parse JSON:", jsonError);
      console.log("Falling back to YAML data...");
      fetch('/assets/data/playlist_saves.yml')
        .then(function(r) {
            console.log("YAML fetch response:", r);
            if (!r.ok) {
                throw new Error('YAML fetch failed with status: ' + r.status);
            }
            return r.text();
        })
        .then(function(text) {
            console.log("Successfully fetched YAML text.");
            renderFromYaml(text);
        })
        .catch(function(yamlError) {
            console.error("Failed to load YAML as a fallback:", yamlError);
        });
    });
});
</script>