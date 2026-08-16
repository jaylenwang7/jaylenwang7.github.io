---
permalink: /
title: "About me"
excerpt: "Jaylen Wang, PhD candidate at Carnegie Mellon ECE, working on sustainable cloud and data center systems."
author_profile: true
hide_title: true
redirect_from: 
  - /about/
  - /about.html
hero:
  eyebrow: "Fifth-year PhD candidate · Carnegie Mellon ECE"
  name: "Jaylen Wang"
  thesis: "My research addresses the growing carbon emissions of data centers through solutions that span computer architecture and software systems. Much of it concerns the **tradeoff between embodied and operational emissions**: the carbon spent manufacturing hardware against the carbon spent running it."
  levers:
    - label: "Server design"
      text: "Designing cloud servers that balance energy efficiency with reusing decommissioned components, and evaluating carbon savings under production performance and fleet constraints."
    - label: "Fleet capacity"
      text: "Getting more out of the servers already built, reducing manufacturing emissions. Finding intelligent, performance-preserving ways to (1) use hardware for longer, and (2) serve the same demand with fewer servers."
    - label: "Server power"
      text: "Lowering the power consumed by the servers that remain (e.g., the accelerator-attached hosts that support large-scale ML training)."
  facts:
    - label: "Advised by"
      value: "[Akshitha Sriraman](https://users.ece.cmu.edu/~asrirama/)"
    - label: "Email"
      value: "`jaylenw [at] andrew.cmu.edu`"
---

{% include hero.html %}

## Background

As demand for web services continues to grow, data centers are scaling up to meet it, consuming a massive amount of energy and producing significant carbon emissions. My research addresses those emissions by analyzing inefficiencies across computer architecture and software systems, and designing solutions that span the compute stack to make these systems more energy and carbon efficient.

Cloud servers' emissions come from two sources: embodied emissions, i.e., the carbon emitted to manufacture and transport servers, and operational emissions, i.e., the carbon emitted to power them. These two types of emissions often introduce subtle but significant tradeoffs. For example, keeping older hardware in service avoids manufacturing emissions, but that hardware is often less energy efficient than the new hardware that may replace it. Much of my work characterizes that tradeoff to design systems that reduce net emissions while considering practical deployment factors (e.g., not sacrificing performance).

Prior to starting my PhD, I graduated from Harvard University (Class of 2022), where I studied Electrical Engineering and Computer Science. I was fortunate to work with Profs. [David Brooks](https://www.eecs.harvard.edu/~dbrooks/) and [Gu-Yeon Wei](https://www.eecs.harvard.edu/~gywei/) on projects related to sustainable computing and fault analysis for machine learning.

## What've I been up to?

{% include news.html %}

## Not that you asked

{% comment %}
  The emoji are decorative markers, not content: each is wrapped so CSS can
  lift it out of the flow (see `.icon-list` in _sass/_components.scss) and
  hidden from assistive tech, which would otherwise read "tennis racquet"
  before every item. Keep the wrapper when adding a bullet.
{% endcomment %}
* <span class="icon-list__icon" aria-hidden="true">🎾</span> I've played tennis most of my life. I still enjoy playing regularly (through CMU's club tennis team and with friends). Still trying to figure out how a backhand volley works (seems like there's a gap in the literature in this).
* <span class="icon-list__icon" aria-hidden="true">🏀</span> I'm a big fan of the NBA, particularly of the Boston Celtics. If there's a Celtics game on, I'll either be watching or wishing I were watching. If you also love Derrick White and Hugo González<span class="sidenote"><button type="button" class="sidenote__marker" aria-describedby="sidenote-horford">*</button><span role="tooltip" id="sidenote-horford" class="sidenote__note">This used to say Al Horford. :(</span></span>, we'll get along.
* <span class="icon-list__icon" aria-hidden="true">🍽️</span> I love making, talking about, and eating food. I may ask you questions such as "what fruit do you think is underrated? Or your favorite?"<span id="fruit-verdict" hidden> (<span id="fruit-verdict-text"></span>, according to my <a href="#survey">very scientific survey</a>)</span>. I apologize in advance. If you haven't had the privilege of being asked in person, [take the opportunity to be asked virtually](https://forms.gle/NiYerAvgQ5JkidE5A).
* <span class="icon-list__icon" aria-hidden="true">🌲</span> I enjoy hiking and basically anything with fresh air. Always chasing the thrill of eating a day-old PB&J after reaching the top.
* <span class="icon-list__icon" aria-hidden="true">🎧</span> I love listening to podcasts (of almost any kind) and reading books (especially non-fiction, memoirs, and poetry). Please give me recs :)
* <span class="icon-list__icon" aria-hidden="true">🎵</span> My proudest achievement is making a [Spotify playlist](https://open.spotify.com/playlist/4XbLl7tRLmlxVxLR08Fxs2) with <span id="playlist-saves"></span> followers<span id="deltas-wrapper" hidden> (<span id="delta-1d"></span> today, <span id="delta-7d"></span> past week)</span> as of <span id="last-updated"></span>. And one of the greatest gifts I've received is a [fun website](https://isamsiu.github.io/spotify_saves_tracker/) that tracks and plots the saves over time.
{: .icon-list}

<div class="callout" id="survey" markdown="1">
#### Before you go: a very scientific experiment

Participate in my anonymous ✨**<a href="https://forms.gle/NiYerAvgQ5JkidE5A" target="_blank">data collection</a>**✨. I'm trying to see some things. Once you fill it out, you'll get a passcode you can use to view the [survey results]({{ site.url }}/survey-results/).
</div>

<script src="/assets/js/playlist-saves.js"></script>
<script src="{{ '/assets/js/survey-teaser.js' | relative_url }}"></script>
