#!/usr/bin/env bash

root=$(git rev-parse --show-toplevel)

git ls-files

cat $root/README.md
cat $root/AGENTS.md
cat $HOME/.claude/CLAUDE.md

tree -I logs -I notes .ralph
