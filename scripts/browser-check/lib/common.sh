# Shell helpers shared by the browser-check scripts; source it. Finds Edge
# and Windows' Node, checks the server answers, and runs a driver script
# under Windows' Node.

die() { echo "FAIL: $*" >&2; exit 1; }

# Checks the tools every script needs and sets $edge and $node to the Windows
# paths of msedge.exe and node.exe.
find_windows_tools() {
    command -v jq >/dev/null || die "jq is missing; run inside devenv shell"
    command -v powershell.exe >/dev/null || die "no Windows interop; this needs WSL2"

    edge=''
    local candidate
    for candidate in 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'; do
        [ -f "$(wslpath "$candidate")" ] && edge=$candidate && break
    done
    [ -n "$edge" ] || die "Microsoft Edge is not installed on Windows"

    node=${PORTFOLIO_WINDOWS_NODE:-$(powershell.exe -NoProfile -Command '(Get-Command node -ErrorAction SilentlyContinue).Source' </dev/null | tr -d '\r')}
    [ -n "$node" ] || die "Node is not installed on Windows (or set PORTFOLIO_WINDOWS_NODE to node.exe's Windows path)"
}

# Windows Edge reaches the WSL server through localhost forwarding; check the
# server is up at all first, so a stopped server is not reported as an Edge error.
check_server() {
    curl -s -o /dev/null --max-time 5 "$1" || die "nothing answers at $1; start the server (astro dev --background, or astro preview)"
}

# run_driver SCRIPT CONFIG_JSON: runs SCRIPT (a WSL path) under Windows' Node
# with --config=CONFIG_JSON base64-encoded (quotes do not survive WSL
# interop). Output comes back with Windows line endings stripped; returns the
# driver's exit status.
run_driver() {
    "$(wslpath "$node")" "$(wslpath -w "$1")" --config="$(printf '%s' "$2" | base64 -w0)" | tr -d '\r'
    return "${PIPESTATUS[0]}"
}
