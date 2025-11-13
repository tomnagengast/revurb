#!/bin/bash

# SPEC=$1
echo "
$(cat scripts/ralph/prompt-fast.md)
" | \
  a | \
  tee -a specs/logs/ralph-$(date +%Y-%m-%d-%H%M).jsonl

echo "
$(cat scripts/ralph/prompt-smart.md)
" | \
  codex --yolo exec --skip-git-repo-check -o ./specs/logs/codex-$(date +%Y-%m-%d-%H%M).md
