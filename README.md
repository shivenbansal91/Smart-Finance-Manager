# 💰 Smart Finance Manager

> A full-stack personal finance tracking application built as a **DBMS Mini Project**.  
> Track income, expenses, budgets, and account balances — with real-time charts and alerts.

**Stack:** React + TypeScript · Node.js / Express · **Oracle Database XE**

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 Auth | Sign up / Sign in with **bcrypt** + **JWT** (7-day sessions) |
| 🏦 Accounts | Multiple account types (bank, cash, credit, savings) with live balances |
| 💸 Transactions | Add income/expense — automatically updates account balance via stored procedure |
| 🎯 Budgets | Set monthly spending limits per category with % progress bar |
| 🔔 Alerts | Auto-alerts at 80% and 100% of budget usage |
| 📊 Dashboard | Bar chart (6-month income vs expense) + Pie chart (spending by category) |
| 🗂️ Categories | Custom income/expense categories with emoji icons |
| 📥 Export | Download transactions as CSV |
| 🌙 Theme | Dark glassmorphism fintech design |

---

## 🗄️ Database: Oracle XE (`XEPDB1`)

### ER Diagram

```
USER(user_id PK, name, email UNIQUE, password_hash, created_at)
  │
  ├── ACCOUNT(account_id PK, account_name, account_type, balance, user_id FK, created_at)
  │
  ├── CATEGORY(category_id PK, name, type ['income'|'expense'], icon, user_id FK)
  │     │
  │     ├── TRANSACTION(transaction_id PK, amount, txn_date, description,
  │     │               user_id FK, account_id FK, category_id FK, created_at)
  │     │
  │     └── BUDGET(budget_id PK, limit_amount, start_date, end_date,
  │                user_id FK, category_id FK)
  │                   │
  │                   └── BUDGET_ALERT(alert_id PK, message, spent,
  │                                    limit_amount, is_read, created_at,
  │                                    user_id FK, budget_id FK)
```

### Relationships
| Parent | Child | Cardinality |
|---|---|---|
| USER | ACCOUNT | 1 : M |
| USER | CATEGORY | 1 : M |
| USER | TRANSACTION | 1 : M |
| USER | BUDGET | 1 : M |
| ACCOUNT | TRANSACTION | 1 : M |
| CATEGORY | TRANSACTION | 1 : M (RESTRICT on delete) |
| CATEGORY | BUDGET | 1 : M |
| BUDGET | BUDGET_ALERT | 1 : M |

### Oracle Database Objects
| Type | Name | Purpose |
|---|---|---|
| Sequence | `seq_users`, `seq_accounts`, … | Auto-increment PKs (replaces MySQL `AUTO_INCREMENT`) |
| Stored Procedure | `add_transaction` | Atomically inserts transaction **and** updates account balance |
| Trigger | `trg_txn_delete` | Reverses account balance when a transaction is deleted |
| Function | `fn_total_income` | Total income for a user in a date range |
| Function | `fn_total_expense` | Total expense for a user in a date range |
| Function | `fn_savings` | Net savings (income − expense) for a date range |

> **Note:** Budget alert logic is handled in Node.js (`checkBudgetAlert`) — not via Oracle trigger — to avoid `ORA-04091` (mutating table).

---

## 🌊 Data Flow

```
Browser (React @ localhost:8080)
    │
    │  HTTP fetch() with  Authorization: Bearer <JWT>
    │
    ▼
Express API (Node.js @ localhost:3001)
    │
    │  Route → oracledb pool.execute()
    │
    ▼
Oracle XE Database (XEPDB1)
    │  Tables, sequences, stored procs, triggers fire automatically
    │
    ▼
JSON response → React useState() → UI re-renders
```

### Example: Add Transaction
```
1. User fills form →  POST /api/transactions  { account_id, category_id, amount, txn_date }
2. Express calls  →  BEGIN add_transaction(:1,:2,:3,:4,:5,:6); END;
3. Stored proc:   →  INSERT INTO transactions ...
                  →  UPDATE accounts SET balance = balance ± amount
4. Node.js checks →  if spending ≥ 80% of budget → INSERT INTO budget_alerts
5. API returns    →  the new transaction row (with joins)
6. React updates  →  transaction list + account balances refresh
```

---

## 🚀 How to Run

### Prerequisites
- **Node.js** v18+ — check with `node -v`
- **Oracle Database XE 21c** installed and running
- **npm** v9+

---

### Step 1 — Clone the repository
```bash
git clone https://github.com/shivenbansal91/Smart-Finance-Manager.git
cd Smart-Finance-Manager
```

---

### Step 2 — Configure environment
Copy the example file and fill in your Oracle details:
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Oracle DB connection
DB_USER=system
DB_PASSWORD=your_oracle_password_here     ← change this
DB_CONNECT_STR=localhost:1521/XEPDB1

# JWT secret — any long random string
JWT_SECRET=smartfinance_jwt_secret_2026

# Ports
API_PORT=3001
VITE_API_URL=http://localhost:3001
```

---

### Step 3 — Install dependencies

**Frontend** (from project root):
```bash
npm install
```

**Backend** (from server folder):
```bash
cd server
npm install
```

---

### Step 4 — Set up the Oracle database
```bash
cd server
node setup.js
```
This creates all **tables**, **sequences**, **stored procedures**, **triggers**, and **functions** in Oracle.  
Run it **once** — it's safe to re-run (skips already-existing objects).

Expected output:
```
=== Smart Finance Manager — Oracle DB Setup ===
Creating tables...     ✅ Tables ready
Creating sequences...  ✅ Sequences created
Creating procedures... ✅ Stored procedures created
Creating functions...  ✅ Functions created
Creating triggers...   ✅ Triggers created
=== Setup complete! ===
```

---

### Step 5 — Start the backend
```bash
cd server
node server.js
```
Expected output:
```
✅ Oracle DB connected → XEPDB1
🚀 Smart Finance API  → http://localhost:3001
   Frontend           → http://localhost:8080  (npm run dev)
```

---

### Step 6 — Start the frontend
Open a **new terminal** in the project root:
```bash
npm run dev
```
Expected output:
```
  VITE v5.x.x  ready in XXXms
  ➜  Local:   http://localhost:8080/
```

Open **http://localhost:8080** in your browser → Sign up → start tracking!

---

### 🪟 One-click Windows launcher
Double-click **`start.bat`** — it runs steps 5 and 6 automatically.

---

### Ports
| Service | URL |
|---|---|
| Frontend | http://localhost:8080 |
| Backend API | http://localhost:3001 |
| Health check | http://localhost:3001/api/health |

---

## 📁 Project Structure

```
Smart-Finance-Manager/
├── .env.example            ← copy to .env and fill in your values
├── .gitignore
├── index.html              ← HTML entry point
├── start.bat               ← one-click Windows launcher
├── vite.config.ts          ← Vite config (port 8080, @ alias)
├── tailwind.config.ts      ← design tokens
│
├── src/                    ← React + TypeScript frontend
│   ├── main.tsx
│   ├── App.tsx             ← routing + auth guard + loader
│   ├── index.css           ← global styles + CSS vars + loader animation
│   ├── lib/
│   │   ├── api.ts          ← typed fetch wrapper for all API calls
│   │   └── format.ts       ← fmtMoney / fmtDate helpers
│   ├── hooks/
│   │   └── useAuth.tsx     ← AuthProvider + useAuth hook
│   ├── components/
│   │   ├── AppLayout.tsx   ← sidebar + avatar menu + mobile nav
│   │   ├── Loader.tsx      ← bouncing-ball loading screen
│   │   └── ui/             ← shadcn/radix component library
│   └── pages/
│       ├── Landing.tsx     ← home / marketing page
│       ├── Auth.tsx        ← login + signup
│       ├── Dashboard.tsx   ← charts + stat cards + alerts
│       ├── Accounts.tsx    ← accounts with edit-balance dialog
│       ├── Transactions.tsx
│       ├── Budgets.tsx
│       └── Categories.tsx
│
└── server/                 ← Node.js / Express backend
    ├── server.js           ← entry point
    ├── setup.js            ← one-time Oracle DB initialisation
    ├── drop_trigger.js     ← utility: drops TRG_BUDGET_ALERT (run once)
    ├── package.json
    ├── config/
    │   └── db.js           ← Oracle connection pool (oracledb)
    ├── middleware/
    │   └── auth.js         ← JWT verification middleware
    └── routes/
        ├── auth.js         ← POST /signup  POST /signin  GET /me  DELETE /account
        ├── accounts.js     ← CRUD + PATCH /balance
        ├── categories.js   ← CRUD /api/categories
        ├── transactions.js ← CRUD + budget alert check
        ├── budgets.js      ← CRUD /api/budgets
        ├── alerts.js       ← GET /api/budget-alerts  PATCH …/read
        └── dashboard.js    ← GET /api/dashboard (aggregated stats)
```

---

## 🔑 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | ✗ | Register new user + seed defaults |
| POST | `/api/auth/signin` | ✗ | Login, returns JWT |
| GET | `/api/auth/me` | ✓ | Verify token |
| DELETE | `/api/auth/account` | ✓ | Delete user + all data |
| GET | `/api/health` | ✗ | Oracle DB health check |
| GET | `/api/accounts` | ✓ | List accounts |
| POST | `/api/accounts` | ✓ | Create account |
| PATCH | `/api/accounts/:id/balance` | ✓ | Set current balance directly |
| DELETE | `/api/accounts/:id` | ✓ | Delete account |
| GET | `/api/categories` | ✓ | List categories |
| POST | `/api/categories` | ✓ | Create category |
| DELETE | `/api/categories/:id` | ✓ | Delete category |
| GET | `/api/transactions` | ✓ | List transactions (last 200) |
| POST | `/api/transactions` | ✓ | Add transaction (calls stored proc) |
| DELETE | `/api/transactions/:id` | ✓ | Delete (trigger reverses balance) |
| GET | `/api/budgets` | ✓ | List budgets with live `spent` |
| POST | `/api/budgets` | ✓ | Create budget |
| DELETE | `/api/budgets/:id` | ✓ | Delete budget |
| GET | `/api/budget-alerts` | ✓ | Unread alerts |
| GET | `/api/budget-alerts/count` | ✓ | Unread count (badge) |
| PATCH | `/api/budget-alerts/:id/read` | ✓ | Dismiss alert |
| GET | `/api/dashboard` | ✓ | Aggregated stats for charts |

---

## 🛡️ Security

- Passwords hashed with **bcrypt** (10 salt rounds) — never stored as plain text
- Every protected route requires a **JWT Bearer token** (7-day expiry)
- All DB queries use **Oracle bind variables** (`:1, :2`) — no SQL injection possible
- Row-level isolation: every query filters by `user_id` from the JWT payload
- `.env` is in `.gitignore` — credentials never committed to Git

---

## 🧑‍💻 Viewing Data in Oracle

Open **Oracle SQL Developer**, connect with:
- User: `system`  |  Password: your Oracle password  |  Service: `XEPDB1`

Useful queries:
```sql
-- All registered users
SELECT user_id, name, email, created_at FROM users;

-- All accounts with balances
SELECT u.name, a.account_name, a.account_type, a.balance
FROM users u JOIN accounts a ON a.user_id = u.user_id;

-- All transactions
SELECT u.name, t.amount, t.txn_date, c.name AS category
FROM users u
JOIN transactions t ON t.user_id = u.user_id
JOIN categories c ON c.category_id = t.category_id
ORDER BY t.txn_date DESC;
```
