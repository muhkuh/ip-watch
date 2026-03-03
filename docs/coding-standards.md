# Coding Standards

## 1. Common Rules
- Prefer readable, maintainable code over clever shortcuts.
- Keep functions focused; split when logic has multiple responsibilities.
- Naming must reflect domain intent, not implementation detail.
- Avoid deep nesting; favor early returns.
- Keep side effects explicit.

Complexity baseline:
- Target small functions/modules.
- Refactor when a function becomes hard to test or reason about.

Comments and documentation:
- Comment why, not what.
- Document public functions/classes/modules with language-idiomatic doc format.
- Keep docs in sync with behavior changes.

Testing expectations:
- Add or update tests for behavior changes.
- Cover happy path + important failure path.
- Avoid brittle tests tied to implementation internals.

## 2. JavaScript / TypeScript
- Use ESLint + Prettier (or equivalent) consistently.
- TypeScript defaults: strict typing enabled, avoid `any` unless justified.
- Prefer explicit return types on exported functions.
- Validate external input at boundaries.
- Use `async/await`; handle rejection paths explicitly.
- Keep DTO types separate from domain models when complexity grows.

## 3. Node.js (Service Runtime)
- Centralize configuration via environment variables and validated config loader.
- Never read undeclared env vars directly in business logic.
- Implement graceful shutdown (`SIGTERM`, `SIGINT`) and close open resources.
- Use structured logging with request correlation IDs.
- Validate inbound payloads and query params.
- Set explicit timeouts for outbound calls.
- Expose health/readiness endpoints for operations.

## 4. PHP
- Follow PSR standards (PSR-1, PSR-12, PSR-4 as baseline).
- Use strict types where practical.
- Use typed properties and explicit return types.
- Distinguish domain exceptions from transport/HTTP exceptions.
- Keep controller/route layer thin; move business logic into services.
- Use repository/query abstractions where they improve clarity.

## 5. Slim Framework Notes
- Keep route definitions declarative and minimal.
- Delegate request handling to controllers/actions.
- Apply middleware in explicit order and document the chain.
- Validate request data before business logic execution.
- Normalize error responses to the shared API error contract.

## 6. Eloquent ORM Notes
- Keep model responsibilities focused on persistence concerns.
- Avoid heavy business logic in models.
- Guard against N+1 queries with explicit eager loading.
- Prefer query scopes for reusable filtering logic.
- Treat migrations as immutable history; never edit applied migrations in shared environments.
- Use transactions for multi-step writes requiring consistency.

## 7. Angular Notes
- Prefer standalone components and feature-oriented folder structure.
- Use signals/state patterns consistently; avoid mixed state paradigms without reason.
- Keep smart/container and presentational concerns separated where useful.
- Keep templates simple; move complex logic to component/service layer.
- Enforce accessibility basics: semantic elements, labels, keyboard support, contrast.
- For PWA projects: define caching strategy deliberately and version service worker changes.

## 8. Pull Request Quality Gate
Before merge, confirm:
1. Relevant standards in this document are met.
2. Tests/checks for changed behavior are updated and passing (or risks documented).
3. Public contracts/docs are updated when required.
