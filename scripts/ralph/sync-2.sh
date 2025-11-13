#!/bin/bash

# SPEC=$1
echo "
$(cat scripts/ralph/prompt.md)
" | \
  claude -p --output-format=stream-json --verbose --dangerously-skip-permissions --add-dir /tmp/test-revurb | \
  tee -a specs/logs/ralph-$(date +%Y-%m-%d-%H%M).jsonl | \
  bunx repomirror visualize --debug
