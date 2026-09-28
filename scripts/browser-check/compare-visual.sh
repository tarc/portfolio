#!/usr/bin/env bash
# Compares the screenshots in DIR/latest with those in DIR/reference, writes
# the differences to DIR/diff and a report to DIR/report.html, and prints a
# summary. Run by check-visual.sh; needs ImageMagick (6 or 7).
#
#   compare-visual.sh DIR [--full]
#       --full   the latest set covers every page, size and theme, so a
#                reference without a latest shot is reported as missing
#
# Classes: same (no pixel differs beyond 1% colour fuzz), changed, new (no
# reference), missing. Two runs of an unchanged site match exactly, so even
# a few pixels count: a threshold in percent hid a recoloured footer line
# on the longer pages. When the heights differ, both are padded to
# the larger size (magenta) and the change of size is reported.
set -euo pipefail

die() { echo "FAIL: $*" >&2; exit 1; }
dir=${1:?usage: compare-visual.sh DIR [--full]}
full=${2:-}
ref=$dir/reference latest=$dir/latest diffs=$dir/diff

# ImageMagick 7 has one command, magick; 6 has compare, convert, identify.
if command -v magick >/dev/null; then
    im_compare=(magick compare) im_convert=(magick) im_identify=(magick identify)
elif command -v compare >/dev/null; then
    im_compare=(compare) im_convert=(convert) im_identify=(identify)
else
    die "ImageMagick is missing; run inside devenv shell"
fi

compgen -G "$ref/*.png" >/dev/null || die "no reference set in $ref; record one with: just check-visual --record"
rm -rf "$diffs"
mkdir -p "$diffs"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# name -> size WxH
size() { "${im_identify[@]}" -format '%wx%h' "$1"; }

rows=() same=() changed=0 new=0 missing=0 total=0
# <page>-<size>-<theme>.png, for the terminal columns
split() {
    [[ $1 =~ ^(.+)-(phone-320|phone-390|tablet-768|desktop-1280)-(light|dark)$ ]] \
        && printf '%s\t%s\t%s' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}" \
        || printf '%s\t\t' "$1"
}

for shot in "$latest"/*.png; do
    [ -e "$shot" ] || continue
    name=$(basename "$shot" .png)
    total=$((total + 1))
    if [ ! -e "$ref/$name.png" ]; then
        new=$((new + 1))
        rows+=("new	$name	-	")
        continue
    fi
    a=$ref/$name.png b=$shot note=''
    sa=$(size "$a") sb=$(size "$b")
    if [ "$sa" != "$sb" ]; then
        w=$(( ${sa%x*} > ${sb%x*} ? ${sa%x*} : ${sb%x*} ))
        h=$(( ${sa#*x} > ${sb#*x} ? ${sa#*x} : ${sb#*x} ))
        "${im_convert[@]}" "$a" -background '#ff00ff' -gravity northwest -extent "${w}x${h}" "$work/a.png"
        "${im_convert[@]}" "$b" -background '#ff00ff' -gravity northwest -extent "${w}x${h}" "$work/b.png"
        a=$work/a.png b=$work/b.png
        note="size $sa → $sb"
    fi
    # compare prints the count of differing pixels on stderr and exits 1
    # when they differ, 2 on error.
    status=0
    count=$("${im_compare[@]}" -metric AE -fuzz 1% "$a" "$b" "$diffs/$name.png" 2>&1 >/dev/null) || status=$?
    [ "$status" -le 1 ] || die "comparing $name: $count"
    s=$(size "$a")
    pixels=$(awk -v c="${count%% *}" 'BEGIN { printf "%d", c }')
    percent=$(awk -v c="$pixels" -v w="${s%x*}" -v h="${s#*x}" 'BEGIN { printf "%.2f", 100 * c / (w * h) }')
    if [ -z "$note" ] && [ "$pixels" -eq 0 ]; then
        same+=("$name")
        rm -f "$diffs/$name.png"
    else
        changed=$((changed + 1))
        rows+=("changed	$name	$percent	$pixels px${note:+, $note}")
    fi
done

if [ "$full" = --full ]; then
    for shot in "$ref"/*.png; do
        name=$(basename "$shot" .png)
        [ -e "$latest/$name.png" ] && continue
        missing=$((missing + 1))
        rows+=("missing	$name	-	")
    done
fi

# The rows by class, then largest change first.
sorted_rows() { [ ${#rows[@]} -eq 0 ] || printf '%s\n' "${rows[@]}" | sort -t$'\t' -k1,1 -k3,3gr; }

# Terminal: changes only.
echo "visual: $total shots — ${#same[@]} same, $changed changed, $new new$([ "$full" = --full ] && echo ", $missing missing")"
sorted_rows | while IFS=$'\t' read -r class name percent note; do
    IFS=$'\t' read -r page viewport theme <<<"$(split "$name")"
    printf '%-8s %-26s %-13s %-5s %7s  %s\n' "${class^^}" "$page" "$viewport" "$theme" \
        "$([ "$percent" = - ] || echo "$percent%")" "$note"
done

# report.html: reference, latest and difference side by side for each change.
{
    cat <<'EOF'
<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Visual comparison</title>
<style>
:root { color-scheme: light dark; --bg: #f3f4f6; --fg: #111827; --muted: #6b7280; --card: #fff; --line: #d1d5db; --accent: #dc2626; }
@media (prefers-color-scheme: dark) { :root { --bg: #111827; --fg: #f3f4f6; --muted: #9ca3af; --card: #1f2937; --line: #374151; } }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font: 14px/1.4 system-ui, sans-serif; }
h1 { font-size: 20px; margin: 0 0 4px; } p { margin: 0 0 16px; color: var(--muted); }
section { background: var(--card); border: 1px solid var(--line); padding: 12px; margin-bottom: 16px; }
h2 { font-size: 15px; margin: 0 0 8px; } h2 span { color: var(--accent); font-weight: 600; margin-left: 8px; }
.row { display: flex; gap: 12px; overflow-x: auto; align-items: flex-start; }
figure { margin: 0; flex: 0 0 auto; } figcaption { color: var(--muted); margin-bottom: 4px; }
img { display: block; max-width: min(420px, 80vw); border: 1px solid var(--line); }
details { color: var(--muted); }
</style>
EOF
    echo "<h1>Visual comparison</h1><p>$total shots: ${#same[@]} same, $changed changed, $new new$([ "$full" = --full ] && echo ", $missing missing"). Click an image to open it full size.</p>"
    sorted_rows | while IFS=$'\t' read -r class name percent note; do
        echo "<section><h2>$name<span>$class$([ "$percent" = - ] || echo " $percent%")$([ -n "$note" ] && echo ", $note")</span></h2><div class=\"row\">"
        [ "$class" = new ] || echo "<figure><figcaption>reference</figcaption><a href=\"reference/$name.png\"><img src=\"reference/$name.png\" alt=\"\"></a></figure>"
        [ "$class" = missing ] || echo "<figure><figcaption>latest</figcaption><a href=\"latest/$name.png\"><img src=\"latest/$name.png\" alt=\"\"></a></figure>"
        [ "$class" = changed ] && echo "<figure><figcaption>difference (red)</figcaption><a href=\"diff/$name.png\"><img src=\"diff/$name.png\" alt=\"\"></a></figure>"
        echo "</div></section>"
    done
    [ ${#same[@]} -eq 0 ] || echo "<details><summary>${#same[@]} same</summary><p>$(printf '%s ' "${same[@]}")</p></details>"
} >"$dir/report.html"
echo "report: $dir/report.html"
