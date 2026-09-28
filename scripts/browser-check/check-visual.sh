#!/usr/bin/env bash
# Screenshots every page, whole, at each screen size in light and dark, in a
# headless Windows Edge, and compares them with a reference set: a report of
# what changed, not a pass/fail check.
#
#   check-visual.sh [options]
#       --record             save the shots as the reference set instead
#       --base=URL           shoot this server instead of a fresh build
#       --pages=NAME,...     home, blog, bio, a post's slug, or posts (every
#                            post); default all
#       --viewports=NAME,... phone-320, phone-390, tablet-768, desktop-1280
#                            (default all)
#       --themes=light|dark|both   (default both)
#
# Without --base it builds the site and serves the build on port 4322, like
# check-layout.sh. Everything goes in .visual/ (gitignored): reference/,
# latest/, diff/ and report.html. Prints the changes (compare-visual.sh)
# and where the report is. Exits 0 unless something breaks (no reference
# set, no server, a page that fails to load).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
. "$here/lib/common.sh"
cd "$here/../.."
usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

record=false base='' pages='' viewports=''
themes='["light","dark"]'
for argument in "$@"; do
    case $argument in
        --record) record=true ;;
        --base=?*) base=${argument#--base=} ;;
        --pages=?*) pages=${argument#--pages=} ;;
        --viewports=?*) viewports=${argument#--viewports=} ;;
        --themes=light | --themes=dark) themes="[\"${argument#--themes=}\"]" ;;
        --themes=both) themes='["light","dark"]' ;;
        *) usage ;;
    esac
done
chosen=$(choose_viewports "$viewports")
# Only a run over every page, size and theme can tell a page has gone.
full=''
[ -n "$pages$viewports" ] || [ "$themes" != '["light","dark"]' ] || full=--full

visual=$PWD/.visual
if $record; then
    out=$visual/reference
    # A whole new reference set replaces the old one; a partial one updates
    # just those shots.
    [ -z "$full" ] || rm -rf "$out"
else
    compgen -G "$visual/reference/*.png" >/dev/null \
        || die "no reference set in $visual/reference; record one first: just check-visual --record"
    out=$visual/latest
    rm -rf "$out"
fi
mkdir -p "$out"

find_windows_tools
if [ -z "$base" ]; then
    trap stop_preview EXIT
    start_preview 4322
    base=http://localhost:4322
fi
check_server "$base"

config=$(jq -n -c \
    --arg edge "$edge" --arg base "$base" --arg out "$(wslpath -w "$out")" --arg pages "$pages" \
    --argjson viewports "$chosen" --argjson themes "$themes" \
    '{edge: $edge, base: $base, out: $out, pages: ($pages | split(",") | map(select(. != ""))),
      viewports: $viewports, themes: $themes}')

echo "shooting the pages..." >&2
status=0
run_driver "$here/check-visual.mjs" "$config" | grep -v '^saved=' || status=${PIPESTATUS[0]}
# grep finding no FAIL lines is fine; the driver's own status counts.
[ "$status" -le 1 ] || status=1
shots=$(compgen -G "$out/*.png" | wc -l)

if $record; then
    echo "recorded $shots shots as the reference set"
    show_path reference "$out"
else
    "$here/compare-visual.sh" "$visual" $full
    show_path report "$visual/report.html"
fi
exit "$status"
