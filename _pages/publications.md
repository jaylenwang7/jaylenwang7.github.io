---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
---

You can also find a complete list of my publications on <font color="blue"><a href="https://scholar.google.com/citations?user=XZeSn5wAAAAJ&hl=en">my Google Scholar profile</a></font>.

{% include base_path %}

<!-- Conference Papers -->
{% assign conference_papers = site.publications | where: "venue_type", "conference" | sort: "date" | reverse %}
{% if conference_papers.size > 0 %}
  <h2 style="color: #2c5f3e; border-bottom: 2px solid #2c5f3e; padding-bottom: 5px; margin-top: 30px;">Conference Papers</h2>
  {% for post in conference_papers %}
    {% include archive-single-pub.html %}
  {% endfor %}
{% endif %}

<!-- Journal Papers -->
{% assign journal_papers = site.publications | where: "venue_type", "journal" | sort: "date" | reverse %}
{% if journal_papers.size > 0 %}
  <h2 style="color: #cc6600; border-bottom: 2px solid #cc6600; padding-bottom: 5px; margin-top: 30px;">Journal Papers</h2>
  {% for post in journal_papers %}
    {% include archive-single-pub.html %}
  {% endfor %}
{% endif %}

<!-- Workshop Papers -->
{% assign workshop_papers = site.publications | where: "venue_type", "workshop" | sort: "date" | reverse %}
{% if workshop_papers.size > 0 %}
  <h2 style="color: #8b4f9c; border-bottom: 2px solid #8b4f9c; padding-bottom: 5px; margin-top: 30px;">Workshop Papers</h2>
  {% for post in workshop_papers %}
    {% include archive-single-pub.html %}
  {% endfor %}
{% endif %}

<!-- Other Publications (fallback for papers without venue_type) -->
{% assign all_papers = site.publications | sort: "date" | reverse %}
{% assign other_papers = "" | split: "" %}
{% for post in all_papers %}
  {% unless post.venue_type == 'conference' or post.venue_type == 'journal' or post.venue_type == 'workshop' %}
    {% assign other_papers = other_papers | push: post %}
  {% endunless %}
{% endfor %}
{% if other_papers.size > 0 %}
  <h2 style="color: #666; border-bottom: 2px solid #666; padding-bottom: 5px; margin-top: 30px;">Other Publications</h2>
  {% for post in other_papers %}
    {% include archive-single-pub.html %}
  {% endfor %}
{% endif %}