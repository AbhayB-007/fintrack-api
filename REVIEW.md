# Transaction Module — Code Review & Remediation

**Reviewer:** Assigned developer
**Artifact under review:** The unreviewed, AI-generated Transaction module produced last sprint by
the low-effort prompt _"Generate a Transaction model and a Transaction service with create,
get-by-user, and delete-all functions. Use a database."_ (raw output preserved in
`docs/prompts-raw.md`).

## Review Process (How I Detected Issues)
1. **Static read-through + Copilot Chat "/explain"** on the raw files to summarize intent and surface
   obvious smells (raw SQL, no async handling).
2. **Copilot Chat security review prompt** ("review this for security issues in a fintech context") —
   flagged the SQL injection and missing authorization quickly.
3. **My own judgment** for the fintech-specific defects Copilot did *not* prioritize: money stored as
   a float, `Math.random()` primary keys, and a global `deleteAll()` with no user scoping.
4. Cross-checked findings against `.github/copilot-instructions.md` (our standards) to classify
   severity.

## Defect Log

| # | Issue | Location | Severity | Impact (fintech) | Fix |
|---|-------|----------|----------|------------------|-----|
| 1 | **SQL injection** via string concatenation of `user`, `amount`, `desc` | `service.create`, `getByUser` | **Critical** | Attacker can read/alter/drop financial data | Use Prisma ORM parameterized queries |
| 2 | **`deleteAll()` deletes ALL users' transactions** (no scoping) | `service.deleteAll` | **Critical** | One call wipes the entire ledger for every customer | Scope delete to authenticated `userId` (`deleteAllForUser`) |
| 3 | **No authorization** — any user can read any other user's data | `service.getByUser` | **Critical** | Confidentiality breach / regulatory violation | Scope all reads to authenticated principal; add `getOwned` ownership check |
| 4 | **Money stored as float** | model column `amount` | **High** | Floating-point rounding errors corrupt balances | Store integer **cents** (`amountCents Int`) |
| 5 | **`Math.random()` used as primary key** | `service.create` | **High** | Collisions → overwritten/duplicated transactions | UUID primary key via Prisma `@default(uuid())` |
| 6 | **Async result discarded** — `getByUser` returns `undefined` (callback return ignored) | `service.getByUser` | **High** | Endpoint silently returns nothing | `async/await` returning the query result |
| 7 | **No input validation** | all functions | **High** | Bad/negative/oversized amounts persist | Zod schema validation |
| 8 | **No error handling** — `db.run` errors swallowed | all functions | **Medium** | Silent data loss, no diagnostics | Typed errors + central error middleware |
| 9 | **No types / weak schema** (untyped columns) | model | **Medium** | Type confusion, no `type` field for debit/credit | Typed Prisma schema + TS DTOs |
| 10 | **`console`/no logging, no audit trail** | all | **Medium** | No traceability for financial ops | Structured Winston logging |
| 11 | **Raw DB driver (`sqlite3`) instead of ORM** | model | **Medium** | Violates standards, unmanaged schema/migrations | Prisma ORM |
| 12 | **No layering** (service talks straight to DB) | whole module | **Medium** | Untestable, tightly coupled | model → repository → service → controller |

## Remediation Summary
The module was rewritten to production standards under `src/transactions/`:
- **Layered architecture:** `transaction.model.ts` (types) → `transaction.repository.ts` (Prisma only)
  → `transaction.service.ts` (validation + authorization + logging) → `transaction.controller.ts`
  (HTTP mapping).
- **ORM-based access** (Prisma), no raw SQL.
- **Zod validation**, **typed errors**, **structured logging**.
- **Authorization**: every operation scoped to the authenticated `userId`; `getOwned` enforces
  ownership; `deleteAll` replaced by `deleteAllForUser`.
- **Money as integer cents**; UUID keys; JSDoc on every public method.

## Issues Copilot Introduced That Required Human Judgment
These are defects the AI generated (or failed to prevent) that a developer had to catch:

1. **Global `deleteAll()` with no user scoping.** Copilot took the prompt literally and produced a
   ledger-wiping function. Only domain judgment ("this is a multi-tenant financial ledger") reveals
   how catastrophic this is. The AI saw it as a valid "delete-all" implementation.
2. **Money as a float.** Copilot's default for "amount" is a numeric/float column. A fintech engineer
   knows monetary values must be integer minor units — the model never hints at rounding risk.
3. **`Math.random()` as a primary key.** Plausible-looking but silently unsafe; the AI optimized for
   "runs" not "correct under concurrency." Requires human knowledge of collision/idempotency.
4. **Discarded async result in `getByUser`.** The callback-style `db.all(...)` "returns" rows inside a
   callback the outer function ignores — it compiles and looks fine, but always returns `undefined`.
   Only a human tracing control flow (or a test) catches this.
5. **Missing authorization entirely.** The prompt didn't ask for it, so Copilot didn't add it. Security
   requirements that aren't in the prompt are invisible to the model — human judgment supplied them.
