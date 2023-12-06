---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
---
Color code: <strong><font color="green">Green</font></strong>: conference, <strong><font color="orange">Orange</font></strong>: journal, <strong><font color="purple">Purple</font></strong>: workshop.
{% if author.googlescholar %}
  You can also find my articles on <u><a href="{{author.googlescholar}}">my Google Scholar profile</a>.</u>
{% endif %}

{% include base_path %}

{% for post in site.publications reversed %}
  {% include archive-single-pub.html %}
{% endfor %}
