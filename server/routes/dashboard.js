/**
 * routes/dashboard.js — Aggregated stats for the dashboard overview  (Oracle DB version)
 *
 * Returns:
 *   monthly   — income + expense totals for the last 6 months (bar chart)
 *   catSpend  — expense totals grouped by category (pie chart)
 *   totalIncome, totalExpense — all-time totals
 *   totalBalance — sum of all account balances
 *
 * Oracle differences vs MySQL:
 *  - DATE_FORMAT(d, '%b')    → TO_CHAR(d, 'Mon')
 *  - DATE_FORMAT(d, '%Y-%m') → TO_CHAR(d, 'YYYY-MM')
 *  - DATE_SUB(CURDATE(), INTERVAL 6 MONTH) → ADD_MONTHS(SYSDATE, -6)
 *  - HAVING total > 0        → use subquery / WHERE after aggregation
 */

const express     = require("express");
const { execute } = require("../config/db");
const auth        = require("../middleware/auth");

const router = express.Router();

// GET /api/dashboard
router.get("/", auth, async (req, res) => {
  const uid = req.user.userId;
  try {
    // Last 6 months — grouped by month
    const monthlyResult = await execute(
      `SELECT TO_CHAR(t.txn_date, 'Mon')    AS month,
              TO_CHAR(t.txn_date, 'YYYY-MM') AS month_key,
              SUM(CASE WHEN c.type = 'income'  THEN t.amount ELSE 0 END) AS income,
              SUM(CASE WHEN c.type = 'expense' THEN t.amount ELSE 0 END) AS expense
       FROM transactions t
       JOIN categories c ON c.category_id = t.category_id
       WHERE t.user_id  = :1
         AND t.txn_date >= ADD_MONTHS(SYSDATE, -6)
       GROUP BY TO_CHAR(t.txn_date, 'YYYY-MM'), TO_CHAR(t.txn_date, 'Mon')
       ORDER BY TO_CHAR(t.txn_date, 'YYYY-MM')`,
      [uid]
    );

    // Expense breakdown by category (all-time) — Oracle needs HAVING wrapped
    const catSpendResult = await execute(
      `SELECT category_name, type, total FROM (
         SELECT c.name AS category_name, c.type, SUM(t.amount) AS total
         FROM transactions t
         JOIN categories c ON c.category_id = t.category_id
         WHERE t.user_id = :1 AND c.type = 'expense'
         GROUP BY c.category_id, c.name, c.type
       ) WHERE total > 0`,
      [uid]
    );

    // All-time income and expense totals
    const totalsResult = await execute(
      `SELECT SUM(CASE WHEN c.type = 'income'  THEN t.amount ELSE 0 END) AS total_income,
              SUM(CASE WHEN c.type = 'expense' THEN t.amount ELSE 0 END) AS total_expense
       FROM transactions t
       JOIN categories c ON c.category_id = t.category_id
       WHERE t.user_id = :1`,
      [uid]
    );

    // Sum of all account balances
    const balanceResult = await execute(
      "SELECT NVL(SUM(balance), 0) AS total_balance FROM accounts WHERE user_id = :1",
      [uid]
    );

    const totals  = totalsResult.rows[0]  || {};
    const balance = balanceResult.rows[0] || {};

    res.json({
      monthly:      (monthlyResult.rows  || []).map(r => ({
        month:     r.MONTH,
        month_key: r.MONTH_KEY,
        income:    Number(r.INCOME)  || 0,
        expense:   Number(r.EXPENSE) || 0,
      })),
      catSpend:     (catSpendResult.rows || []).map(r => ({
        name:  r.CATEGORY_NAME,
        type:  r.TYPE,
        total: Number(r.TOTAL) || 0,
      })),
      totalIncome:  Number(totals.TOTAL_INCOME)   || 0,
      totalExpense: Number(totals.TOTAL_EXPENSE)  || 0,
      totalBalance: Number(balance.TOTAL_BALANCE) || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
