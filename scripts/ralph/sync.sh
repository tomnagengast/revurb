#!/bin/bash
set -eo pipefail

prompt="$(<scripts/ralph/prompt-fast.md)"
out="specs/logs/codex-$(date +%Y-%m-%d-%H%M).md"

bun run .claude/hooks/discord.ts --start --message "$prompt"

# Thanks https://github.com/johnlindquist/cursor-alias
A_MARKDOWN=1 A_LOG_FILE="specs/logs/composer-$(date +%Y-%m-%d-%H%M).md" a --force "$prompt"

cat scripts/ralph/prompt-smart.md | \
    codex --yolo exec --skip-git-repo-check \
    --model gpt-5-codex \
    --output-last-message $out \

bun run .claude/hooks/discord.ts --stop --message "$(<$out)"
