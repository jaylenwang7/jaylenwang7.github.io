---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
---

{% include base_path %}

<p class="pub-intro">A complete list is also on <a href="https://scholar.google.com/citations?user=XZeSn5wAAAAJ&hl=en">my Google Scholar profile</a>.</p>

{% comment %}
  Sections render in the order below. Anything whose `venue_type` is missing or
  unrecognised falls through to "Other", so no paper is silently dropped.

  Keep the HTML in this file unindented - Kramdown treats four leading spaces
  as a code block, even when the indentation comes from a Liquid tag.
{% endcomment %}
{% assign venue_types = "conference,journal,workshop" | split: "," %}
{% assign venue_labels = "Conference papers,Journal papers,Workshop papers" | split: "," %}

{% for venue_type in venue_types %}
{% assign papers = site.publications | where: "venue_type", venue_type | sort: "date" | reverse %}
{% if papers.size > 0 %}
<h2 class="pub-section" id="{{ venue_type }}">{{ venue_labels[forloop.index0] }}</h2>
{% for post in papers %}{% include archive-single-pub.html %}{% endfor %}
{% endif %}
{% endfor %}

{% assign other_papers = "" | split: "" %}
{% for post in site.publications %}
{% unless venue_types contains post.venue_type %}
{% assign other_papers = other_papers | push: post %}
{% endunless %}
{% endfor %}

{% if other_papers.size > 0 %}
{% assign other_papers = other_papers | sort: "date" | reverse %}
<h2 class="pub-section" id="other">Other publications</h2>
{% for post in other_papers %}{% include archive-single-pub.html %}{% endfor %}
{% endif %}
