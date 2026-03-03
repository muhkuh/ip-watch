# AGENTS.md

## Purpose
This document defines global collaboration and quality rules for this repository.
It is written to be reusable across projects.

## Scope
These rules apply to all repository changes: code, configuration, tests, scripts, and documentation.

## Rule Precedence
1. Direct system/developer instructions in the active tooling session.
2. This `AGENTS.md`.
3. Domain-specific docs under `docs/`.
4. Local conventions in the edited module.

When rules conflict, follow the higher-priority source and document the decision.

## Language Policy
All documentation and comments intended for maintainers must be in English.

## Read Order
Before implementing non-trivial changes, read in this order:
1. [`README.md`](README.md)
2. [`docs/_docs_base.md`](docs/_docs_base.md)
3. [`docs/architecture.md`](docs/architecture.md)
4. [`docs/api.md`](docs/api.md)
5. [`docs/coding-standards.md`](docs/coding-standards.md)
6. [`docs/deployment/_deployment_base.md`](docs/deployment/_deployment_base.md)
7. [`docs/plan/_plan_base.md`](docs/plan/_plan_base.md)

## Working Style
- Prefer small, reviewable changes with a clear rationale.
- Make assumptions explicit; avoid hidden decisions.
- Do not run destructive actions without explicit approval.
- Keep behavior changes and refactors separated when possible.

## Planning and Change Size
- For multi-step work, define scope, risks, and acceptance criteria before editing.
- Keep pull requests focused on one concern.
- If scope expands, document out-of-scope items instead of merging them silently.

## Quality and Testing
- Run relevant tests/checks when logic changes.
- If tests are not run, state why and assess risk.
- Do not introduce new warnings or known build failures.

## Documentation Updates
- Update affected docs in the same change set.
- If public behavior or contracts change, update `docs/api.md` and/or `docs/architecture.md`.
- If operational behavior changes, update `docs/deployment/_deployment_base.md` and runbook steps.

## Security and Privacy
- Never commit credentials, tokens, or private keys.
- Mask sensitive values in logs and examples.
- Confirm before changing security-related defaults.

## Dependencies and Infrastructure
- Add dependencies only with clear need and tradeoff.
- Prefer well-supported libraries and document why they were chosen.
- Avoid introducing external managed services without explicit approval.

## Definition of Done
- Changes are scoped, validated, and documented.
- Affected tests/checks are run, or the risk is stated.
- No unintended side effects are known.
