# Build Task

Implement a task directly without creating a plan first.

## Variables

task_description: $ARGUMENTS

## Instructions

1. **Seed Spec Context**: If a specs was referenced, read it it in full
2. **Prime Project Context**: Read and execute `.claude/commands/prime.md` to understand the codebase
3. **Analyze Task**: Carefully read and understand the task description, including all referenced files and links
4. **Implement Solution**: Think hard and then directly implement the solution for the task
5. **Validate Work**: Ensure the implementation is complete and working
6. **Report Results**: Summarize what was done

## Setup Phase

Before implementing the task:

- Execute the prime command to understand the codebase structure
- Read relevant documentation files (`./README.md`, etc.)
- Understand the existing patterns and conventions

## Implementation Guidelines

- Follow existing code patterns and conventions
- Use the libraries and frameworks already in the codebase
- Write clean, maintainable code
- Add appropriate error handling
- Follow security best practices

## Task Description

task_description

## Expected Actions

1. **Research**: Understand the codebase and task requirements
2. **Implement**: Dispatch builder subagents to make the necessary changes to complete the task
3. **Test**: Verify the implementation works as expected
4. **Commit**: Create a meaningful commit with the changes

## Validation

1. If the Codex CLI is available, use it to review the work done by passing it relevant context for validation (spec path or description, relevant git commits, etc.)
   - `codex --yolo exec --skip-git-repo-check -o ./specs/logs/$(date +%Y-%m-%d)-codex-<spec_slug>.md "<task>"`
2. If the agent response with blocking changes or low-lift follow ups, start again from the top to address them. Otherwise, continue to `Report`.

## Report

After completing the implementation:

- Summarize the work done in clear bullet points
- List all files created or modified
- Report the total lines changed with `git diff --stat`
- Note any important decisions or trade-offs made
- Highlight any follow-up tasks that may be needed
