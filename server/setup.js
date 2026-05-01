/**
 * Smart Finance Manager — Oracle DB Setup Script
 * Run this ONCE to create all tables, sequences, views,
 * stored procedures, functions, and triggers.
 *
 * Usage: node setup.js
 *
 * Prerequisites:
 *  - Oracle XE running at 172.16.166.45:1521/XEPDB1
 *  - User "system" / "oracle123" (or set DB_USER, DB_PASSWORD, DB_CONNECT_STR in .env)
 */

const oracledb = require("oracledb");
const path     = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

const USER        = process.env.DB_USER        || "system";
const PASS        = process.env.DB_PASSWORD    || "oracle123";
const CONNECT_STR = process.env.DB_CONNECT_STR || "172.16.166.45:1521/XEPDB1";

// Helper: run a DDL statement; ignore ORA-00955 (already exists) etc.
async function run(conn, sql, ignoreErrors = []) {
  try {
    await conn.execute(sql);
  } catch (err) {
    if (ignoreErrors.includes(err.errorNum)) {
      return; // acceptable — object already exists
    }
    throw err;
  }
}

async function setup() {
  console.log("\n=== Smart Finance Manager — Oracle DB Setup ===");
  console.log(`Connecting to ${USER}@${CONNECT_STR} ...\n`);

  let conn;
  try {
    conn = await oracledb.getConnection({ user: USER, password: PASS, connectString: CONNECT_STR });
    console.log("✅ Connected to Oracle DB!\n");
  } catch (err) {
    console.error("❌ Cannot connect to Oracle DB!\n");
    console.error("   Error:", err.message);
    console.error("\n📋 To fix this:");
    console.error("   1. Make sure Oracle XE is running");
    console.error("   2. Check DB_USER, DB_PASSWORD, DB_CONNECT_STR in .env");
    console.error("   3. Run this script again: node setup.js\n");
    process.exit(1);
  }

  try {
    // ── SEQUENCES (replace AUTO_INCREMENT) ──────────────────────────────────
    console.log("Creating sequences...");
    await run(conn, "CREATE SEQUENCE seq_users      START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE", [955]);
    await run(conn, "CREATE SEQUENCE seq_accounts   START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE", [955]);
    await run(conn, "CREATE SEQUENCE seq_categories START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE", [955]);
    await run(conn, "CREATE SEQUENCE seq_transactions START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE", [955]);
    await run(conn, "CREATE SEQUENCE seq_budgets    START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE", [955]);
    await run(conn, "CREATE SEQUENCE seq_alerts         START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE", [955]);
    await run(conn, "CREATE SEQUENCE seq_subscriptions  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE", [955]);
    await run(conn, "CREATE SEQUENCE seq_loans          START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE", [955]);
    await run(conn, "CREATE SEQUENCE seq_bills          START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE", [955]);
    console.log("  ✅ Sequences created\n");

    // ── TABLES ────────────────────────────────────────────────────────────────
    console.log("Creating tables...");

    // ORA-00955 = name already used (table exists) → skip
    await run(conn, `
      CREATE TABLE users (
        user_id       NUMBER        PRIMARY KEY,
        name          VARCHAR2(100) NOT NULL,
        email         VARCHAR2(150) NOT NULL UNIQUE,
        password_hash VARCHAR2(255) NOT NULL,
        created_at    TIMESTAMP     DEFAULT SYSTIMESTAMP
      )
    `, [955]);

    await run(conn, `
      CREATE TABLE accounts (
        account_id   NUMBER        PRIMARY KEY,
        user_id      NUMBER        NOT NULL,
        account_name VARCHAR2(100) NOT NULL,
        account_type VARCHAR2(20)  DEFAULT 'bank'
                     CONSTRAINT chk_acc_type CHECK (account_type IN ('bank','cash','credit','savings')),
        balance      NUMBER(14,2)  DEFAULT 0 NOT NULL,
        created_at   TIMESTAMP     DEFAULT SYSTIMESTAMP,
        CONSTRAINT fk_acc_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `, [955]);

    await run(conn, `
      CREATE TABLE categories (
        category_id NUMBER        PRIMARY KEY,
        user_id     NUMBER        NOT NULL,
        name        VARCHAR2(80)  NOT NULL,
        type        VARCHAR2(10)  NOT NULL
                    CONSTRAINT chk_cat_type CHECK (type IN ('income','expense')),
        icon        VARCHAR2(20)  DEFAULT '💰',
        CONSTRAINT fk_cat_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT uniq_user_cat UNIQUE (user_id, name, type)
      )
    `, [955]);

    await run(conn, `
      CREATE TABLE transactions (
        transaction_id NUMBER       PRIMARY KEY,
        user_id        NUMBER       NOT NULL,
        account_id     NUMBER       NOT NULL,
        category_id    NUMBER       NOT NULL,
        amount         NUMBER(14,2) NOT NULL,
        txn_date       DATE         NOT NULL,
        description    VARCHAR2(255),
        created_at     TIMESTAMP    DEFAULT SYSTIMESTAMP,
        CONSTRAINT fk_txn_user FOREIGN KEY (user_id)     REFERENCES users(user_id)           ON DELETE CASCADE,
        CONSTRAINT fk_txn_acc  FOREIGN KEY (account_id)  REFERENCES accounts(account_id)     ON DELETE CASCADE,
        CONSTRAINT fk_txn_cat  FOREIGN KEY (category_id) REFERENCES categories(category_id)
      )
    `, [955]);

    await run(conn, `
      CREATE TABLE budgets (
        budget_id    NUMBER       PRIMARY KEY,
        user_id      NUMBER       NOT NULL,
        category_id  NUMBER       NOT NULL,
        limit_amount NUMBER(14,2) NOT NULL,
        start_date   DATE         NOT NULL,
        end_date     DATE         NOT NULL,
        CONSTRAINT fk_bud_user FOREIGN KEY (user_id)     REFERENCES users(user_id)           ON DELETE CASCADE,
        CONSTRAINT fk_bud_cat  FOREIGN KEY (category_id) REFERENCES categories(category_id)  ON DELETE CASCADE,
        CONSTRAINT uniq_user_cat_period UNIQUE (user_id, category_id, start_date)
      )
    `, [955]);

    await run(conn, `
      CREATE TABLE budget_alerts (
        alert_id     NUMBER       PRIMARY KEY,
        user_id      NUMBER       NOT NULL,
        budget_id    NUMBER       NOT NULL,
        message      VARCHAR2(255) NOT NULL,
        spent        NUMBER(14,2) NOT NULL,
        limit_amount NUMBER(14,2) NOT NULL,
        is_read      NUMBER(1)    DEFAULT 0 NOT NULL,
        created_at   TIMESTAMP    DEFAULT SYSTIMESTAMP,
        CONSTRAINT fk_alert_user FOREIGN KEY (user_id)   REFERENCES users(user_id)     ON DELETE CASCADE,
        CONSTRAINT fk_alert_bud  FOREIGN KEY (budget_id) REFERENCES budgets(budget_id) ON DELETE CASCADE
      )
    `, [955]);

    // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────
    await run(conn, `
      CREATE TABLE subscriptions (
        subscription_id  NUMBER        PRIMARY KEY,
        user_id          NUMBER        NOT NULL,
        merchant         VARCHAR2(255) NOT NULL,
        amount           NUMBER(14,2)  NOT NULL,
        interval_type    VARCHAR2(10)  NOT NULL
                         CONSTRAINT chk_sub_interval CHECK (interval_type IN ('monthly','weekly')),
        last_seen        DATE,
        is_active        NUMBER(1)     DEFAULT 1 NOT NULL,
        detected_at      TIMESTAMP     DEFAULT SYSTIMESTAMP,
        CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT uniq_sub_user_merchant UNIQUE (user_id, merchant, amount)
      )
    `, [955]);

    // ── LOANS ─────────────────────────────────────────────────────────────────
    await run(conn, `
      CREATE TABLE loans (
        loan_id          NUMBER        PRIMARY KEY,
        user_id          NUMBER        NOT NULL,
        lender_name      VARCHAR2(150) NOT NULL,
        principal        NUMBER(14,2)  NOT NULL,
        interest_rate    NUMBER(5,2)   DEFAULT 0,
        emi_amount       NUMBER(14,2)  NOT NULL,
        due_date         DATE          NOT NULL,
        paid_amount      NUMBER(14,2)  DEFAULT 0,
        status           VARCHAR2(20)  DEFAULT 'active'
                         CONSTRAINT chk_loan_status CHECK (status IN ('active','closed')),
        notes            VARCHAR2(500),
        created_at       TIMESTAMP     DEFAULT SYSTIMESTAMP,
        CONSTRAINT fk_loan_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `, [955]);

    // ── BILLS ─────────────────────────────────────────────────────────────────
    await run(conn, `
      CREATE TABLE bills (
        bill_id          NUMBER        PRIMARY KEY,
        user_id          NUMBER        NOT NULL,
        bill_name        VARCHAR2(150) NOT NULL,
        amount           NUMBER(14,2)  NOT NULL,
        due_date         DATE          NOT NULL,
        recurrence       VARCHAR2(20)  DEFAULT 'monthly'
                         CONSTRAINT chk_bill_rec CHECK (recurrence IN ('monthly','weekly','yearly','once')),
        is_paid          NUMBER(1)     DEFAULT 0 NOT NULL,
        reminder_days    NUMBER        DEFAULT 3,
        created_at       TIMESTAMP     DEFAULT SYSTIMESTAMP,
        CONSTRAINT fk_bill_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `, [955]);

    console.log("  ✅ Tables created\n");

    // ── VIEWS ─────────────────────────────────────────────────────────────────
    console.log("Creating views...");
    // ORA-00942 = table/view does not exist; ORA-04043 = object does not exist
    await run(conn, "DROP VIEW v_monthly_summary", [942]);
    await conn.execute(`
      CREATE VIEW v_monthly_summary AS
      SELECT u.user_id, u.name,
             TO_CHAR(t.txn_date,'YYYY-MM')  AS month,
             SUM(CASE WHEN c.type='income'  THEN t.amount ELSE 0 END) AS total_income,
             SUM(CASE WHEN c.type='expense' THEN t.amount ELSE 0 END) AS total_expense,
             SUM(CASE WHEN c.type='income'  THEN t.amount ELSE -t.amount END) AS net_savings
      FROM users u
      JOIN transactions t ON t.user_id = u.user_id
      JOIN categories   c ON c.category_id = t.category_id
      GROUP BY u.user_id, u.name, TO_CHAR(t.txn_date,'YYYY-MM')
    `);

    await run(conn, "DROP VIEW v_category_spend", [942]);
    await conn.execute(`
      CREATE VIEW v_category_spend AS
      SELECT t.user_id, c.category_id, c.name AS category, c.type,
             SUM(t.amount) AS total
      FROM transactions t
      JOIN categories c ON c.category_id = t.category_id
      GROUP BY t.user_id, c.category_id, c.name, c.type
    `);
    console.log("  ✅ Views created\n");

    // ── STORED PROCEDURES ─────────────────────────────────────────────────────
    console.log("Creating stored procedures...");

    // add_transaction: inserts txn row + updates account balance atomically
    await conn.execute(`
      CREATE OR REPLACE PROCEDURE add_transaction(
        p_user_id     IN NUMBER,
        p_account_id  IN NUMBER,
        p_category_id IN NUMBER,
        p_amount      IN NUMBER,
        p_date        IN DATE,
        p_desc        IN VARCHAR2
      ) AS
        v_type VARCHAR2(10);
      BEGIN
        SELECT type INTO v_type FROM categories WHERE category_id = p_category_id;
        INSERT INTO transactions(transaction_id, user_id, account_id, category_id, amount, txn_date, description)
        VALUES (seq_transactions.NEXTVAL, p_user_id, p_account_id, p_category_id, p_amount, p_date, p_desc);
        IF v_type = 'income' THEN
          UPDATE accounts SET balance = balance + p_amount WHERE account_id = p_account_id;
        ELSE
          UPDATE accounts SET balance = balance - p_amount WHERE account_id = p_account_id;
        END IF;
        COMMIT;
      EXCEPTION
        WHEN OTHERS THEN
          ROLLBACK;
          RAISE;
      END;
    `);

    // transfer_between_accounts
    await conn.execute(`
      CREATE OR REPLACE PROCEDURE transfer_between_accounts(
        p_user_id IN NUMBER, p_from IN NUMBER, p_to IN NUMBER, p_amount IN NUMBER
      ) AS
      BEGIN
        UPDATE accounts SET balance = balance - p_amount WHERE account_id = p_from AND user_id = p_user_id;
        UPDATE accounts SET balance = balance + p_amount WHERE account_id = p_to   AND user_id = p_user_id;
        COMMIT;
      EXCEPTION
        WHEN OTHERS THEN
          ROLLBACK;
          RAISE;
      END;
    `);
    console.log("  ✅ Stored procedures created\n");

    // ── FUNCTIONS ─────────────────────────────────────────────────────────────
    console.log("Creating functions...");

    await conn.execute(`
      CREATE OR REPLACE FUNCTION fn_total_income(
        p_user_id IN NUMBER, p_from IN DATE, p_to IN DATE
      ) RETURN NUMBER IS
        v NUMBER;
      BEGIN
        SELECT NVL(SUM(t.amount), 0) INTO v
        FROM transactions t
        JOIN categories c ON c.category_id = t.category_id
        WHERE t.user_id = p_user_id AND c.type = 'income'
          AND t.txn_date BETWEEN p_from AND p_to;
        RETURN v;
      END;
    `);

    await conn.execute(`
      CREATE OR REPLACE FUNCTION fn_total_expense(
        p_user_id IN NUMBER, p_from IN DATE, p_to IN DATE
      ) RETURN NUMBER IS
        v NUMBER;
      BEGIN
        SELECT NVL(SUM(t.amount), 0) INTO v
        FROM transactions t
        JOIN categories c ON c.category_id = t.category_id
        WHERE t.user_id = p_user_id AND c.type = 'expense'
          AND t.txn_date BETWEEN p_from AND p_to;
        RETURN v;
      END;
    `);

    await conn.execute(`
      CREATE OR REPLACE FUNCTION fn_savings(
        p_user_id IN NUMBER, p_from IN DATE, p_to IN DATE
      ) RETURN NUMBER IS
      BEGIN
        RETURN fn_total_income(p_user_id, p_from, p_to)
             - fn_total_expense(p_user_id, p_from, p_to);
      END;
    `);
    console.log("  ✅ Functions created\n");

    // ── TRIGGERS ──────────────────────────────────────────────────────────────
    console.log("Creating triggers...");

    // trg_budget_alert is intentionally DROPPED:
    // Budget alert logic is handled in Node.js (transactions.js → checkBudgetAlert)
    // to avoid ORA-04091 (mutating table) when reading TRANSACTIONS inside
    // a trigger that fires on INSERT INTO TRANSACTIONS.
    await run(conn, "DROP TRIGGER trg_budget_alert", [4080]); // ORA-04080 = trigger does not exist

    // trg_txn_delete: reverses account balance when a transaction is deleted
    await conn.execute(`
      CREATE OR REPLACE TRIGGER trg_txn_delete
      AFTER DELETE ON transactions
      FOR EACH ROW
      DECLARE
        v_type VARCHAR2(10);
      BEGIN
        SELECT type INTO v_type FROM categories WHERE category_id = :OLD.category_id;
        IF v_type = 'income' THEN
          UPDATE accounts SET balance = balance - :OLD.amount WHERE account_id = :OLD.account_id;
        ELSE
          UPDATE accounts SET balance = balance + :OLD.amount WHERE account_id = :OLD.account_id;
        END IF;
      END;
    `);
    console.log("  ✅ Triggers created\n");

    console.log("=== Setup complete! ===");
    console.log("Oracle DB is ready. Start the server: node server.js\n");

  } catch (err) {
    console.error("❌ Setup failed:", err.message);
    console.error(err);
  } finally {
    await conn.close();
  }
}

setup();
