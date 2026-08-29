# FinTrack API

A personal-finance management API. This sprint adds an **Expense Splitting** feature on top of a
remediated **Transaction** module.

## Technology Stack

| Concern        | Choice                              |
| -------------- | ----------------------------------- |
| Language       | TypeScript (strict)                 |
| Runtime        | Node.js 20+                         |
| Web framework  | Express 4                           |
| ORM            | Prisma (SQLite dev / Postgres prod) |
| Validation     | Zod                                 |
| Logging        | Winston (structured JSON)           |
| Testing        | Jest + ts-jest + Supertest          |
| Money handling | Integer**cents** internally   |

## Project Structure

```
fintrack-api/
├── .github/
│   └── copilot-instructions.md
├── prisma/
│   ├── schema.prisma
│   └── seed.ts            # seeds baseline users (alice, bob, carol)
├── src/
│   ├── common/            # errors, logger, prisma client, auth middleware, money helpers
│   ├── users/             # user service + controller (create / list)
│   ├── transactions/      # remediated: model types, repository, service, controller
│   └── expenses/          # new feature: model types, repository, service, controller
├── tests/                 # Jest test suites (≥6 cases)
├── README.md
└── package.json
```

## Money Convention

All amounts are handled as **integer cents** in the domain/services to avoid floating-point errors.
API request/response amounts are in **dollars** and converted at the boundary.

## Authentication

For this assessment, authenticated routes use a simple trusted header **`x-user-id`** (set by an API
gateway in production, where it would be a verified JWT/session). The `/users` and `/health` routes
are intentionally open so you can bootstrap users before making authenticated calls.

---

## 1. Setup & Run (step by step)

```bash
# 1. Install dependencies
npm install

# 2. Create your local environment file
cp .env.example .env          # sets DATABASE_URL="file:./dev.db", PORT=3000

# 3. Generate the Prisma client
npm run prisma:generate

# 4. Create the SQLite database + tables
npm run prisma:migrate        # applies the "init" migration

# 5. Seed baseline users (alice, bob, carol)
npm run prisma:seed

# 6. Start the API (choose one)
npm run dev                   # dev mode with auto-reload (ts-node-dev)
# — or —
npm run build && npm start    # compiled production build (dist/src/server.js)
```

The server starts on **http://localhost:3000** and logs:

```json
{"level":"info","message":"server.started","port":3000}
```

### Run the tests

```bash
npm test                      # 6 unit tests (no DB required — repository is mocked)
```

### Port already in use?

If you see `EADDRINUSE: address already in use :::3000`, free the port (Windows / Git Bash):

```bash
netstat -ano | grep ":3000" | grep LISTENING     # note the PID (last column)
taskkill //PID <PID> //F                          # stop it
```

Or change `PORT` in `.env` (e.g. `PORT=3001`).

---

## 2. API Reference

| Method | Path                   | Auth (`x-user-id`) | Purpose                                      |
| ------ | ---------------------- | -------------------- | -------------------------------------------- |
| GET    | `/health`            | no                   | Liveness check                               |
| POST   | `/users`             | no                   | Create a new user                            |
| GET    | `/users`             | no                   | List all users + total count                 |
| POST   | `/expenses`          | yes                  | Create a shared expense (equal/custom split) |
| GET    | `/expenses`          | yes                  | List all expenses the user is involved in    |
| GET    | `/expenses/balances` | yes                  | Net pending balances (who owes whom)         |
| POST   | `/transactions`      | yes                  | Create a personal transaction                |
| GET    | `/transactions`      | yes                  | List the user's transactions                 |
| DELETE | `/transactions`      | yes                  | Delete all of the user's transactions        |

---

## 3. Verify Every Feature (copy-paste examples)

> All examples use `curl`. In Postman: set the method/URL, add header
> `Content-Type: application/json` (and `x-user-id` where required), and paste the JSON body.

### 3.1 Health check

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

### 3.2 Check how many users exist in the database

```bash
curl http://localhost:3000/users
# {"count":4,"users":[{"id":"alice",...},{"id":"bob",...},{"id":"carol",...},{"id":"dave",...}]}
```

### 3.3 Add a new user

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"id":"dave","name":"Dave"}'
# 201 {"id":"dave","name":"Dave","createdAt":"..."}
```

> `id` is optional — omit it to auto-generate a UUID. Duplicate ids return `400`.

### 3.4 Create a shared expense — EQUAL split

```bash
curl -X POST http://localhost:3000/expenses \
  -H "Content-Type: application/json" \
  -H "x-user-id: alice" \
  -d '{"description":"Dinner","totalAmount":120,"splitType":"equal","participants":[{"userId":"alice"},{"userId":"bob"},{"userId":"carol"}]}'
# 201 → each participant shareAmount = 40 (remainder distributed so shares always sum to the total)
```

### 3.5 Create a shared expense — CUSTOM split

```bash
curl -X POST http://localhost:3000/expenses \
  -H "Content-Type: application/json" \
  -H "x-user-id: bob" \
  -d '{"description":"Taxi","totalAmount":30,"splitType":"custom","participants":[{"userId":"bob","shareAmount":10},{"userId":"alice","shareAmount":20}]}'
# 201 → shares must sum exactly to totalAmount
```

Custom amounts that DON'T sum to the total are rejected:

```bash
curl -X POST http://localhost:3000/expenses \
  -H "Content-Type: application/json" \
  -H "x-user-id: bob" \
  -d '{"description":"Bad","totalAmount":30,"splitType":"custom","participants":[{"userId":"bob","shareAmount":10},{"userId":"alice","shareAmount":5}]}'
# 400 {"error":"Custom shares (1500 cents) must sum to the total (3000 cents)"}
```

### 3.6 Get data for ALL expenses (for a user)

```bash
curl http://localhost:3000/expenses -H "x-user-id: alice"
# [ { id, creatorId, description, splitType, totalAmount, participants:[...] }, ... ]
```

### 3.7 Get the split / pending balances for a user (who owes whom)

```bash
curl http://localhost:3000/expenses/balances -H "x-user-id: alice"
# {"userId":"alice","owedToUser":[{"counterpartyId":"bob","amount":60},{"counterpartyId":"carol","amount":80}],"userOwes":[]}

curl http://localhost:3000/expenses/balances -H "x-user-id: bob"
# {"userId":"bob","owedToUser":[],"userOwes":[{"counterpartyId":"alice","amount":60}]}
```

> Balances are **netted** across all shared expenses using the rule
> "A owes B $30, B owes A $10 → net A owes B $20". The creator of an expense is assumed to have paid
> the bill, so every other participant owes the creator their share.

### 3.8 Personal transactions (remediated module)

```bash
# create
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" -H "x-user-id: alice" \
  -d '{"description":"Coffee","amount":4.50,"type":"debit"}'

# list mine
curl http://localhost:3000/transactions -H "x-user-id: alice"

# delete all mine (scoped to the authenticated user only)
curl -X DELETE http://localhost:3000/transactions -H "x-user-id: alice"
```

### 3.9 Authorization check (should fail)

```bash
curl -i http://localhost:3000/expenses/balances     # no x-user-id header
# HTTP/1.1 401 Unauthorized  {"error":"Authentication required"}
```

---

## 4. Inspect the database directly (optional)

```bash
npx prisma studio           # opens a GUI at http://localhost:5555 to browse Users / Expenses
```

---

## Documentation Index

- `.github/copilot-instructions.md` — project standards for Copilot
- `REVIEW.md` — code review of the inherited Transaction module
- `PROMPTS.md` — prompt engineering log
- `PR_DESCRIPTION.md` — pull request writeup + AI disclosure + peer review
- `TOOL_STRATEGY.md` — Copilot tool strategy reflection
- `ARCHITECTURE.md` — architecture overview
- `docs/prompts-raw.md` — raw saved prompt outputs (unreviewed AI generation record)
