# Pull Request — Expense Splitting Feature + Transaction Remediation

## Summary
This PR delivers the **Expense Splitting** feature and remediates the inherited, unreviewed
**Transaction** module.

**What was built and why:**
- **Project standards** (`.github/copilot-instructions.md`) so all Copilot output across the team is
  consistent (TypeScript strict, Prisma-only, integer-cents money, layered architecture, per-user
  authorization).
- **Transaction remediation** — rewrote the AI-generated module to production standards after a full
  review (`REVIEW.md`): layered (model→repository→service→controller), Prisma ORM, Zod validation,
  typed errors, structured logging, and authorization. Removed critical SQL-injection and global
  ledger-wipe defects.
- **Expense Splitting** — shared expenses with equal/custom splits, custom-sum validation, and net
  balance computation per counterparty, exposed via `POST /expenses` and `GET /expenses/balances`.

## AI Tool Disclosure
- **Copilot features used:** Copilot Chat (ask, `/explain`, security review, test generation),
  Copilot Edits (multi-file), Inline completion, and repo-wide custom instructions. Details in
  `PROMPTS.md` and `TOOL_STRATEGY.md`.
- **Where I accepted AI output:** domain type scaffolding, Zod schemas, controller/router boilerplate,
  JSDoc, and initial test skeletons.
- **Where I overrode AI output:** removed global `deleteAll` (multi-tenant risk), fixed float money →
  integer cents, corrected equal-split rounding, fixed balance sign convention, added authorization,
  and fixed TypeScript typing/`noImplicitAny` issues.
- **Estimated split:** ~55% AI-generated, ~45% hand-written/hand-corrected (higher human share in the
  business math, security, and type correctness).

## Testing Coverage
- 6 passing Jest unit tests (repository mocked, no DB): equal split (3-way with remainder), valid
  custom split, invalid custom split (validation failure), net balance across multiple expenses,
  single-participant edge case, and unauthorized-access.
- **Known gaps:** no end-to-end HTTP/integration tests through Express + a live Prisma DB; the
  `authenticate` middleware is a simplified header-based stub (production would verify JWT/session);
  no concurrency/settlement tests.

## Risk / Trade-off
**Settlement model assumption:** balances assume the *expense creator paid the full bill*, so every
other participant owes the creator their share. This is a simplification — real splitting apps allow
arbitrary payers and partial payments. The trade-off keeps the model and math simple for this sprint
but would need a `paidBy`/payments table to generalize.

## Self-Review Checklist
- [x] Layered architecture respected (no Prisma in controllers, no `req`/`res` in services)
- [x] All money handled as integer cents; converted only at HTTP boundary
- [x] Zod validation on all inbound payloads
- [x] Per-user authorization enforced on every data operation
- [x] Typed errors mapped centrally; no stack traces leaked
- [x] Structured logging, no `console.log`
- [x] JSDoc on all public methods
- [x] `tsc --noEmit` clean; all tests pass
- [x] No raw SQL / raw DB driver

## Peer Review Simulation
Comments as if reviewing a teammate's version of this feature:

1. **`expense.service.ts` — `computeEqualShares` (business logic).** *Actionable:* don't use
   `Math.round(total / n)` for equal splits; distribute the remainder cents deterministically so the
   shares sum exactly to the total. *Why:* rounding independently creates/loses cents (e.g. $100/3),
   which corrupts the ledger in a financial system.

2. **`expense.controller.ts` — balances endpoint.** *Actionable:* the `userId` for balances must come
   from the authenticated principal (`req.userId`), not from a query param or body. *Why:* trusting a
   client-supplied id lets any user read another user's balances — a tenant-isolation break.
   *(This is the kind of authorization gap AI tools typically miss since it wasn't in the prompt.)*

3. **`expense.repository.ts` — `create`.** *Actionable:* wrap the expense + participant inserts in a
   single transaction (Prisma nested-write already does this here — keep it; don't refactor into two
   separate `create` calls). *Why:* a partial write would leave an expense with missing shares,
   producing incorrect balances.
