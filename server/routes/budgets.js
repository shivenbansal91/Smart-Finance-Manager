/**
 * routes/budgets.js — List, Create, Delete budgets  (Oracle DB version)
 *
 * Fix for ORA-01745:
 *  - Replaced RETURNING INTO with: SELECT seq.NEXTVAL FROM DUAL then plain INSERT
 *  - Dates sent as JS strings → bind with TO_DATE(:n, 'YYYY-MM-DD')
 *  - NVL replaces COALESCE
 *  - Column names normalised UPPERCASE → lowercase
 */

const express     = require("express");
const { execute } = require("../config/db");
const auth        = require("../middleware/auth");

const router = express.Router();

// ── GET /api/budgets (with real-time `spent` amount) ─────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await execute(
      `SELECT b.budget_id, b.user_id, b.category_id,
              b.limit_amount, b.start_date, b.end_date,
              c.name AS category_name,
              c.icon AS category_icon,
              NVL(
                (SELECT SUM(t.amount)
                 FROM transactions t
                 WHERE t.user_id     = b.user_id
                   AND t.category_id = b.category_id
                   AND t.txn_date   BETWEEN b.start_date AND b.end_date),
              0) AS spent
       FROM budgets b
       JOIN categories c ON c.category_id = b.category_id
       WHERE b.user_id = :1
       ORDER BY b.start_date DESC`,
      [req.user.userId]
    );
    const rows = (result.rows || []).map(r => ({
      budget_id:     r.BUDGET_ID,
      user_id:       r.USER_ID,
      category_id:   r.CATEGORY_ID,
      limit_amount:  Number(r.LIMIT_AMOUNT),
      start_date:    r.START_DATE,
      end_date:      r.END_DATE,
      category_name: r.CATEGORY_NAME,
      category_icon: r.CATEGORY_ICON,
      spent:         Number(r.SPENT),
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/budgets ────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { category_id, limit_amount, start_date, end_date } = req.body;
  if (!category_id || !limit_amount || !start_date || !end_date)
    return res.status(400).json({ error: "category_id, limit_amount, start_date, and end_date are required" });
  if (Number(limit_amount) <= 0)
    return res.status(400).json({ error: "Limit amount must be greater than 0" });
  if (new Date(start_date) > new Date(end_date))
    return res.status(400).json({ error: "Start date must be before end date" });

  try {
    // Step 1: get next PK
    const seqResult = await execute("SELECT seq_budgets.NEXTVAL AS nid FROM DUAL", []);
    const newId = seqResult.rows[0].NID;

    // Step 2: plain INSERT — TO_DATE handles string→date conversion
    await execute(
      `INSERT INTO budgets (budget_id, user_id, category_id, limit_amount, start_date, end_date)
       VALUES (:1, :2, :3, :4, TO_DATE(:5, 'YYYY-MM-DD'), TO_DATE(:6, 'YYYY-MM-DD'))`,
      [newId, req.user.userId, Number(category_id), Number(limit_amount), start_date, end_date],
      { autoCommit: true }
    );

    // Step 3: fetch the new row with category join
    const result = await execute(
      `SELECT b.budget_id, b.user_id, b.category_id,
              b.limit_amount, b.start_date, b.end_date,
              c.name AS category_name,
              c.icon AS category_icon,
              0 AS spent
       FROM budgets b
       JOIN categories c ON c.category_id = b.category_id
       WHERE b.budget_id = :1`,
      [newId]
    );
    const r = result.rows[0];
    res.json({
      budget_id:     r.BUDGET_ID,
      user_id:       r.USER_ID,
      category_id:   r.CATEGORY_ID,
      limit_amount:  Number(r.LIMIT_AMOUNT),
      start_date:    r.START_DATE,
      end_date:      r.END_DATE,
      category_name: r.CATEGORY_NAME,
      category_icon: r.CATEGORY_ICON,
      spent:         0,
    });
  } catch (err) {
    if (err.errorNum === 1)
      return res.status(409).json({ error: "A budget for this category and period already exists" });
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/budgets/:id ──────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await execute(
      "DELETE FROM budgets WHERE budget_id = :1 AND user_id = :2",
      [req.params.id, req.user.userId],
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
