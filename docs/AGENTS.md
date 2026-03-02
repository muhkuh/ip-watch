# Agents.md
 
## Purpose
This document defines the operating constraints for work in this repository. It establishes clear expectations for process, quality, and boundaries.
 
## Language Requirement
All documents must be written in English.
 
## files
db\dump.sql
docker
 
## Scope
Applies to all changes in the repo, including code, tests, build scripts, and configuration.

### API for this project
[DEGX Api](../degx-api)
 
## Working Style
- Prefer small, reviewable changes with clear rationale.
- Avoid silent assumptions: call out ambiguities and ask.
- No destructive actions without explicit approval.
 
## Quality & Tests
- Run relevant tests when logic changes.
- If tests cannot be run, state why and assess risk.
- Do not introduce new build warnings or errors.
 
## Code Standards
- Respect existing patterns and architecture.
- Keep naming and formatting consistent.
- Add comments only when logic would otherwise be unclear.

## Documentation and comments
### Documentation
Always document any new function, class, service, model etc.
Use the language specific doc specification.
Always, if needed and supported, add:
- version
- package
- created/updated timestamp
- function description, 
- attribute/param description
- any other description if needed

Use as author:
1. Frank Ortner <f.ortner@iseo.de>
2. Stefan Behnert <s.behnert@iseo.de>

### Comments
Always comment, if you think the line is too complex. Use above pattern from documentation area if needed.
 
## Security & Privacy
- No secrets in code or logs.
- Do not change security-sensitive defaults without confirmation.
- Mask sensitive data.
 
## Dependencies & Infrastructure
- Add new dependencies only when clearly necessary.
- Do not integrate external services without confirmation.
 
## Reporting Results
- Briefly summarize what changed.
- Call out risks, open questions, and next steps.
 
## Definition of Done
- Changes are minimal, tested (or explicitly justified if untested), and documented.
- No unintended side effects.
 
## Updates
This document is living. Please update it when new constraints arise.