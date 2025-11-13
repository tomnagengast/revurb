#!/bin/bash
# scripts/ralph/ralph.sh specs/2025-11-12-1232-convert-to-typescript.md

ralph_loop=1
while :; do
  bash scripts/ralph/sync.sh $spec
  echo -e "==== 😴 ====\n"
  sleep 10
  echo -e "==== 👾 ====\n"
  ralph_loop=$((ralph_loop + 1))
done
