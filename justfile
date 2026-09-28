# List available recipes
default:
    @just --list

# Install project dependencies
install:
    npm install

# Start the dev server in the background
dev:
    astro dev --background

# Stop the background dev server
dev-stop:
    astro dev stop

# Show whether the background dev server is running
dev-status:
    astro dev status

# Tail logs from the background dev server
dev-logs:
    astro dev logs

# Build the site for production
build:
    astro build

# Preview the production build locally
preview:
    astro preview

# Screenshot pages in a headless Windows Edge (see scripts/browser-check/README.md)
[positional-arguments]
shot *args:
    scripts/browser-check/shot.sh "$@"

# Check the layout rules (scripts/browser-check/rules.mjs) on every page at
# phone, tablet and desktop widths, against a fresh build
[positional-arguments]
check-layout *args:
    scripts/browser-check/check-layout.sh "$@"

# Open the pictures of the last check-layout failures (or another folder) in
# the file manager: Explorer on WSL, xdg-open on Linux
[positional-arguments]
check-pictures *args:
    scripts/browser-check/open.sh "$@"

# Sync the GitHub mirror (tarc/portfolio) from Codeberg now and wait until
# GitHub's main matches. Run after pushing: Codeberg otherwise only syncs
# every 8 hours. Needs tea's `codeberg` login.
sync-mirror:
    scripts/sync-mirror/sync.sh

# Redeploy the contact form function to Deno Deploy. Org/app are already
# recorded in deno.jsonc from the initial `deno deploy create`, so this just
# uploads server/contact and promotes it straight to production.
deploy-contact:
    deno deploy server/contact --prod

# One-time setup: store the curriculum repo access token in your local OS
# keyring. The secret is declared in secretspec.toml (CODEBERG_CURRICULUM_TOKEN)
# but intentionally NOT wired into devenv.nix's env, since devenv eagerly
# validates secrets on every shell entry, which would require a --reason for
# unrelated commands (e.g. `just build`). Fetch it on demand instead with:
#   secretspec run --profile default --provider keyring --reason "<why>" -- <command>
set-curriculum-token:
    devenv shell -- secretspec set CODEBERG_CURRICULUM_TOKEN --provider keyring --profile default
