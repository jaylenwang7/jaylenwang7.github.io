---
layout: archive
title: "Research"
permalink: /research/
author_profile: true
---

Check out what I'm working on! Currently I'm working on two projects (one on DNN accelerator resilience and the other on crypto hardware sustainability) - click on either of the links for more details! Please do reach out if you have any questions or feedback :)

{% include base_path %}

{% for post in site.research reversed %}
  {% include archive-single.html %}
{% endfor %}
