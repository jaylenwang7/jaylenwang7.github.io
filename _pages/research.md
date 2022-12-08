---
layout: archive
title: "Research"
permalink: /research/
author_profile: true
---

Check out what I'm working on! Please do reach out if you have any questions or feedback :)

{% include base_path %}

{% for post in site.research reversed %}
  {% include archive-single.html %}
{% endfor %}
