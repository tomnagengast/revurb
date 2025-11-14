last commit: 7ef3cbcbab4d16db4f16f68340ff90142112f61d
status: ok
review comments:
- .github/workflows/spec-tests.yml now calls the workflow \"specification tests\" but preserves every job/step, so CI behavior is unchanged.
- Ralph prompts, backlog, and current-priority docs were refreshed to mark the Redis spec as complete and to point builders/reviewers at the latest Codex logs; no runtime code was touched.
- Historical Codex review logs were removed from specs/logs (they continue to live in git history/ignored archives) which reduces repo noise without affecting the application.
