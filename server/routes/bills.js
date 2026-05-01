/**
 * routes/bills.js — Bill Reminder System
 *
 * GET    /api/bills          — list all bills
 * POST   /api/bills          — create bill
 * GET    /api/bills/due      — bills due within reminder_days (unpaid)
 * PATCH  /api/bills/:id/pay  — mark as paid + advance due date for recurring
 * DELETE /api/bills/:id      — delete
 */

const express     = require("express");
const { execute } = require("../config/db");
const auth        = require("../middleware/auth");

const router = express.Router();

function normalizeRow(r) {
  const dueDate  = r.DUE_DATE ? new Date(r.DUE_DATE) : null;
  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = dueDate
    ? Math.round((dueDate - today) / (1000 * 60 * 60 * 24))
    : null;

  return {
    bill_id:       r.BILL_ID,
    user_id:       r.USER_ID,
    bill_name:     r.BILL_NAME,
    amount:        Number(r.AMOUNT),
    due_date:      r.DUE_DATE,
    recurrence:    r.RECURRENCE,
    is_paid:       r.IS_PAID,
    reminder_days: r.REMINDER_DAYS,
    created_at:    r.CREATED_AT,
    days_until_due: daysUntilDue,
    is_overdue:    daysUntilDue !== null && daysUntilDue < 0 && !r.IS_PAID,
    is_due_soon:   daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= (r.REMINDER_DAYS || 3),
  };
}

/** Advance a date by one recurrence cycle */
function advanceDueDate(due, recurrence) {
  const d = new Date(due);
  switch (recurrence) {
    case "weekly":  d.setDate(d.getDate() + 7);     break;
    case "monthly": d.setMonth(d.getMonth() + 1);   break;
    case "yearly":  d.setFullYear(d.getFullYear() + 1); break;
    default:        break; // 'once' — no advance
  }
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── GET /api/bills ────────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await execute(
      `SELECT * FROM bills WHERE user_id = :1 ORDER BY due_date ASC`,
      [req.user.userId]
    );
    res.json((result.rows || []).map(normalizeRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bills/due ────────────────────────────────────────────────────────
router.get("/due", auth, async (req, res) => {
  try {
    const result = await execute(
      `SELECT * FROM bills
       WHERE user_id = :1
         AND is_paid = 0
         AND due_date <= SYSDATE + reminder_days
       ORDER BY due_date ASC`,
      [req.user.userId]
    );
    res.json((result.rows || []).map(normalizeRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/bills ───────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { bill_name, amount, due_date, recurrence = "monthly", reminder_days = 3 } = req.body;
  if (!bill_name || !amount || !due_date)
    return res.status(400).json({ error: "bill_name, amount, and due_date are required" });
  if (Number(amount) <= 0)
    return res.status(400).json({ error: "amount must be > 0" });

  try {
    const seqRes = await execute("SELECT seq_bills.NEXTVAL AS nid FROM DUAL");
    const id     = seqRes.rows[0].NID;
    await execute(
      `INSERT INTO bills (bill_id, user_id, bill_name, amount, due_date, recurrence, reminder_days)
       VALUES (:1, :2, :3, :4, TO_DATE(:5, 'YYYY-MM-DD'), :6, :7)`,
      [id, req.user.userId, bill_name, Number(amount), due_date, recurrence, Number(reminder_days)],
      { autoCommit: true }
    );
    const result = await execute("SELECT * FROM bills WHERE bill_id = :1", [id]);
    res.json(normalizeRow(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/bills/:id/pay ─────────────────────────────────────────────────
router.patch("/:id/pay", auth, async (req, res) => {
  try {
    const billRes = await execute(
      "SELECT * FROM bills WHERE bill_id = :1 AND user_id = :2",
      [req.params.id, req.user.userId]
    );
    if (!billRes.rows || billRes.rows.length === 0)
      return res.status(404).json({ error: "Bill not found" });

    const bill = billRes.rows[0];

    if (bill.RECURRENCE === "once") {
      // One-time bill: just mark paid
      await execute(
        "UPDATE bills SET is_paid = 1 WHERE bill_id = :1",
        [req.params.id],
        { autoCommit: true }
      );
    } else {
      // Recurring: advance due date and reset paid status
      const nextDue = advanceDueDate(bill.DUE_DATE, bill.RECURRENCE);
      await execute(
        `UPDATE bills SET is_paid = 0, due_date = TO_DATE(:1, 'YYYY-MM-DD') WHERE bill_id = :2`,
        [nextDue, req.params.id],
        { autoCommit: true }
      );
    }

    const result = await execute("SELECT * FROM bills WHERE bill_id = :1", [req.params.id]);
    res.json(normalizeRow(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/bills/:id ─────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await execute(
      "DELETE FROM bills WHERE bill_id = :1 AND user_id = :2",
      [req.params.id, req.user.userId],
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
