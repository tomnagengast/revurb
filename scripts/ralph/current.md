# Current Priorities

## Active: Test Coverage Improvements

**Priority**: HIGH
**Source**: notes/2025-11-14-0554-next-priorities.md
**Started**: 2025-11-14

### Objective
Fix e2e test configuration issues and improve overall test coverage to harden the codebase for production use.

### Tasks
1. [ ] Fix `InvalidApplication` errors in e2e tests (test configuration issue)
2. [ ] Add feature tests for HTTP controllers (events, channels, connections controllers)
3. [ ] Add integration tests for Redis pub/sub functionality
4. [ ] Add tests for TLS/SSL configuration scenarios
5. [ ] Add tests for multi-application configurations
6. [ ] Improve test fixtures and shared test utilities
7. [ ] Verify test coverage metrics and identify remaining gaps

### Success Criteria
- All e2e tests pass without configuration errors
- HTTP controllers have comprehensive feature test coverage
- Redis pub/sub has integration tests proving multi-server sync
- Test coverage > 80% for critical paths
- Zero flaky tests

### Notes
- Current status: 89/89 tests passing, but some e2e tests show configuration-related errors in output
- This is foundational work that enables confident future development
- Focus on quality over speed - comprehensive tests pay dividends

---

## Completed

✅ specs/2025-11-13-2057-implement-server-factory.md (commit 386e871)
