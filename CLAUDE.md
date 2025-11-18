@AGENTS.md

# CLAUDE.md

## Tenets

- Never delete any files, directories, or resources. Instead, move them to `$(git rev-parse --show-toplevel)/_tmp` and allow me to clean them up as needed.
- **IMPORTANT** All files should end with a single new line.
- Commit often to make it easier to rollback easily and to have a log of the development journey.
- Write commit messages that match the tone of the project based on the commit history
- **Remember to use your skills**
- **Use subagents to build with concurrency**

## Principles

### Coding

#### General

- **Always strive for simplicity**
- Use tmux for any long running processes so that you don't get stuck waiting for it to return
- Never leave processes running after your result response

#### SQL

2. Always use lowercase

#### Documentation
- **CRITICAL**: Do NOT automatically generate documentation unless explicitly requested
- Do NOT offer to write READMEs, migration guides, changelogs, or example documents unprompted
- Focus on completing the actual task, not documenting it
- If documentation is needed, ask first with a single, brief question
- Keep responses concise and focused on the work requested
- Avoid token waste on unnecessary documentation
