#!/usr/bin/env bash
#
# check-deploy.sh — report whether GitHub Actions considered the current commit
# clean, without hand-writing gh incantations each time.
#
# Watches the "Build site" workflow (.github/workflows/build.yml) run for the
# current HEAD commit and exits non-zero if it failed. On master it also reports
# the "pages build and deployment" status for the same commit (informational).
#
# Usage:
#   .github/scripts/check-deploy.sh          # watch checks for the current commit
#   .github/scripts/check-deploy.sh --push   # push the current branch first, then watch
#
# --push refuses to push a branch that is behind origin, since the survey and
# playlist bots commit to master daily and a stale branch is the common failure
# here. It also warns when the working tree is dirty, because then the files you
# tested are not the files that deploy.
#
# Exit codes: 0 = build passed (or was path-ignored), 1 = build failed,
#             2 = setup/usage error (including a stale branch).
#
# Requires: gh (authenticated) and git.

set -euo pipefail

BUILD_WORKFLOW="build.yml"
PAGES_WORKFLOW_NAME="pages-build-deployment"
POLL_TIMEOUT=90     # seconds to wait for a run to appear after a push
POLL_INTERVAL=5

die() { echo "error: $*" >&2; exit 2; }

command -v gh  >/dev/null 2>&1 || die "gh (GitHub CLI) not found"
command -v git >/dev/null 2>&1 || die "git not found"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated — run: gh auth login"

cd "$(git rev-parse --show-toplevel)" || die "not in a git repository"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

case "${1:-}" in
  --push)
    # The survey and playlist bots commit to master every day, so a local
    # branch goes stale just by being left overnight. Catch that here with an
    # actionable message rather than letting `git push` reject with one that
    # does not mention the bots.
    echo "==> checking $BRANCH against origin..."
    git fetch --quiet origin "$BRANCH" || die "could not fetch origin/$BRANCH"

    BEHIND=$(git rev-list --count HEAD..FETCH_HEAD)
    if (( BEHIND > 0 )); then
      die "$BRANCH is $BEHIND commit(s) behind origin/$BRANCH.
       The survey and playlist bots push to master daily, so this is routine.
       Rebase, re-run the strict build, then retry:
         git pull --rebase origin $BRANCH
         bundle exec jekyll build --strict_front_matter"
    fi

    # A dirty tree means the files you just tested are not the files that
    # deploy. Worth saying out loud; not worth blocking on.
    if [[ -n "$(git status --porcelain)" ]]; then
      echo "warning: working tree has uncommitted changes." >&2
      echo "         Pushing HEAD ($(git rev-parse --short HEAD)); those changes stay local." >&2
    fi

    echo "==> pushing $BRANCH to origin..."
    git push origin "$BRANCH"
    ;;
  "") ;;
  *) die "unknown argument: ${1} (use --push or no arguments)";;
esac

SHA=$(git rev-parse HEAD)
SHORT=$(git rev-parse --short HEAD)
echo "==> commit $SHORT on $BRANCH"

# Find the Build site run for this exact commit (poll until it appears).
echo "==> waiting for '$BUILD_WORKFLOW' run to start (up to ${POLL_TIMEOUT}s)..."
RUN_ID=""
elapsed=0
while (( elapsed < POLL_TIMEOUT )); do
  RUN_ID=$(gh run list --workflow="$BUILD_WORKFLOW" --branch "$BRANCH" --limit 20 \
             --json databaseId,headSha \
             --jq "map(select(.headSha == \"$SHA\")) | .[0].databaseId // empty" 2>/dev/null || true)
  [[ -n "$RUN_ID" ]] && break
  sleep "$POLL_INTERVAL"
  (( elapsed += POLL_INTERVAL ))
done

if [[ -z "$RUN_ID" ]]; then
  echo "==> no '$BUILD_WORKFLOW' run for $SHORT after ${POLL_TIMEOUT}s."
  echo "    Likely path-ignored (e.g. a data-only commit), so no build was needed."
  exit 0
fi

echo "==> watching Build site run $RUN_ID ..."
BUILD_OK=1
gh run watch "$RUN_ID" --interval "$POLL_INTERVAL" --exit-status >/dev/null 2>&1 || BUILD_OK=0

echo
if (( BUILD_OK )); then
  echo "✓ Build site PASSED for $SHORT"
else
  echo "✗ Build site FAILED for $SHORT — failing step output below:"
  echo "----------------------------------------------------------------"
  gh run view "$RUN_ID" --log-failed 2>/dev/null | tail -30 || true
  echo "----------------------------------------------------------------"
  echo "  full logs: gh run view $RUN_ID --log-failed"
fi

# Informational: Pages deploy status on master.
if [[ "$BRANCH" == "master" ]]; then
  PAGES=$(gh run list --branch master --limit 30 \
            --json headSha,workflowName,status,conclusion \
            --jq "map(select(.headSha == \"$SHA\" and .workflowName == \"$PAGES_WORKFLOW_NAME\")) | .[0] | select(. != null) | (.conclusion // .status)" \
            2>/dev/null || true)
  [[ -n "$PAGES" ]] && echo "  pages build and deployment: $PAGES"
fi

(( BUILD_OK )) && exit 0 || exit 1
