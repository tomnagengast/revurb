## IMPORTANT

- Try to keep things in one function unless composable or reusable
- DO NOT do unnecessary destructuring of variables
- DO NOT use `else` statements unless necessary
- DO NOT use `try`/`catch` if it can be avoided
- AVOID `try`/`catch` where possible
- AVOID `else` statements
- AVOID using `any` type
- AVOID `let` statements
- PREFER single word variable names where possible
- Use as many Bun APIs as possible like Bun.file() and Bun.env (see https://bun.com/reference/bun)

## Top of Mind

- Align the phrasing and prose of ./revurb-ts/docs.md to ./docs/docs.md as close as possible while ensuring ./revurb-ts/docs.md is accurate and appropriate for typescript
- Use Docker for testing services like Redis where mock are not sufficient

## Tool Calling

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.