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

While you're here, participate in my anonymous, very scientific ✨**<a href="https://forms.gle/NiYerAvgQ5JkidE5A" target="_blank">data collection</a>**✨. I'm trying to see some things.

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
* Machine learning hardware

Hobbies/interests (not that you asked)
======
* 🎾 I've played tennis most of my life. I still enjoy playing regularly (through CMU's club tennis team and with friends). Still trying to figure out how a backhand volley works (seems like there's a gap in the literature in this).
* 🏀 I'm a big fan of the NBA, particularly of the Boston Celtics. If there's a Celtics game on, I'll either be watching or wishing I were watching. If you also love Derrick White and Al Horford, we'll get along.
* 🍽️ I love making, talking about, and eating food. I may ask you questions such as "what fruit do you think is underrated?". I apologize in advance.
* 🌲 I enjoy hiking and basically anything with fresh air. Always chasing the thrill of eating a day-old PB&J after reaching the top.
* 🎧 I love listening to podcasts (of almost any kind) and reading books (especially non-fiction, memoirs, and poetry). Please give me recs :)
* 🎵 My proudest achievement is making a [Spotify playlist](https://open.spotify.com/playlist/4XbLl7tRLmlxVxLR08Fxs2) with <span id="playlist-saves"></span> followers as of <span id="last-updated"></span>. And one of the greatest gifts I've received is a [fun website](https://isamsiu.github.io/spotify_saves_tracker/) that tracks and plots the saves over time.

<script>
fetch('/assets/data/playlist_saves.yml')
  .then(response => response.text())
  .then(text => {
    const lines = text.split('\n');
    const saves = lines[0].split(':')[1].trim();
    const playlistName = lines[1].split(': ')[1].trim().replace(/^'|'$/g, '');
    const lastUpdated = lines[2].split(': ')[1].trim().replace(/^'|'$/g, '');
    
    document.getElementById('playlist-saves').textContent = saves;
    document.getElementById('last-updated').textContent = lastUpdated;
  });
</script>