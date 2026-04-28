/**
 * routes/alerts.js — Budget alert notifications  (Oracle DB version)
 *
 * Alerts are written automatically by the Oracle trigger trg_budget_alert
 * whenever a transaction pushes spending past 80% or 100% of a budget.
 *
 * Oracle rules:
 *  - is_read stored as NUMBER(1) (0/1)
 *  - LIMIT 10 → FETCH FIRST 10 ROWS ONLY
 *  - Column names UPPERCASED — normalized to lowercase here
 */

const express     = require("express");
const { execute } = require("../config/db");
const auth        = require("../middleware/auth");

const router = express.Router();

// ── GET /api/budget-alerts (unread alerts, latest 10) ─────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await execute(
      `SELECT ba.alert_id, ba.user_id, ba.budget_id, ba.message,
              ba.spent, ba.limit_amount, ba.is_read, ba.created_at,
              c.name AS category_name,
              c.icon AS category_icon
       FROM budget_alerts ba
       JOIN budgets     b ON b.budget_id    = ba.budget_id
       JOIN categories  c ON c.category_id  = b.category_id
       WHERE ba.user_id = :1 AND ba.is_read = 0
       ORDER BY ba.created_at DESC
       FETCH FIRST 10 ROWS ONLY`,
      [req.user.userId]
    );
    const rows = (result.rows || []).map(r => ({
      alert_id:      r.ALERT_ID,
      user_id:       r.USER_ID,
      budget_id:     r.BUDGET_ID,
      message:       r.MESSAGE,
      spent:         Number(r.SPENT),
      limit_amount:  Number(r.LIMIT_AMOUNT),
      is_read:       r.IS_READ,
      created_at:    r.CREATED_AT,
      category_name: r.CATEGORY_NAME,
      category_icon: r.CATEGORY_ICON,
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/budget-alerts/count (unread count for badge) ────────────────────
router.get("/count", auth, async (req, res) => {
  try {
    const result = await execute(
      "SELECT COUNT(*) AS cnt FROM budget_alerts WHERE user_id = :1 AND is_read = 0",
      [req.user.userId]
    );
    res.json({ count: Number(result.rows[0].CNT) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/budget-alerts/:id/read (mark one alert as read) ───────────────
router.patch("/:id/read", auth, async (req, res) => {
  try {
    await execute(
      "UPDATE budget_alerts SET is_read = 1 WHERE alert_id = :1 AND user_id = :2",
      [req.params.id, req.user.userId],
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
