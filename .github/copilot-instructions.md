# FinTrack API — Copilot Project Instructions

These instructions apply to **all** Copilot Chat and inline suggestions in this repository.
Any code you generate MUST comply with the standards below.

## 1. Technology Stack
- **Language:** TypeScript (strict mode, `target ES2020`).
- **Runtime:** Node.js 20+.
- **Web framework:** Express 4.
- **ORM:** Prisma. **Never** use raw SQL strings or a raw DB driver (`sqlite3`, `pg`, `mysql2`) directly. All data access goes through Prisma.
- **Validation:** Zod for all inbound request payloads.
- **Logging:** Winston (structured JSON logging). Never use `console.log` in application code.
- **Testing:** Jest + ts-jest + Supertest.
- **Money:** Represent monetary amounts as **integer cents** internally to avoid floating-point rounding errors. Never store money as floats.

## 2. Architecture Conventions
Use a strict **layered architecture**. Data flows one direction; a layer may only call the layer directly beneath it.

```
route/controller  ->  service  ->  repository  ->  Prisma (model)
```

- **Model:** Prisma schema + shared TypeScript types/DTOs.
- **Repository:** the ONLY layer that touches Prisma. Returns domain objects, no HTTP concerns.
- **Service:** business logic, validation orchestration, authorization checks. No Express `req`/`res`.
- **Controller/Route:** parses/validates input, maps errors to HTTP status codes, calls the service.

Rules:
- Controllers must never touch Prisma directly.
- Services must never read `req`/`res`.
- Repositories must never throw HTTP errors.

## 3. Coding Standards
- Prefer `async/await`; never mix with raw `.then()` chains.
- Every public function/method has a JSDoc block describing purpose, params, returns, and thrown errors.
- Use named exports. One responsibility per file.
- Use custom typed error classes (`ValidationError`, `NotFoundError`, `AuthorizationError`) — never throw bare strings.
- No magic numbers; use named constants.
- Functions should be small and single-purpose.

## 4. Security Rules
- **Authorization is mandatory:** every data operation must be scoped to the authenticated `userId`. A user can only read/modify their own resources. Never trust a `userId` from the request body for ownership — use the authenticated principal.
- Validate and sanitize ALL external input with Zod before use.
- Never log secrets, tokens, or full PII.
- Fail closed: if authorization cannot be determined, deny.
- No mass-delete endpoints without explicit scoping to the authenticated user.

## 5. Testing Expectations
- Every service method has unit tests (happy path + failure/edge cases).
- Repositories are mocked in service tests.
- Minimum coverage for new features: validation failures, authorization failures, and core business math.
- Tests must be deterministic and independent (no shared mutable state).
- Use descriptive `describe`/`it` names stating the expected behavior.

## 6. Error Handling
- Services throw typed errors; a central Express error middleware maps them to HTTP codes:
  - `ValidationError` -> 400
  - `AuthorizationError` -> 403
  - `NotFoundError` -> 404
  - unknown -> 500 (log full detail, return generic message).
- Never leak stack traces or DB internals to API responses.

## 7. Documentation
- Keep `ARCHITECTURE.md` current with any structural change.
- Document all prompts used to generate code in `PROMPTS.md`.
