# Raw Saved Prompt Outputs (Unreviewed AI Generation Record)

This file preserves the **exact, unmodified** output of the low-effort prompt that a teammate
ran last sprint, per the assessment instructions. It is kept for audit/traceability. The code
below is intentionally **not** cleaned up here — remediation happens in `src/transactions/` and is
documented in `REVIEW.md`.

---

## Prompt used (run as-is, unmodified)

> "Generate a Transaction model and a Transaction service with create, get-by-user, and delete-all functions. Use a database."

**Copilot feature:** Copilot Chat (ask)
**Date:** sprint N-1 (inherited)

---

## Raw AI output (committed unreviewed by teammate)

`transaction.model.js`
```js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data.db');

db.run("CREATE TABLE IF NOT EXISTS transactions (id INTEGER, user, amount, desc)");

module.exports = db;
```

`transaction.service.js`
```js
const db = require('./transaction.model');

function create(user, amount, desc) {
  db.run("INSERT INTO transactions VALUES (" + Math.random() + ", '" + user + "', " + amount + ", '" + desc + "')");
  return true;
}

function getByUser(user) {
  db.all("SELECT * FROM transactions WHERE user = '" + user + "'", (err, rows) => {
    return rows;
  });
}

function deleteAll() {
  db.run("DELETE FROM transactions");
}

module.exports = { create, getByUser, deleteAll };
```

> The above is the inherited artifact. See `REVIEW.md` for the full defect log and the remediated,
> production-standard TypeScript implementation in `src/transactions/`.
