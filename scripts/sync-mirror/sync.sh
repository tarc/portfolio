#!/usr/bin/env bash
# Syncs the GitHub mirror (tarc/portfolio) from Codeberg (tarcisio/pages) now,
# instead of waiting for Codeberg's 8-hour schedule, and waits until GitHub's
# main matches Codeberg's. Needs tea's `codeberg` login (~/.config/tea).
set -euo pipefail

codeberg=https://codeberg.org/tarcisio/pages.git
github=https://github.com/tarc/portfolio.git
api=/repos/tarcisio/pages/push_mirrors

want=$(git ls-remote "$codeberg" refs/heads/main | cut -f1)
have=$(git ls-remote "$github" refs/heads/main | cut -f1)
if [ "$have" = "$want" ]; then
  echo "GitHub mirror already at $want"
  exit 0
fi

tea api --login codeberg -X POST "$api-sync" >/dev/null

for _ in $(seq 30); do
  sleep 2
  have=$(git ls-remote "$github" refs/heads/main | cut -f1)
  if [ "$have" = "$want" ]; then
    echo "GitHub mirror at $want"
    exit 0
  fi
done

echo "GitHub main still at ${have:-nothing}, Codeberg's at $want" >&2
echo "Codeberg's mirror status:" >&2
tea api --login codeberg "$api" | jq -r '.[] | "  \(.remote_address): last update \(.last_update), last error: \(.last_error // "none")"' >&2
exit 1
