/**
 * routes/transactions.js — List, Create, Delete transactions  (Oracle DB version)
 *
 * ORA-04091 FIX:
 *  The trg_budget_alert trigger SELECTs from TRANSACTIONS while the INSERT
 *  inside add_transaction is still active → "mutating table" error.
 *  Solution: Drop budget alert from the trigger; handle it here in Node.js
 *  AFTER the stored procedure commits, using a plain autonomous query.
 */

const express     = require("express");
const { execute } = require("../config/db");
const auth        = require("../middleware/auth");

const router = express.Router();

/** Normalize an uppercase Oracle transaction row to lowercase keys */
function normalizeRow(r) {
  if (!r) return null;
  return {
    transaction_id: r.TRANSACTION_ID,
    user_id:        r.USER_ID,
    account_id:     r.ACCOUNT_ID,
    category_id:    r.CATEGORY_ID,
    amount:         Number(r.AMOUNT),
    txn_date:       r.TXN_DATE,
    description:    r.DESCRIPTION,
    created_at:     r.CREATED_AT,
    account_name:   r.ACCOUNT_NAME,
    category_name:  r.CATEGORY_NAME,
    category_type:  r.CATEGORY_TYPE,
    category_icon:  r.CATEGORY_ICON,
  };
}

/**
 * Check budget thresholds after a transaction insert and create alerts if needed.
 * Called AFTER add_transaction() commits — no mutating table issue here.
 */
async function checkBudgetAlert(userId, categoryId, txnDate) {
  try {
    // Find any budget covering this category + date
    const budRes = await execute(
      `SELECT budget_id, limit_amount, start_date, end_date
       FROM budgets
       WHERE user_id     = :1
         AND category_id = :2
         AND TO_DATE(:3, 'YYYY-MM-DD') BETWEEN start_date AND end_date
         AND ROWNUM = 1`,
      [userId, categoryId, txnDate]
    );

    if (!budRes.rows || budRes.rows.length === 0) return; // no budget

    const b = budRes.rows[0];
    const budgetId   = b.BUDGET_ID;
    const limitAmt   = Number(b.LIMIT_AMOUNT);
    const startDate  = b.START_DATE;
    const endDate    = b.END_DATE;

    // Total spent in this budget period (now that txn is committed)
    const spentRes = await execute(
      `SELECT NVL(SUM(amount), 0) AS spent
       FROM transactions
       WHERE user_id     = :1
         AND category_id = :2
         AND txn_date BETWEEN :3 AND :4`,
      [userId, categoryId, startDate, endDate]
    );
    const spent = Number(spentRes.rows[0].SPENT);

    let message = null;
    if (spent >= limitAmt) {
      message = `Budget exceeded! Spent ${spent.toFixed(2)} of ${limitAmt.toFixed(2)}`;
    } else if (spent >= limitAmt * 0.8) {
      message = `80% of budget used: ${spent.toFixed(2)}/${limitAmt.toFixed(2)}`;
    }

    if (message) {
      const seqRes = await execute("SELECT seq_alerts.NEXTVAL AS nid FROM DUAL", []);
      const alertId = seqRes.rows[0].NID;
      await execute(
        `INSERT INTO budget_alerts (alert_id, user_id, budget_id, message, spent, limit_amount)
         VALUES (:1, :2, :3, :4, :5, :6)`,
        [alertId, userId, budgetId, message, spent, limitAmt],
        { autoCommit: true }
      );
    }
  } catch (err) {
    // Non-fatal — log but don't fail the transaction
    console.error("⚠️  Budget alert check failed:", err.message);
  }
}

// ── GET /api/transactions (latest 200, joined with account + category) ────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await execute(
      `SELECT t.transaction_id, t.user_id, t.account_id, t.category_id,
              t.amount, t.txn_date, t.description, t.created_at,
              a.account_name,
              c.name AS category_name,
              c.type AS category_type,
              c.icon AS category_icon
       FROM transactions t
       JOIN accounts   a ON a.account_id  = t.account_id
       JOIN categories c ON c.category_id = t.category_id
       WHERE t.user_id = :1
       ORDER BY t.txn_date DESC, t.created_at DESC
       FETCH FIRST 200 ROWS ONLY`,
      [req.user.userId]
    );
    res.json((result.rows || []).map(normalizeRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/transactions ────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { account_id, category_id, amount, txn_date, description } = req.body;
  if (!account_id || !category_id || !amount || !txn_date)
    return res.status(400).json({ error: "account_id, category_id, amount, and txn_date are required" });
  if (Number(amount) <= 0)
    return res.status(400).json({ error: "Amount must be greater than 0" });

  try {
    // Call stored procedure — it does the INSERT + balance update + COMMIT
    await execute(
      `BEGIN add_transaction(:1, :2, :3, :4, TO_DATE(:5, 'YYYY-MM-DD'), :6); END;`,
      [
        req.user.userId,
        Number(account_id),
        Number(category_id),
        Number(amount),
        txn_date,
        description || null,
      ],
      { autoCommit: false } // procedure does its own COMMIT
    );

    // Fetch the newly created row
    const result = await execute(
      `SELECT t.transaction_id, t.user_id, t.account_id, t.category_id,
              t.amount, t.txn_date, t.description, t.created_at,
              a.account_name,
              c.name AS category_name,
              c.type AS category_type,
              c.icon AS category_icon
       FROM transactions t
       JOIN accounts   a ON a.account_id  = t.account_id
       JOIN categories c ON c.category_id = t.category_id
       WHERE t.user_id = :1
       ORDER BY t.transaction_id DESC
       FETCH FIRST 1 ROWS ONLY`,
      [req.user.userId]
    );

    const newTxn = normalizeRow(result.rows[0]);
    res.json(newTxn);

    // Check budget alerts AFTER responding — async, non-blocking
    // This avoids ORA-04091 (mutating table) because the txn is fully committed
    checkBudgetAlert(req.user.userId, Number(category_id), txn_date);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/transactions/:id ──────────────────────────────────────────────
// trg_txn_delete trigger auto-reverses the account balance on delete
router.delete("/:id", auth, async (req, res) => {
  try {
    await execute(
      "DELETE FROM transactions WHERE transaction_id = :1 AND user_id = :2",
      [req.params.id, req.user.userId],
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
