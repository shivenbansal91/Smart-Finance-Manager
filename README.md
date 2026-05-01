# 💰 Smart Finance Manager

> A full-stack personal finance tracking application built as a **DBMS Mini Project**.  
> Track accounts, transactions, budgets, loans, recurring bills, and get AI-powered spending insights — all backed by Oracle Database XE.

**Stack:** React + TypeScript · Node.js / Express · **Oracle Database XE 21c**  
**Optional:** Google Gemini 1.5 Flash (AI insights — set `GEMINI_API_KEY` in `.env`)

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 **Auth** | Sign up / Sign in with **bcrypt** + **JWT** (7-day sessions) |
| 🏦 **Accounts** | Multiple types (bank, cash, credit, savings) with live balances |
| 💸 **Transactions** | Add income/expense — updates account balance via Oracle stored procedure |
| 🎯 **Budgets** | Monthly spending limits per category with % progress bar |
| 🔔 **Budget Alerts** | Auto-alerts at 80% and 100% of budget usage |
| 📊 **Dashboard** | Net cash flow stats + Bar chart (6-month) + Pie chart (by category) |
| 🗂️ **Categories** | Custom income/expense categories with emoji icons (in user menu) |
| 🧠 **AI Insights** | Rule-based spending analysis + optional Gemini 1.5 Flash enrichment |
| 🔄 **Recurring & Bills** | Auto-detected subscriptions + manually tracked recurring bills with due-date alerts |
| 🏦 **Loans & Debt** | Track EMIs, interest, remaining balance, payoff progress. Paying EMI auto-debits your account |
| 🌙 **Design** | Dark glassmorphism fintech UI — fully responsive |

---

## 🗄️ Database: Oracle XE (`XEPDB1`)

### Tables

| Table | Purpose |
|---|---|
| `users` | Authentication & profile |
| `accounts` | Bank/cash/credit/savings account balances |
| `categories` | Income/expense category definitions |
| `transactions` | All financial transactions |
| `budgets` | Monthly spending limits |
| `budget_alerts` | Auto-generated budget warnings |
| `subscriptions` | Auto-detected recurring payment patterns |
| `loans` | Loan/debt tracker (principal, EMI, interest) |
| `bills` | Manually added recurring bill reminders |

### ER Diagram (abbreviated)

```
USER(user_id PK, name, email UNIQUE, password_hash, created_at)
  │
  ├── ACCOUNT(account_id PK, account_name, account_type, balance, user_id FK)
  │
  ├── CATEGORY(category_id PK, name, type, icon, user_id FK)
  │     │
  │     ├── TRANSACTION(transaction_id PK, amount, txn_date, description,
  │     │               user_id FK, account_id FK, category_id FK)
  │     │
  │     └── BUDGET(budget_id PK, limit_amount, start_date, end_date,
  │                user_id FK, category_id FK)
  │                   │
  │                   └── BUDGET_ALERT(alert_id PK, message, is_read,
  │                                    user_id FK, budget_id FK)
  │
  ├── SUBSCRIPTION(subscription_id PK, merchant, amount, interval_type,
  │                is_active, last_seen, user_id FK)
  │
  ├── LOAN(loan_id PK, lender_name, principal, interest_rate, emi_amount,
  │        due_date, paid_amount, status, notes, user_id FK)
  │
  └── BILL(bill_id PK, bill_name, amount, due_date, recurrence,
            is_paid, reminder_days, user_id FK)
```

### Oracle Database Objects

| Type | Name | Purpose |
|---|---|---|
| Sequence | `seq_users`, `seq_accounts`, `seq_categories`, `seq_transactions`, `seq_budgets`, `seq_alerts`, `seq_subscriptions`, `seq_loans`, `seq_bills` | Auto-increment PKs |
| Stored Procedure | `add_transaction` | Atomically inserts transaction **and** updates account balance |
| Trigger | `trg_txn_delete` | Reverses account balance when a transaction is deleted |
| Function | `fn_total_income` | Total income for a user in a date range |
| Function | `fn_total_expense` | Total expense for a user in a date range |
| Function | `fn_savings` | Net savings (income − expense) for a date range |

> **Note:** Budget alert logic runs in Node.js (`checkBudgetAlert`) — not via Oracle trigger — to avoid `ORA-04091` (mutating table).

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
1. User fills form  →  POST /api/transactions { account_id, category_id, amount, txn_date }
2. Express calls    →  BEGIN add_transaction(:1,:2,:3,:4,:5,:6); END;
3. Stored proc:     →  INSERT INTO transactions ...
                    →  UPDATE accounts SET balance = balance ± amount
4. Node.js checks   →  if spending ≥ 80% of budget → INSERT INTO budget_alerts
5. API returns      →  new transaction row (with joins)
6. React updates    →  transaction list + account balance refresh
```

---

## 🚀 How to Run

### Prerequisites
- **Node.js** v18+ — `node -v`
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
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Oracle DB connection
DB_USER=system
DB_PASSWORD=your_oracle_password_here
DB_CONNECT_STR=localhost:1521/XEPDB1

# JWT secret — any long random string
JWT_SECRET=smartfinance_jwt_secret_2026

# Ports
API_PORT=3001
VITE_API_URL=http://localhost:3001

# Optional: Google Gemini AI (enables enhanced spending insights)
# GEMINI_API_KEY=your_gemini_key_here
```

---

### Step 3 — Install dependencies

**Frontend** (project root):
```bash
npm install
```

**Backend**:
```bash
cd server && npm install
```

---

### Step 4 — Set up the Oracle database
```bash
cd server
node setup.js
```
Creates all tables, sequences, stored procedures, triggers, and functions.  
Safe to re-run (skips existing objects).

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
cd server && node server.js
```
```
✅ Oracle DB connected → XEPDB1
✅ Gemini AI ready for spending insights   ← (only if GEMINI_API_KEY is set)
🚀 Smart Finance API  → http://localhost:3001
```

---

### Step 6 — Start the frontend
```bash
npm run dev
```
Open **http://localhost:8080** → sign up → start tracking!

---

### 🪟 One-click Windows launcher
Double-click **`start.bat`** — runs steps 5 and 6 automatically.

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
├── .env.example
├── .gitignore
├── index.html
├── start.bat                    ← Windows launcher
├── vite.config.ts
├── tailwind.config.ts
│
├── src/                         ← React + TypeScript frontend
│   ├── App.tsx                  ← routing + auth guard
│   ├── index.css                ← global styles + CSS variables
│   ├── lib/
│   │   ├── api.ts               ← typed fetch wrapper (all API calls)
│   │   └── format.ts            ← fmtMoney / fmtDate helpers
│   ├── hooks/
│   │   └── useAuth.tsx          ← AuthProvider + useAuth hook
│   ├── components/
│   │   ├── AppLayout.tsx        ← sidebar + avatar dropdown + mobile nav
│   │   ├── Loader.tsx           ← bouncing-ball loading screen
│   │   └── ui/                  ← shadcn/radix component library
│   └── pages/
│       ├── Landing.tsx          ← marketing / home page
│       ├── Auth.tsx             ← login + signup
│       ├── Dashboard.tsx        ← stat cards + bar/pie charts + budget alerts
│       ├── Accounts.tsx         ← account list + edit-balance dialog
│       ├── Transactions.tsx     ← transaction log + CSV export
│       ├── Budgets.tsx          ← budget limits + progress bars
│       ├── Categories.tsx       ← category management (via user dropdown)
│       ├── Insights.tsx         ← AI spending insights (rule-based + Gemini)
│       ├── Recurring.tsx        ← subscriptions + bills in one page
│       └── Loans.tsx            ← loan tracker with EMI, interest, payoff
│
└── server/                      ← Node.js / Express backend
    ├── server.js                ← entry point
    ├── setup.js                 ← one-time Oracle DB initialisation
    ├── package.json
    ├── config/
    │   └── db.js                ← Oracle connection pool (oracledb)
    ├── middleware/
    │   └── auth.js              ← JWT verification middleware
    └── routes/
        ├── auth.js              ← signup / signin / me / delete account
        ├── accounts.js          ← CRUD + PATCH balance
        ├── categories.js        ← CRUD
        ├── transactions.js      ← CRUD + budget alert check
        ├── budgets.js           ← CRUD
        ├── alerts.js            ← GET alerts / PATCH read
        ├── dashboard.js         ← aggregated stats
        ├── insights.js          ← rule-based engine + Gemini enrichment + loan advisor
        ├── subscriptions.js     ← auto-detect + CRUD
        ├── loans.js             ← CRUD + EMI payment + account sync
        └── bills.js             ← CRUD + mark paid + due-soon alerts
```

---

## 🔑 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | ✗ | Register + seed defaults |
| POST | `/api/auth/signin` | ✗ | Login, returns JWT |
| GET | `/api/auth/me` | ✓ | Verify token |
| DELETE | `/api/auth/account` | ✓ | Delete user + all data |
| GET | `/api/health` | ✗ | DB health check |
| GET/POST/DELETE | `/api/accounts` | ✓ | Manage accounts |
| PATCH | `/api/accounts/:id/balance` | ✓ | Update balance directly |
| GET/POST/DELETE | `/api/categories` | ✓ | Manage categories |
| GET/POST/DELETE | `/api/transactions` | ✓ | Manage transactions |
| GET/POST/DELETE | `/api/budgets` | ✓ | Manage budgets |
| GET/PATCH | `/api/budget-alerts` | ✓ | Alerts + dismiss |
| GET | `/api/dashboard` | ✓ | Aggregated stats |
| GET | `/api/insights` | ✓ | Spending insights (+ loan advisor) |
| GET/POST/PATCH/DELETE | `/api/subscriptions` | ✓ | Subscription management |
| POST | `/api/subscriptions/detect` | ✓ | Auto-detect subscriptions from transactions |
| GET/POST/DELETE | `/api/loans` | ✓ | Loan management |
| PATCH | `/api/loans/:id/pay` | ✓ | Record EMI payment (optionally debits account) |
| GET/POST/DELETE | `/api/bills` | ✓ | Bill reminders |
| PATCH | `/api/bills/:id/pay` | ✓ | Mark bill paid + advance due date |
| GET | `/api/bills/due` | ✓ | Bills due within 7 days |

---

## 🛡️ Security

- Passwords hashed with **bcrypt** (10 salt rounds)
- Protected routes require a **JWT Bearer token** (7-day expiry)
- All DB queries use **Oracle named bind variables** — no SQL injection possible
- Row-level isolation: every query filters by `user_id` from JWT payload
- `.env` in `.gitignore` — credentials never committed

---

## 🧑‍💻 Viewing Data in Oracle SQL Developer

Connect with: User `system` | your password | Service `XEPDB1`

```sql
-- All users
SELECT user_id, name, email, created_at FROM users;

-- Active loans with interest
SELECT lender_name, principal, interest_rate, emi_amount,
       principal - paid_amount AS remaining, status
FROM loans WHERE status = 'active';

-- Bills due this week
SELECT bill_name, amount, due_date, recurrence
FROM bills WHERE due_date BETWEEN SYSDATE AND SYSDATE + 7
ORDER BY due_date;

-- All transactions with category
SELECT u.name, t.amount, t.txn_date, c.name AS category, c.type
FROM users u
JOIN transactions t ON t.user_id = u.user_id
JOIN categories c ON c.category_id = t.category_id
ORDER BY t.txn_date DESC;
```
