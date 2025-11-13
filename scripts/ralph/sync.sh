#!/bin/bash

# spec=$1
prompt="$(<scripts/ralph/prompt-fast.md)"

FORCE_COLOR=1 A_MARKDOWN=1 \
  a "$prompt" > "specs/logs/ralph-$(date +%Y-%m-%d-%H%M).md" 2>&1

echo "
$(cat scripts/ralph/prompt-smart.md)
" | codex --yolo exec --skip-git-repo-check -o ./specs/logs/codex-$(date +%Y-%m-%d-%H%M).md
