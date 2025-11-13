#!/bin/bash
set -euo pipefail

loop=1

while :; do
  echo -e "==== 👾 ($loop) ====\n"
  bash scripts/ralph/sync.sh $loop
  echo -e "==== 😴 ($loop) ====\n"
  loop=$((loop + 1))
  [ "$(date +%H%M)" -ge 0030 ] && [ "$(date +%H)" -eq 0 ] && exit 0 # close up shop if its after 12:30AM
  sleep 10
done
