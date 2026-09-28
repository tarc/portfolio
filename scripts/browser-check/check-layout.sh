#!/usr/bin/env bash
# Checks the layout rules in rules.mjs on every page at each screen size, in
# a headless Windows Edge, from WSL2.
#
#   check-layout.sh [options]
#       --base=URL           check this server (e.g. the dev server,
#                            http://localhost:4321) instead of a fresh build
#       --pages=NAME,...     home, blog, bio, a post's slug, or posts (every
#                            post); default all
#       --viewports=NAME,... phone-320, phone-390, tablet-768, desktop-1280
#                            (default all)
#       --themes=light|dark|both   (default light)
#       --verbose            print passing checks too
#       --pending            also run the rules awaiting a decision (rules.mjs)
#       --out=DIR            screenshots of failures (default /tmp/portfolio-checks)
#
# Without --base it runs `astro build`, serves the build with
# Astro's preview server on port 4322, checks it and stops the server. Prints failed
# checks with a screenshot of each (failing elements outlined in red), then a
# summary. Exits 1 if any check failed.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
. "$here/lib/common.sh"
cd "$here/../.."
usage() { sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

base='' pages='' viewports='' verbose=false pending=false
themes='["light"]'
out=/tmp/portfolio-checks
for argument in "$@"; do
    case $argument in
        --base=?*) base=${argument#--base=} ;;
        --pages=?*) pages=${argument#--pages=} ;;
        --viewports=?*) viewports=${argument#--viewports=} ;;
        --themes=light | --themes=dark) themes="[\"${argument#--themes=}\"]" ;;
        --themes=both) themes='["light","dark"]' ;;
        --verbose) verbose=true ;;
        --pending) pending=true ;;
        --out=?*) out=${argument#--out=} ;;
        *) usage ;;
    esac
done

all='[
  {"name":"phone-320","width":320,"height":640,"mobile":true,"scale":1},
  {"name":"phone-390","width":390,"height":844,"mobile":true,"scale":1},
  {"name":"tablet-768","width":768,"height":1024,"mobile":false,"scale":1},
  {"name":"desktop-1280","width":1280,"height":800,"mobile":false,"scale":1}
]'
chosen=$(jq -c --arg names "$viewports" \
    '($names | split(",") | map(select(. != ""))) as $n | if $n == [] then . else map(select(.name | IN($n[]))) end' <<<"$all")
[ -z "$viewports" ] || [ "$(jq length <<<"$chosen")" -eq "$(tr ',' '\n' <<<"$viewports" | grep -c .)" ] \
    || die "unknown viewport in $viewports; known: $(jq -r 'map(.name) | join(", ")' <<<"$all")"

find_windows_tools
if [ -z "$base" ]; then
    trap stop_preview EXIT
    start_preview 4322
    base=http://localhost:4322
fi
check_server "$base"

mkdir -p "$out"
config=$(jq -n -c \
    --arg edge "$edge" --arg base "$base" --arg out "$(wslpath -w "$out")" --arg pages "$pages" \
    --argjson viewports "$chosen" --argjson themes "$themes" --argjson verbose "$verbose" --argjson pending "$pending" \
    '{edge: $edge, base: $base, out: $out, pages: ($pages | split(",") | map(select(. != ""))),
      viewports: $viewports, themes: $themes, verbose: $verbose, pending: $pending}')

status=0
run_driver "$here/check-layout.mjs" "$config" | sed "s|shot=|$out/|" || status=$?
exit "$status"
