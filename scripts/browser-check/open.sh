#!/usr/bin/env bash
# Opens a folder (default: the check-layout pictures, /tmp/portfolio-checks)
# in the desktop's file manager: Windows Explorer from WSL, the default file
# manager (xdg-open) on Linux, Finder on macOS. Without a desktop it prints
# the path.
set -euo pipefail

dir=${1:-/tmp/portfolio-checks}
[ -d "$dir" ] || { echo "FAIL: no folder $dir (no failures pictured yet?)" >&2; exit 1; }
dir=$(cd "$dir" && pwd)

if command -v wslpath >/dev/null && command -v explorer.exe >/dev/null; then
    # explorer.exe exits 1 even when it opened the folder.
    explorer.exe "$(wslpath -w "$dir")" || true
elif command -v xdg-open >/dev/null && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    xdg-open "$dir" >/dev/null 2>&1 &
elif command -v open >/dev/null && [ "$(uname)" = Darwin ]; then
    open "$dir"
else
    echo "no desktop to open it in; the folder is $dir"
fi
