# Documentation Guide

## Start Here
This directory contains reusable project documentation templates and project-specific operational docs.

Recommended reading order:
1. [`../README.md`](../README.md)
2. [`../AGENTS.md`](../AGENTS.md)
3. [`architecture.md`](architecture.md)
4. [`api.md`](api.md)
5. [`coding-standards.md`](coding-standards.md)
6. [`plan/_plan_base.md`](plan/_plan_base.md)
7. [`deployment/_deployment_base.md`](deployment/_deployment_base.md)

## Document Map
- [`architecture.md`](architecture.md): system context, boundaries, runtime topology, and ADR-light decisions.
- [`api.md`](api.md): API conventions, contract templates, error model, versioning, compatibility policy.
- [`coding-standards.md`](coding-standards.md): shared and language/framework standards (JS/TS, Node.js, PHP, Slim, Eloquent, Angular).
- [`plan/_plan_base.md`](plan/_plan_base.md): planning lifecycle, DoR/DoD checklists, assumptions and risk templates.
- [`plan/archive/`](plan/archive): historical plans and legacy artifacts.
- [`deployment/_deployment_base.md`](deployment/_deployment_base.md): deployment model, environments, operations, rollback strategy.
- [`deployment/e2e-runbook.md`](deployment/e2e-runbook.md): generic acceptance runbook for environment validation.

## Maintenance Rules
Update documentation when any of these change:
- Architecture boundaries or cross-service data flow.
- API request/response contracts, auth behavior, or error semantics.
- Coding conventions that impact review or implementation quality.
- Deployment topology, startup process, or operational checks.

## Link Validation Checklist
- All internal links resolve from their current file location.
- Placeholder values are clearly marked (for example `<APP_URL>`).
- Archived content links point to `docs/plan/archive/`.
- No absolute machine-specific filesystem paths are used.
