# Review Fixes - 2025-01-27

## Review Status
- **Status**: `not ok` → Fixed
- **Review File**: `./specs/review.md`

## Issues Addressed

### 1. RedisClientFactory.createClient() Visibility
**Issue**: The comment said integrators can "override createClient" to swap in a real Redis library, but the method was declared `private` so it could not be overridden.

**Fix**: Changed `createClient()` from `private` to `protected` so it can be overridden in subclasses.

**Files Changed**:
- `revurb-ts/src/Servers/Reverb/Publishing/redis-client-factory.ts`

**Changes**:
- Changed method visibility from `private` to `protected`
- Added comprehensive documentation with example code showing how to extend the class
- Added `@protected` JSDoc tag

### 2. Redis Pub/Sub Mock Implementation Documentation
**Issue**: The factory returns a no-op object whose publish/subscribe/on methods never touch Redis, yet the session report marked the port as "production ready" with Redis pub/sub working. In reality Redis-backed broadcasting cannot work at all.

**Fix**: Updated all documentation to clearly flag the Redis pub/sub feature as incomplete/non-production-ready.

**Files Changed**:
- `revurb-ts/src/Servers/Reverb/Publishing/redis-client-factory.ts`
- `revurb-ts/README.md`
- `revurb-ts/agent/SESSION_STATUS_2025-01-27.md`

**Changes**:
- Added clear warnings in code comments that the default implementation is a NO-OP mock
- Updated class-level documentation with prominent warnings
- Updated README to mark Redis Pub/Sub as "Mock implementation (not production-ready)"
- Updated session status document to reflect limitations
- Added "Known Limitations" section to session status

## Summary

Both review comments have been addressed:
1. ✅ `createClient()` is now `protected` and can be overridden
2. ✅ All documentation clearly indicates Redis pub/sub is a no-op mock and not production-ready for multi-server deployments

The codebase now accurately reflects that:
- Single-server deployments work fine (no Redis needed)
- Multi-server deployments requiring Redis must extend `RedisClientFactory` and override `createClient()` to use a real Redis client library

## Testing
- ✅ All 89 tests passing
- ✅ No TypeScript compilation errors
- ✅ No breaking changes to existing functionality

## Commits
1. `fix: make createClient protected and clarify Redis mock implementation`
2. `docs: update README to reflect Redis pub/sub limitations`
3. `docs: update session status to reflect Redis pub/sub issues`
