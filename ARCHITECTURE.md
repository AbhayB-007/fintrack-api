# ARCHITECTURE.md

## Module Relationship
The **Expense Splitting** module is built on top of the remediated **Transaction** module and reuses
its cross-cutting foundations in `src/common/` (Prisma client, typed errors, structured logger, auth
& money helpers). Transactions record an individual user's money movements; Shared Expenses model
money split *between* users and produce net balances. A settled balance can later be materialized as
Transactions for each party, so Expenses is a higher-level feature that consumes the same ledger
primitives and conventions (integer cents, per-user authorization).

## Layered Architecture & Data Flow
Each feature follows a strict one-directional layering:

```
HTTP request
  → controller (parse input, dollars↔cents, map errors)
    → service   (Zod validation, business math, authorization, logging)
      → repository (Prisma ORM only)
        → database
```

Controllers never touch Prisma; services never read `req`/`res`; repositories never throw HTTP
errors. A central Express error middleware maps typed errors (`ValidationError`→400,
`AuthorizationError`→403, `NotFoundError`→404) to responses.

## Why This Fits a Fintech Application
- **Integer-cents money** everywhere eliminates floating-point drift in balances.
- **Repository isolation + ORM** gives parameterized queries (no SQL injection) and testable,
  swappable persistence.
- **Mandatory per-user authorization** enforces tenant isolation of financial data.
- **Structured logging** provides an audit trail for every money operation.
- **Layering** keeps business math unit-testable without a database, enabling high confidence.

## Key Design Decisions
- Money as `Int` cents at the domain layer; convert to/from dollars only at the HTTP boundary.
- Equal splits distribute remainder cents deterministically so shares always sum to the total.
- Balances use a signed convention internally (positive = counterparty owes the user) and are split
  into `owedToUser`/`userOwes` for the API.
- Dependency-injected repositories so services are tested against mocks (no DB in unit tests).
