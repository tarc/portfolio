#!/usr/bin/env bash
# Screenshots pages of the site in a headless Windows Edge, from WSL2.
#
#   shot.sh [options] PATH_OR_URL...
#       --theme=light|dark|both      (default both)
#       --viewport=desktop|mobile|both|WIDTHxHEIGHT   (default desktop)
#       --selector=CSS               shoot only the first matching element
#       --pad=PX                     margin around --selector (default 24)
#       --click=CSS                  click this element first (a real click)
#       --visible                    shoot only what the screen shows (e.g.
#                                    where a --click on a link scrolled to)
#       --styles=PROP,PROP           print these computed styles of --selector
#                                    (or body)
#       --base=URL                   server for paths (default http://localhost:4321)
#       --out=DIR                    where PNGs go (default /tmp/portfolio-shots)
#
# Paths are resolved against --base: `shot.sh /blog/` shoots the blog index
# of the running dev server. Prints the path of every PNG it saved; read them.
# Edge runs headless with a throwaway profile, so nothing appears on screen
# and the user's own browser is left alone.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
. "$here/lib/common.sh"
usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

base=http://localhost:4321
out=/tmp/portfolio-shots
themes='["light","dark"]'
viewport=desktop
selector='' click='' styles='' pad=24 visible=false
urls=()
for argument in "$@"; do
    case $argument in
        --theme=light | --theme=dark) themes="[\"${argument#--theme=}\"]" ;;
        --theme=both) themes='["light","dark"]' ;;
        --viewport=?*) viewport=${argument#--viewport=} ;;
        --selector=?*) selector=${argument#--selector=} ;;
        --pad=?*) pad=${argument#--pad=} ;;
        --click=?*) click=${argument#--click=} ;;
        --visible) visible=true ;;
        --styles=?*) styles=${argument#--styles=} ;;
        --base=?*) base=${argument#--base=} ;;
        --out=?*) out=${argument#--out=} ;;
        -*) usage ;;
        *) urls+=("$argument") ;;
    esac
done
[ ${#urls[@]} -gt 0 ] || usage
[[ $pad =~ ^[0-9]+$ ]] || die "--pad takes a number of pixels"

desktop='{"name":"desktop","width":1280,"height":800,"mobile":false,"scale":1}'
mobile='{"name":"mobile","width":390,"height":844,"mobile":true,"scale":2}'
case $viewport in
    desktop) viewports="[$desktop]" ;;
    mobile) viewports="[$mobile]" ;;
    both) viewports="[$desktop,$mobile]" ;;
    [0-9]*x[0-9]*)
        width=${viewport%x*} height=${viewport#*x}
        [[ $width =~ ^[0-9]+$ && $height =~ ^[0-9]+$ ]] || usage
        viewports="[{\"name\":\"$viewport\",\"width\":$width,\"height\":$height,\"mobile\":false,\"scale\":1}]"
        ;;
    *) usage ;;
esac

find_windows_tools
check_server "$base"

mkdir -p "$out"
config=$(jq -n -c \
    --arg edge "$edge" --arg base "$base" --arg out "$(wslpath -w "$out")" \
    --arg selector "$selector" --arg click "$click" --arg styles "$styles" --argjson visible "$visible" \
    --argjson pad "$pad" --argjson themes "$themes" --argjson viewports "$viewports" \
    '{edge: $edge, base: $base, out: $out, selector: $selector, click: $click, visible: $visible,
      styles: ($styles | split(",") | map(select(. != ""))), pad: $pad,
      themes: $themes, viewports: $viewports, urls: $ARGS.positional}' \
    --args "${urls[@]}")

status=0
run_driver "$here/shot.mjs" "$config" | sed "s|^saved=|saved: $out/|" || status=$?
exit "$status"
