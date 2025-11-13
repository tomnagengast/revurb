#!/bin/bash
set -eo pipefail

prompt="$(<scripts/ralph/prompt-fast.md)"
out="specs/logs/codex-$(date +%Y-%m-%d-%H%M).md"

function cursor() {
    # Thanks https://github.com/johnlindquist/cursor-alias
    A_MARKDOWN=1 \
    A_LOG_FILE="specs/logs/composer-$(date +%Y-%m-%d-%H%M).md" \
    a --force "$1"
}

function codex() {
    cat scripts/ralph/prompt-smart.md | \
        command codex --yolo exec --skip-git-repo-check \
        --output-last-message "$1"
}

function claude() {
    printf "%s" "$1" | \
        command claude -p --output-format=stream-json --verbose --dangerously-skip-permissions | \
        tee -a _tmp/ralph/claude_output.jsonl | \
        npx repomirror visualize --debug
}

# Make sure directories exist
mkdir -p specs/logs _tmp/ralph

git pull origin main || {
  git stash -q --include-untracked || true
  git pull origin main
  git stash pop -q || true
}

bun run .claude/hooks/discord.ts --start --message "$prompt"

cursor "$prompt"
# claude "$prompt"
codex "$out"

bun run .claude/hooks/discord.ts --stop --message "$(<"$out")"
