# Application Architecture Analysis - Document Index

This folder contains comprehensive documentation of the Reverb application architecture, including multi-tenancy support, connection limits, origin validation, and application provider interface.

## Documents Overview

### 1. application-architecture.md (24 KB)
**Comprehensive Technical Documentation**

The primary detailed reference covering:
- Core component descriptions and responsibilities
- Multi-tenancy support mechanisms
- Connection limit enforcement (per-application quotas)
- Origin validation with glob pattern matching
- Application provider interface and extensibility
- Complete TypeScript implementation guide with code examples
- Data flow diagrams
- Configuration schema
- Error handling hierarchy

**Best for**: Deep technical understanding, implementation planning, code review

**Key Sections**:
- Core Components (5 main classes)
- Multi-Tenancy Model (isolation, resolution, lifecycle)
- Connection Limits (enforcement points, configuration)
- Origin Validation (validation flow, pattern matching)
- Application Provider Interface (contract, implementation pattern, extension)
- TypeScript Implementation Guide (types, interfaces, error handling)

### 2. application-architecture-summary.md (12 KB)
**Executive Summary and Analysis Results**

Focused analysis document providing:
- Analysis results for each of the 4 required areas
- Configuration schema reference
- Connection lifecycle walkthrough
- Design patterns used in the codebase
- Extension points for customization
- Files analyzed (13 source files, 800+ lines)
- TypeScript implementation considerations

**Best for**: Quick understanding, design review, architectural decisions

**Key Sections**:
- Application Structure & Configuration (immutable value object)
- Multi-Tenancy Support (isolation level, resolution flow)
- Connection Limits & Origin Validation (enforcement details)
- Application Provider Interface (contract & implementations)
- Design Patterns (5 key patterns identified)
- Extension Points & Configuration

### 3. application-architecture-quick-reference.md (12 KB)
**Quick Lookup Guide and Cheat Sheet**

Fast reference material including:
- Component overview table
- Multi-tenancy model diagram
- Error codes reference
- Configuration structure template
- Design pattern mapping
- TypeScript equivalents
- Custom provider example (database-backed)
- Common operations code snippets
- Testing patterns
- Performance and security considerations
- Priority order for TypeScript porting

**Best for**: Development reference, quick lookups, copy-paste examples

**Key Sections**:
- Component Overview Table
- Connection Limits & Origin Validation Quick Reference
- Error Codes
- Configuration Structure
- Design Pattern Mapping
- TypeScript Equivalents
- Custom Provider Example
- Porting Priority Order

## Analysis Scope

### Files Analyzed (13 total)

**Core Application Management**:
1. `/src/Application.php` - Immutable application config (125 lines)
2. `/src/ApplicationManager.php` - Driver manager (27 lines)
3. `/src/ConfigApplicationProvider.php` - Config resolver (77 lines)
4. `/src/Contracts/ApplicationProvider.php` - Provider interface (31 lines)
5. `/src/ApplicationManagerServiceProvider.php` - DI registration (34 lines)

**Connection Validation**:
6. `/src/Protocols/Pusher/Server.php` - Origin validation & limits (179 lines)
7. `/src/Contracts/Connection.php` - Connection contract (169 lines)
8. `/src/Connection.php` - Connection implementation (70 lines)

**Error Handling**:
9. `/src/Exceptions/InvalidOrigin.php` - App-level exception (16 lines)
10. `/src/Protocols/Pusher/Exceptions/InvalidOrigin.php` - Protocol exception (21 lines)
11. `/src/Protocols/Pusher/Exceptions/ConnectionLimitExceeded.php` - Limit exception (21 lines)

**Configuration & Testing**:
12. `/config/reverb.php` - Config schema (95 lines)
13. `/tests/FakeApplicationProvider.php` - Test implementation (63 lines)

**Total**: 828 lines analyzed

### Analysis Depth: MEDIUM

Exploration covered:
- All core application resolution components
- Multi-tenant isolation mechanisms
- Connection validation enforcement
- Error handling hierarchy
- Configuration schema
- Service provider registration
- Test implementations

## Key Findings

### 1. Application Architecture

The Application class uses an immutable value object pattern with:
- Identity properties (id, key, secret)
- Health parameters (ping interval, activity timeout)
- Resource constraints (max connections, max message size)
- Access control (allowed origins)
- Extensible options dictionary

**Critical**: All properties are protected and read-only, ensuring configuration consistency.

### 2. Multi-Tenancy Model

- **Single Server**: Hosts multiple independent applications
- **Complete Isolation**: Connections, channels, and resources are per-app
- **Dynamic Resolution**: ApplicationProvider pattern allows flexible application lookup
- **Per-App Configuration**: Each application can have different settings

**Flow**: URL → ApplicationProvider.findByKey() → Application Instance → Connection Binding

### 3. Connection Limits

- **Per-Application Quotas**: Independent limit for each app (optional, null = unlimited)
- **Enforcement**: Checked on connection open via `ensureWithinConnectionLimit()`
- **Error Code**: 4004 (Pusher protocol standard)
- **Behavior**: Prevents new connections when at quota

### 4. Origin Validation

- **Per-Application Allowlist**: Independent allowed origins for each app
- **Pattern Support**: Glob patterns (*.example.com), exact matches (localhost), wildcard (*)
- **Enforcement**: Checked on connection open via `verifyOrigin()`
- **Error Code**: 4009 (Pusher protocol standard)
- **Behavior**: Prevents cross-origin connections not in allowlist

### 5. Application Provider Interface

- **Contract**: `all()`, `findById()`, `findByKey()`
- **Default Implementation**: ConfigApplicationProvider (loads from config/reverb.php)
- **Extensibility**: Custom providers can be registered (e.g., database-backed)
- **Registration**: Via ApplicationManager driver pattern + service container

## Design Patterns Identified

1. **Value Object** (Application) - Immutable configuration
2. **Manager** (ApplicationManager) - Driver pattern
3. **Provider** (ApplicationProvider) - Strategy pattern
4. **Dependency Injection** - Service provider registration
5. **Chain of Responsibility** - Connection validation pipeline

## TypeScript Implementation Strategy

### Priority Order

1. **High Priority** - Core logic
   - Application class (immutable)
   - ApplicationProvider interface
   - ConfigApplicationProvider implementation

2. **Medium Priority** - Integration
   - ApplicationManager (driver registry)
   - PusherServer validation (connection limits & origin)
   - Error/Exception classes

3. **Low Priority** - Infrastructure
   - ApplicationManagerServiceProvider (DI registration)

### Key Considerations

- Use private fields for immutability
- Implement Promise-based async methods
- Convert glob patterns to regex matching
- Use TypeScript Map for driver registry
- Error classes extend Error with code property
- Configuration objects should be typed

## Usage Guide

### For Developers

1. Start with **quick-reference.md** for component overview
2. Refer to **summary.md** for design pattern understanding
3. Deep dive with **architecture.md** for implementation details

### For TypeScript Migration

1. Review **summary.md** "TypeScript Implementation Considerations"
2. Follow priority order in **quick-reference.md**
3. Use TypeScript code examples in **architecture.md**

### For Adding Custom Providers

1. Review "Application Provider Interface" in **summary.md**
2. See database provider example in **quick-reference.md**
3. Reference full extension section in **architecture.md**

## Related Files (Not Analyzed)

These files interact with the analyzed components but were not deeply analyzed:
- `/src/Servers/Reverb/Factory.php` - Server instantiation
- `/src/Protocols/Pusher/Http/Controllers/` - HTTP controllers
- `/src/Protocols/Pusher/Managers/` - Channel management
- Job and event classes

## Cross-References

### Configuration Files
- `config/reverb.php` - Application and server configuration

### Testing
- `tests/FakeApplicationProvider.php` - Test provider implementation
- `tests/Specification/` - Test specifications

### Related Architecture
- Channel management system (separate from application management)
- Event handling system (uses applications for routing)
- Pub/Sub system (Redis-based scaling across servers)

## Next Steps

### If Porting to TypeScript

1. Set up TypeScript project structure
2. Port core Application class first
3. Implement ApplicationProvider interface
4. Add ConfigApplicationProvider implementation
5. Integrate with connection handling
6. Add tests using FakeApplicationProvider pattern

### If Extending Functionality

1. Review extension points in **summary.md**
2. Implement ApplicationProvider interface
3. Register custom provider with ApplicationManager
4. Configure in reverb config

### If Troubleshooting

1. Check error codes in **quick-reference.md**
2. Review connection validation flow in **summary.md**
3. Trace resolution flow in **architecture.md** data flow diagrams

## Document Maintenance

These documents capture the application architecture as of:
- **Analysis Date**: 2025-11-12
- **Source Version**: Reverb main branch
- **Analysis Scope**: Medium exploration (13 files, 828 lines)

Update this index if architecture changes significantly.
