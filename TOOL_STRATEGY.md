# TOOL_STRATEGY.md — GitHub Copilot Tool Strategy Reflection

## A. Feature Usage Log
How Copilot was used across this case study (≥6 entries, ≥4 features).

| # | Copilot Feature | What I used it for | Why this feature (not another) | What happened |
|---|-----------------|--------------------|--------------------------------|----------------|
| 1 | **Copilot Chat (ask)** | Generated the deliberately low-effort Transaction module from the given prompt | Ask mode mirrors how the junior dev produced the original artifact | Produced raw SQL, float money, `Math.random()` keys — exactly the inherited defects |
| 2 | **Copilot Chat `/explain`** | Summarize the inherited raw code before touching it | Fastest way to understand unfamiliar code intent | Confirmed callback-return bug and missing async handling |
| 3 | **Copilot Chat (security review prompt)** | Ask Copilot to review the module for fintech security issues | Good at surfacing common vulns (SQLi) quickly | Flagged SQL injection & missing validation; missed the multi-tenant `deleteAll` risk |
| 4 | **Copilot Edits (multi-file)** | Scaffold controllers + wire `app.ts` together | Coordinated edits across several files with one instruction | Generated consistent routers; I corrected money conversion at boundary |
| 5 | **Inline completion** | Fill in repository methods, Zod schemas, JSDoc | Low-latency line-level completion while typing | Fast; needed type annotation fixes for `noImplicitAny` |
| 6 | **Copilot Chat (test generation)** | Draft the 6 Jest cases with a mocked repository | Enumerated cases produce targeted tests quickly | Passed after fixing expected remainder values |
| 7 | **`.github/copilot-instructions.md`** | Persist project standards across all sessions/devs | The only way to make guidance stick repo-wide | Later suggestions defaulted to Prisma/cents/layering |

## B. Scenario Responses

1. **Understand a complex 500-line function before modifying it**
   → **Copilot Chat `/explain`** on the selected function. It produces a structured summary of intent,
   inputs/outputs, and side effects far faster than reading top-to-bottom, letting me build a mental
   model before editing.

2. **Add consistent error handling across 8 route handlers**
   → **Copilot Edits (multi-file)**. It applies one consistent transformation across all handlers in a
   single reviewable change set, keeping the pattern uniform rather than editing each file by hand.

3. **Verify a regex handles international phone formats**
   → **Copilot Chat** to generate a table of test inputs/expected matches, or **Copilot inline** to
   generate a quick unit test. Chat can enumerate edge cases (country codes, spaces, `+`) I might not
   think of, which I then run.

4. **Enforce automated code-quality checks on every PR with no human intervention**
   → **Copilot for GitHub Actions / workflow generation** (Chat to author a CI workflow) plus
   Copilot code review on PRs. CI is the right layer for zero-human enforcement; Copilot just scaffolds
   the pipeline (lint, test, coverage gates).

5. **Review a teammate's AI-generated auth module for security vulns**
   → **Copilot Chat security-focused review** on the diff/file. It quickly flags common issues (injection,
   missing authz, weak crypto), giving a first pass — but I still apply human judgment for
   domain/logic flaws it misses.

6. **Ensure Copilot follows project conventions across all devs/sessions**
   → **`.github/copilot-instructions.md`**. A committed custom-instructions file is applied to every
   Copilot interaction in the repo, so all developers get standards-compliant suggestions consistently.

## C. Limitations Encountered (real situations from this case study)

1. **Multi-tenant `deleteAll()` blind spot.**
   - *Prompted:* the given low-effort prompt asking for a "delete-all" function.
   - *Went wrong:* Copilot generated a global `DELETE FROM transactions` wiping every user's ledger.
   - *Detected:* my review against fintech multi-tenancy — the security-review prompt did **not**
     flag it.
   - *Fixed:* replaced with `deleteAllForUser(userId)` scoped to the authenticated principal.
   - *Do differently:* always include tenancy/authorization constraints in the prompt up front.

2. **Equal-split rounding error.**
   - *Prompted:* "implement the share calculation" for equal splits.
   - *Went wrong:* used `Math.round(total/n)`, so 10000/3 produced shares that didn't sum to the total
     (a lost/created cent).
   - *Detected:* the "sum equals total" assertion in my test failed.
   - *Fixed:* floor + deterministic remainder distribution.
   - *Do differently:* give a worked few-shot example (`10000 → [3334,3333,3333]`) from the start.

3. **Type mismatch in the repository create signature.**
   - *Prompted:* generate the Prisma repository for shared expenses.
   - *Went wrong:* an intersection type with optional/required `shareCents` conflict broke `tsc`, and a
     `map` callback had implicit `any`.
   - *Detected:* the TypeScript compiler / test suite failed to run.
   - *Fixed:* introduced explicit `PersistExpenseInput` and `ExpenseRow` interfaces with annotations.
   - *Do differently:* ask Copilot to derive types from the Prisma-generated types rather than
     hand-rolled intersections.
