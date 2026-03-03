# Planning Framework

Use this file as the active planning template for project work.
Legacy project plans are stored in [`archive/`](archive).

## 1. Lifecycle
1. Discovery
2. Decision
3. Implementation
4. Verification
5. Rollout

### 1) Discovery
Capture:
- Problem statement
- Users and stakeholders
- Current state and constraints
- Known unknowns and assumptions

### 2) Decision
Capture:
- Chosen approach
- Rejected alternatives with reasons
- Risks and mitigations
- Scope boundaries (in/out)

### 3) Implementation
Capture:
- Work breakdown by deliverable
- Dependencies and sequencing
- Interfaces/contracts to create or change
- Migration/backward compatibility considerations

### 4) Verification
Capture:
- Test strategy (unit/integration/e2e)
- Acceptance criteria
- Non-functional checks (performance, security, reliability)

### 5) Rollout
Capture:
- Deployment plan
- Monitoring plan
- Rollback strategy
- Post-release validation

## 2. Definition of Ready (DoR) Template
A work item is ready when:
- Goal and business value are clear.
- Scope and non-goals are explicit.
- Dependencies are identified.
- Acceptance criteria are testable.
- Risks/assumptions are documented.

## 3. Definition of Done (DoD) Template
A work item is done when:
- Implementation matches scope and acceptance criteria.
- Relevant tests are added/updated and executed.
- Documentation is updated.
- Rollback/recovery approach is known.
- No unresolved high-severity risks remain.

## 4. Risk Register Template
Use one entry per risk:

| ID | Risk | Probability | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R-001 | Example risk | Medium | High | Example mitigation | Team | Open |

## 5. Assumption Log Template
Use one entry per assumption:

| ID | Assumption | Validation method | Owner | Due date | Status |
|---|---|---|---|---|---|
| A-001 | Example assumption | Test/prototype/research | Team | YYYY-MM-DD | Open |

## 6. Plan File Conventions
- Keep active plans in `docs/plan/`.
- Move completed or outdated plans to `docs/plan/archive/`.
- Use relative links only; avoid absolute machine paths.
- Keep planning docs in English.
