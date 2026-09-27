#!/usr/bin/env bash
# Screenshots pages of the site in a headless Windows Edge, from WSL2.
#
#   shot.sh [options] PATH_OR_URL...
#       --theme=light|dark|both      (default both)
#       --viewport=desktop|mobile|both|WIDTHxHEIGHT   (default desktop)
#       --selector=CSS               shoot only the first matching element
#       --pad=PX                     margin around --selector (default 24)
#       --click=CSS                  click this element first (a real click)
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
die() { echo "FAIL: $*" >&2; exit 1; }
usage() { sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

base=http://localhost:4321
out=/tmp/portfolio-shots
themes='["light","dark"]'
viewport=desktop
selector='' click='' styles='' pad=24
urls=()
for argument in "$@"; do
    case $argument in
        --theme=light | --theme=dark) themes="[\"${argument#--theme=}\"]" ;;
        --theme=both) themes='["light","dark"]' ;;
        --viewport=?*) viewport=${argument#--viewport=} ;;
        --selector=?*) selector=${argument#--selector=} ;;
        --pad=?*) pad=${argument#--pad=} ;;
        --click=?*) click=${argument#--click=} ;;
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

command -v jq >/dev/null || die "jq is missing; run inside devenv shell"
command -v powershell.exe >/dev/null || die "no Windows interop; this needs WSL2"

# Windows Edge reaches the WSL server through localhost forwarding; check the
# server is up at all first, so a stopped server is not reported as an Edge error.
curl -s -o /dev/null --max-time 5 "$base" || die "nothing answers at $base; start the server (astro dev --background, or astro preview)"

edge=''
for candidate in 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'; do
    [ -f "$(wslpath "$candidate")" ] && edge=$candidate && break
done
[ -n "$edge" ] || die "Microsoft Edge is not installed on Windows"

node=${PORTFOLIO_WINDOWS_NODE:-$(powershell.exe -NoProfile -Command '(Get-Command node -ErrorAction SilentlyContinue).Source' </dev/null | tr -d '\r')}
[ -n "$node" ] || die "Node is not installed on Windows (or set PORTFOLIO_WINDOWS_NODE to node.exe's Windows path)"

mkdir -p "$out"
config=$(jq -n -c \
    --arg edge "$edge" --arg base "$base" --arg out "$(wslpath -w "$out")" \
    --arg selector "$selector" --arg click "$click" --arg styles "$styles" \
    --argjson pad "$pad" --argjson themes "$themes" --argjson viewports "$viewports" \
    '{edge: $edge, base: $base, out: $out, selector: $selector, click: $click,
      styles: ($styles | split(",") | map(select(. != ""))), pad: $pad,
      themes: $themes, viewports: $viewports, urls: $ARGS.positional}' \
    --args "${urls[@]}")

status=0
"$(wslpath "$node")" "$(wslpath -w "$here/shot.mjs")" --config="$(printf '%s' "$config" | base64 -w0)" |
    tr -d '\r' | sed "s|^saved=|saved: $out/|" || status=$?
exit "$status"
