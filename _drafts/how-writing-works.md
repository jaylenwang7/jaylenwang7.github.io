---
title: "How this blog works"
strand: misc
standfirst: "Every piece of the writing setup, demonstrated by using it. Keep this in _drafts/ as a reference, or delete it once the shapes are familiar."
date: 2026-08-03
tags: [meta, reference]
toc: true
---

This entry is the documentation. It is in `_drafts/`, which means Jekyll ignores it unless you ask for it:

```sh
bundle exec jekyll serve --config _config.yml,_config.dev.yml --drafts
```

Everything below is a live component, not a screenshot of one. If something renders wrong here, it will render wrong in a real entry, which is the point of keeping it around.

## Starting an entry

Make a file in `_posts/` named `YYYY-MM-DD-some-slug.md`. The date in the filename sets the publication date and the URL, which will be `/writing/2026/some-slug/`.

The front matter:

```yaml
---
title: "The scheduler was the problem"
strand: systems
standfirst: "One sentence under the title. Also the blurb on the index and the description on a social card."
tags: [scheduling, measurement]
---
```

Only `title` and `strand` do real work. `standfirst` is optional but worth writing — it is the line that convinces someone on the index to open the entry, and it saves you from the fallback, which is your opening paragraph truncated mid-thought.

There are four more, all optional:

| Key | Does |
|---|---|
| `tags` | Free-form. Clickable on the index, and searchable. |
| `toc: true` | Contents rail in the margin on wide screens. For long entries. |
| `updated: 2026-09-01` | Adds "Updated …" next to the date. |
| `header: {image: card.png}` | Social card. Looked up in `/images/`. |

To work on something without publishing it, put it in `_drafts/` without a date in the filename. To publish, move it to `_posts/` and add the date.

## Strands

A strand is the big bucket: the thing that separates an entry about embodied carbon from an entry about the draft lottery. Each entry declares one, and it decides the colour that runs through the page.

The vocabulary is `_data/writing.yml` and nothing else. Adding one means adding five lines there — no CSS, no template, no new page. The colours come from the site's categorical ramp in `_sass/_tokens.scss`, which is held at matched saturation on purpose, so pick a token name from that list rather than a hex value.

On the index, choosing a strand swaps the page's description for that strand's own and puts it in the URL. That is the whole sectioning mechanism: `?strand=hoops` is a section, and no archive pages had to be generated to make it one.

## Images

One image:

{% raw %}
```liquid
{% include writing/figure.html
     src="/images/profile2.jpg"
     alt="Portrait of the author"
     caption="Captions are optional but almost always worth it."
     bare=true %}
```
{% endraw %}

{% include writing/figure.html
     src="/images/profile2.jpg"
     alt="Portrait of the author"
     caption="A figure at the default width, which is the width of the text. Photographs have their own edges, so this one passes bare=true and skips the frame."
     credit="Photo by someone with a better camera than mine."
     w=500 h=501
     bare=true %}

Pass `w` and `h` — the image's real pixel dimensions — whenever you know them. The browser reserves the space before the file arrives, so the paragraph you are reading does not jump down the page when it does. It is the cheapest thing on this list and the one most worth remembering.

`width` takes `prose` (the default, the width of this paragraph), `wide`, or `full`. They are grid columns declared once, not margins invented per image, which is why figures line up down the length of an entry no matter how many there are. A tall image at `wide` or `full` will fill the screen — those widths are for charts and screenshots, which are usually landscape.

Charts and screenshots keep a hairline frame so their white backgrounds do not bleed into the page. Photographs usually want `bare=true` instead.

Two or three side by side:

{% include writing/gallery.html
     src1="/images/artifacts_available.png" alt1="Artifacts Available badge"
     src2="/images/artifacts_evaluated_functional.png" alt2="Artifacts Evaluated: Functional badge"
     src3="/images/results_reproduced.png" alt3="Results Reproduced badge"
     caption="A gallery. Pass images with similar proportions — a tall one next to a wide one will letterbox."
     w=96 h=95
     width="wide" %}

For an animation, use a video, not a GIF. A ten-second screen capture is a few hundred kilobytes as H.264 and several megabytes as a GIF, and the GIF looks worse:

{% raw %}
```liquid
{% include writing/video.html
     src="/images/writing/scheduler.mp4"
     poster="/images/writing/scheduler.jpg"
     caption="Requests migrating as the grid's carbon intensity changes."
     width="wide" loop=true %}
```
{% endraw %}

With `loop=true` it plays itself, silently, with no controls — and it stops doing that for anyone who has asked their system for reduced motion, who gets controls instead.

## Notes and footnotes

There are two kinds of aside and the difference is whether it should still exist after you stop pointing at it.

A footnote is written the normal Markdown way, `[^1]`, and gets both behaviours: hover the marker to read it in place,[^both] and find it numbered at the end of the entry. That is the one to use for a source or an argument someone might want to come back to.

A hover note leaves no trace{% include writing/note.html text="Like this one. It is here while you point at it and gone afterwards, which is the right weight for an aside that is mostly a shrug." %} and is for the aside that is not worth a numbered entry at the bottom of the page:

{% raw %}
```liquid
{% include writing/note.html text="The parenthetical that would have broken the sentence." %}
```
{% endraw %}

## Asides

For a caveat a reader can skip without losing the thread:

{% include writing/aside.html
     title="What counts as embodied"
     text="Everything spent before the machine is switched on: silicon, packaging, freight. It is the half nobody has good numbers for." %}

It takes the entry's strand colour without being told which strand it is in. For anything longer than a paragraph, write the box directly — kramdown will process the Markdown inside it as long as `markdown="1"` is there:

<div class="w-aside" markdown="1">
#### A longer aside

With **emphasis**, a [link](https://example.com), and a list:

- one
- two
</div>

There is also `tone="caution"` when the box is a warning rather than context.

## Citing

Two directions, and they are different jobs.

**Citing a source.** A footnote with a link in it is enough for a source mentioned once. When the same paper comes up three times and the entry ends with a reference list, put it in `_data/references.yml` and cite it by key {% include writing/cite.html key="gupta2021chasing" %} — hover it to see the full reference. Then render the list where you want it:

{% raw %}
```liquid
{% include writing/references.html keys="gupta2021chasing" %}
```
{% endraw %}

**Being cited.** Every entry ends with a citation block, generated from the front matter, that copies itself as a formatted citation, as BibTeX, or as a plain link. Nothing to write and nothing that can fall out of step with the title.

## Code

Fenced blocks, the normal way. The language name and the copy button are added for you:

```python
def embodied_carbon(chip_area_mm2, fab_intensity):
    """Rough embodied carbon for one die, in kgCO2e."""
    yield_rate = 0.85
    return chip_area_mm2 * fab_intensity / yield_rate
```

Long lines scroll inside the block rather than stretching the column.

## Maths

Set `mathjax: true` in the front matter and write `$...$` inline or `$$...$$` for a display equation. The site only loads MathJax on pages that ask for it.

## Publishing the first one

Nothing here is public yet. `_posts/` is empty, everything in `_drafts/` is invisible without the flag above, and `/writing/` is unlinked, kept out of `sitemap.xml`, and marked `noindex`. Three edits, once:

1. Delete `sitemap: false` and `noindex: true` from `_pages/writing.html`. The first stops the index being listed in `sitemap.xml`; the second stops it being indexed if a crawler finds the URL some other way.
2. Add an entry to `_data/navigation.yml`:

   ```yaml
   - title: "Writing"
     url: /writing/
   ```

RSS comes free at `/feed.xml` — `jekyll-feed` builds it from `site.posts` and the head already links it.

## Where things live

| Path | What |
|---|---|
| `_posts/` | Published entries. |
| `_drafts/` | Not published. `--drafts` to preview. |
| `_data/writing.yml` | The strands. |
| `_data/references.yml` | Sources, if you cite formally. |
| `_pages/writing.html` | The index page. |
| `_layouts/writing.html` | One entry. |
| `_includes/writing/` | The components above. Each one documents itself at the top. |
| `_sass/_writing-index.scss` | The index. |
| `_sass/_writing-post.scss` | The entry, including all the prose styling. |
| `assets/js/writing-index.js` | Search and filters. |
| `assets/js/writing-post.js` | Footnote previews, code bars, contents rail. |

[^both]: This is a footnote. You are probably reading it in a card over the sentence that referred to you here, but it is also at the bottom of the entry, numbered, with an arrow back. One syntax, both behaviours — there was no version of this where remembering which one to write was worth it.

{% include writing/references.html keys="gupta2021chasing" %}
