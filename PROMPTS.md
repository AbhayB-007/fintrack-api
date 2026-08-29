# PROMPTS.md — Prompt Engineering Log (Expense Splitting Feature)

This documents how GitHub Copilot was used to build the Expense Splitting feature on top of the
remediated Transaction module. It shows the prompt chain in execution order, the Copilot feature and
prompting technique for each, and the corrections applied afterward.

**Copilot features used:** Copilot Chat (ask), Copilot Edits (multi-file), Inline completion.
**Techniques used:** role-based, specificity/constraint, decomposition, few-shot, iterative refinement.

---

## Prompt Chain

### Prompt 1 — Establish standards context (role-based + constraint)
- **Feature:** Copilot Chat (ask)
- **Technique:** Role-based + constraint
- **Exact text:**
  > "You are a senior fintech backend engineer. Read `.github/copilot-instructions.md`. From now on,
  > all code must follow it: TypeScript strict, Prisma only (no raw SQL), Zod validation, integer
  > cents for money, layered architecture, and per-user authorization. Confirm the constraints you
  > will apply."
- **Rationale:** Priming Copilot with a role and the project rulebook makes later suggestions
  standards-compliant, reducing rework. Constraints stop it from defaulting to floats/raw SQL.

### Prompt 2 — Design the domain model (decomposition + specificity)
- **Feature:** Copilot Chat (ask)
- **Technique:** Decomposition + specificity
- **Exact text:**
  > "Design the domain types for an Expense Splitting feature: a SharedExpense with creator,
  > description, totalCents, splitType (equal|custom), participants (userId + shareCents), createdAt.
  > Also define DTOs for creating an expense and for a per-person net balance summary. Amounts are
  > integer cents. Output only TypeScript interfaces/types."
- **Rationale:** Breaking the feature into "types first" gives a stable contract before logic.
  Specificity (exact fields, cents) prevents ambiguous output.

### Prompt 3 — Split calculation logic (few-shot + constraint)
- **Feature:** Copilot Chat (ask)
- **Technique:** Few-shot + constraint
- **Exact text:**
  > "Implement the share calculation. Equal split example: total 10000 cents among 3 →
  > [3334,3333,3333] (remainder distributed, sum must equal total exactly). Custom split example:
  > total 12000 with [5000,7000] is valid; [4000,5000] must throw ValidationError. Constraints: no
  > floats, throw our ValidationError, pure functions, no Prisma here."
- **Rationale:** Few-shot examples pin down the exact remainder-distribution behavior and the
  failure case, which prose alone often gets wrong.

### Prompt 4 — Net balance computation (specificity + iterative refinement)
- **Feature:** Copilot Chat (ask), then Inline completion for tweaks
- **Technique:** Specificity + iterative refinement
- **Exact text:**
  > "Compute net balances for a user across all their shared expenses. Assume the creator paid the
  > bill, so each other participant owes the creator their share. Net per counterparty: if A owes B
  > 30 and B owes A 10, result is A owes B 20. Return owedToUser (net>0) and userOwes (net<0).
  > Positive means the counterparty owes the querying user."
- **Rationale:** The sign convention is the tricky part; stating it explicitly avoided inverted
  balances. I then refined the accumulation with inline completion.

### Prompt 5 — Wire controllers + app (Copilot Edits, multi-file)
- **Feature:** Copilot Edits (multi-file)
- **Technique:** Constraint + specificity
- **Exact text:**
  > "Create Express routers for transactions and expenses. Controllers only parse input, convert
  > dollars↔cents at the boundary, call the service, and map errors via next(err). Add POST
  > /expenses, GET /expenses/balances, and mount both routers behind the authenticate middleware in
  > app.ts. No business logic in controllers."
- **Rationale:** Edits spans multiple files coherently (controllers + app wiring), enforcing the
  "no logic in controllers" constraint across all of them at once.

### Prompt 6 — Tests (decomposition + few-shot)
- **Feature:** Copilot Chat (ask)
- **Technique:** Decomposition + few-shot
- **Exact text:**
  > "Write Jest tests with a mocked ExpenseRepository (no DB) covering: equal split among 3, valid
  > custom split, invalid custom split (throws ValidationError), net balance between two users across
  > two expenses (expect Bob owes Alice 2000), single-participant rejection, and unauthorized access
  > via assertParticipant. Each test named by behavior."
- **Rationale:** Enumerating the six cases (decomposition) plus an expected numeric outcome
  (few-shot) produced targeted, deterministic tests.

---

## Post-Generation Corrections
Every change I made to Copilot's raw output:

1. **Repository create typing.** Copilot's first repository used
   `CreateSharedExpenseInput & { participants: ParticipantShare[] }`, which conflicted (optional vs
   required `shareCents`) and failed `tsc`. **Fix:** introduced an explicit `PersistExpenseInput`
   interface with fully-resolved `ParticipantShare[]`.
2. **Implicit `any` on the Prisma map callback.** Generated `rows.map((r) => this.map(r))` tripped
   `noImplicitAny`. **Fix:** extracted an `ExpenseRow` interface and annotated the parameter.
3. **Equal-split remainder.** The first draft used `Math.round(total/n)`, which loses/creates a cent
   (e.g. 10000/3). **Fix:** floor + deterministic remainder distribution so shares always sum to the
   total.
4. **Balance sign convention.** Initial output netted amounts but returned absolute values, losing
   direction. **Fix:** kept signed `netCents` internally and split into `owedToUser`/`userOwes` at
   the boundary.
5. **Authorization on balances.** Copilot omitted any ownership scoping (matching the Transaction
   module's original flaw). **Fix:** balances are computed strictly for the authenticated `userId`,
   and `assertParticipant` guards single-expense access.
6. **Money at the HTTP boundary.** Generated controllers passed dollar floats straight into the
   service. **Fix:** added `toCents`/`toDollars` conversion so the domain only ever sees integer
   cents.
