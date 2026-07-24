#!/usr/bin/env bash
#
# optimize-image.sh — resize + compress an image for web use, in place.
#
# Web images on this site are frequently committed at their full camera/export
# resolution (the profile photo was once 872px/1.1MB but renders at ~250px, and
# the ACM artifact badges were 501px/250KB but render at 45px). This trims a new
# image to a sane width and strips metadata before it lands in the repo, so those
# regressions don't recur.
#
# Usage:
#   .github/scripts/optimize-image.sh <image> [max-width]
#
#   <image>      Path to a .png / .jpg / .jpeg to optimize (edited IN PLACE).
#   [max-width]  Cap the width in pixels (default: 1000). Height scales to match;
#                images already narrower than this are only re-stripped, not upscaled.
#
# PNGs stay PNG (right for logos/badges/screenshots with flat color or alpha);
# JPEGs stay JPEG at quality 82. For a large *photograph* saved as PNG, convert it
# to JPEG first (photos compress far smaller as JPEG) — the script warns when it
# sees one. Requires ImageMagick (`magick`); install with `brew install imagemagick`.
#
set -euo pipefail

if ! command -v magick >/dev/null 2>&1; then
  echo "error: ImageMagick (magick) not found. Install with: brew install imagemagick" >&2
  exit 1
fi

img="${1:-}"
max_width="${2:-1000}"

if [[ -z "$img" || ! -f "$img" ]]; then
  echo "usage: $0 <image> [max-width]" >&2
  exit 1
fi

before_bytes=$(wc -c <"$img" | tr -d ' ')
# Trailing \n so `read` sees a line terminator (it exits non-zero on bare EOF,
# which would abort under `set -e`).
read -r width height < <(magick identify -format '%w %h\n' "$img")
ext="${img##*.}"
ext_lc=$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')  # bash 3.2 (macOS) has no ${var,,}

# Warn on large photographic PNGs — JPEG would be dramatically smaller.
if [[ "$ext_lc" == "png" && "$before_bytes" -gt 200000 && "$width" -gt 400 ]]; then
  echo "note: $img is a large PNG (${width}px). If it's a photograph, convert to"
  echo "      JPEG for a much smaller file, then re-run this on the .jpg."
fi

args=(-strip)
if [[ "$width" -gt "$max_width" ]]; then
  args+=(-resize "${max_width}x")
fi
if [[ "$ext_lc" == "jpg" || "$ext_lc" == "jpeg" ]]; then
  args+=(-quality 82)
fi

magick "$img" "${args[@]}" "$img"

after_bytes=$(wc -c <"$img" | tr -d ' ')
read -r new_w new_h < <(magick identify -format '%w %h\n' "$img")
hbefore=$(printf '%s' "$before_bytes" | awk '{printf "%.0fKB", $1/1024}')
hafter=$(printf '%s' "$after_bytes" | awk '{printf "%.0fKB", $1/1024}')
echo "optimized $img: ${width}x${height} ${hbefore} -> ${new_w}x${new_h} ${hafter}"
