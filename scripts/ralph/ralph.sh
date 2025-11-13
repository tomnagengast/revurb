#!/bin/bash
set -eo pipefail

loop=1

while :; do
  echo -e "==== 👾 ($loop) ====\n"
  bash scripts/ralph/sync.sh $loop
  echo -e "==== 😴 ($loop) ====\n"
  loop=$((loop + 1))
  sleep 10
done
