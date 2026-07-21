#!/usr/bin/env bash
#
# sync-cv.sh — Rebuild the LaTeX CV and copy the PDF into this website.
#
# Compiles CV.tex in the LaTeX CV repo with latexmk (which runs the two passes
# the CV needs), then copies the resulting CV.pdf over files/JaylenWang_CV.pdf in
# this repo, which the /cv/ page embeds and links for download. After running,
# commit files/JaylenWang_CV.pdf and push (or use check-deploy.sh --push).
#
# Usage:
#   .github/scripts/sync-cv.sh              # build the CV, then sync the PDF
#   .github/scripts/sync-cv.sh --no-build   # skip the build, just copy existing CV.pdf
#
# Env:
#   CV_REPO   path to the LaTeX CV repo (default: /Users/jaylenw/Code/JaylenWang_CV)
#
set -euo pipefail

# Website repo root = two levels up from this script (.github/scripts/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CV_REPO="${CV_REPO:-/Users/jaylenw/Code/JaylenWang_CV}"
SRC_PDF="$CV_REPO/CV.pdf"
DEST_PDF="$SITE_ROOT/files/JaylenWang_CV.pdf"

build=1
[[ "${1:-}" == "--no-build" ]] && build=0

if [[ ! -d "$CV_REPO" ]]; then
  echo "error: CV repo not found at $CV_REPO (set CV_REPO=... to override)" >&2
  exit 1
fi

if [[ "$build" == 1 ]]; then
  if ! command -v latexmk >/dev/null 2>&1; then
    echo "error: latexmk not found on PATH (needed to build the CV)" >&2
    exit 1
  fi
  echo "Building CV with latexmk in $CV_REPO ..."
  ( cd "$CV_REPO" && latexmk -pdf -interaction=nonstopmode CV.tex >/dev/null )
  echo "Build complete."
fi

if [[ ! -f "$SRC_PDF" ]]; then
  echo "error: $SRC_PDF does not exist (build it first, or drop --no-build)" >&2
  exit 1
fi

cp "$SRC_PDF" "$DEST_PDF"
echo "Synced CV: $SRC_PDF -> $DEST_PDF"
ls -la "$DEST_PDF"
