---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

{% comment %}
  The PDF is the source of truth; this page is a frame around it. Keep the
  markup unindented - Kramdown reads four leading spaces as a code block.

  Styles: _sass/_cv.scss
{% endcomment %}

<div class="cv__bar">
<p class="cv__note">The full CV is embedded below, and the download is the same file.</p>
<a class="cv__download" href="{{ base_path }}/files/JaylenWang_CV.pdf" download>
<i class="fas fa-arrow-down" aria-hidden="true"></i>
Download PDF
</a>
</div>

{% comment %}
  An <iframe>, not an <object>: the theme runs fitVids over `.page__content`,
  which wraps every <object> and <embed> in a zero-height aspect-ratio shim and
  collapses it. fitVids only touches iframes whose src is a known video host,
  so this one is left alone.
{% endcomment %}
<iframe class="cv__viewer" src="{{ base_path }}/files/JaylenWang_CV.pdf#view=FitH" title="Jaylen Wang CV">
<p class="cv__fallback">Your browser can't display the PDF inline. <a href="{{ base_path }}/files/JaylenWang_CV.pdf">Download it instead</a>.</p>
</iframe>
