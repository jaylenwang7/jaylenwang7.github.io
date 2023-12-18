---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
---
Color code: <strong><font color="green">Green</font></strong>: conference, <strong><font color="orange">Orange</font></strong>: journal, <strong><font color="purple">Purple</font></strong>: workshop.

You can also find my articles on <font color="blue"><a href="https://scholar.google.com/citations?user=XZeSn5wAAAAJ&hl=en">my Google Scholar profile</a></font>.


{% include base_path %}

{% for post in site.publications reversed %}
  {% include archive-single-pub.html %}
{% endfor %}
