/**
 * routes/loans.js — Loan / Debt Manager
 *
 * GET    /api/loans            — list loans
 * POST   /api/loans            — add loan
 * PATCH  /api/loans/:id/pay   — record EMI payment
 * PATCH  /api/loans/:id/close — mark as closed
 * DELETE /api/loans/:id       — delete
 * GET    /api/loans/due        — loans due in next 7 days
 */

const express     = require("express");
const { execute } = require("../config/db");
const auth        = require("../middleware/auth");

const router = express.Router();

function normalizeRow(r) {
  const principal      = Number(r.PRINCIPAL);
  const paidAmount     = Number(r.PAID_AMOUNT);
  const interestRate   = Number(r.INTEREST_RATE) || 0;
  const emiAmount      = Number(r.EMI_AMOUNT);
  const remaining      = Math.max(0, principal - paidAmount);
  const progressPct    = principal > 0 ? Math.min(100, Math.round((paidAmount / principal) * 100)) : 0;
  // Monthly interest on remaining balance (simple reducing balance approx)
  const monthlyInterest = interestRate > 0 ? Math.round((remaining * interestRate / 100 / 12) * 100) / 100 : 0;
  // Effective monthly outflow = EMI + current month's interest
  const effectiveEmi   = emiAmount + monthlyInterest;

  return {
    loan_id:          r.LOAN_ID,
    user_id:          r.USER_ID,
    lender_name:      r.LENDER_NAME,
    principal,
    interest_rate:    interestRate,
    emi_amount:       emiAmount,
    due_date:         r.DUE_DATE,
    paid_amount:      paidAmount,
    remaining_balance: remaining,
    progress_pct:     progressPct,
    monthly_interest: monthlyInterest,
    effective_emi:    effectiveEmi,
    status:           r.STATUS,
    notes:            r.NOTES,
    created_at:       r.CREATED_AT,
  };
}

// ── GET /api/loans ────────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await execute(
      `SELECT * FROM loans WHERE user_id = :1 ORDER BY due_date ASC`,
      [req.user.userId]
    );
    res.json((result.rows || []).map(normalizeRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/loans/due ────────────────────────────────────────────────────────
router.get("/due", auth, async (req, res) => {
  try {
    const result = await execute(
      `SELECT * FROM loans
       WHERE user_id = :1
         AND status  = 'active'
         AND due_date BETWEEN SYSDATE AND SYSDATE + 7
       ORDER BY due_date ASC`,
      [req.user.userId]
    );
    res.json((result.rows || []).map(normalizeRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/loans ───────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { lender_name, principal, interest_rate = 0, emi_amount, due_date, notes, credit_account_id } = req.body;
  if (!lender_name || !principal || !emi_amount || !due_date)
    return res.status(400).json({ error: "lender_name, principal, emi_amount, and due_date are required" });
  if (Number(principal) <= 0 || Number(emi_amount) <= 0)
    return res.status(400).json({ error: "principal and emi_amount must be > 0" });

  try {
    const seqRes = await execute("SELECT seq_loans.NEXTVAL AS nid FROM DUAL");
    const id     = seqRes.rows[0].NID;
    await execute(
      `INSERT INTO loans (loan_id, user_id, lender_name, principal, interest_rate, emi_amount, due_date, notes)
       VALUES (:1, :2, :3, :4, :5, :6, TO_DATE(:7, 'YYYY-MM-DD'), :8)`,
      [id, req.user.userId, lender_name, Number(principal), Number(interest_rate), Number(emi_amount), due_date, notes || null],
      { autoCommit: true }
    );
    // Credit principal to chosen account (loan disbursement)
    if (credit_account_id) {
      await execute(
        `UPDATE accounts SET balance = balance + :1 WHERE account_id = :2 AND user_id = :3`,
        [Number(principal), Number(credit_account_id), req.user.userId],
        { autoCommit: true }
      );
    }
    const result = await execute("SELECT * FROM loans WHERE loan_id = :1", [id]);
    res.json(normalizeRow(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/loans/:id/pay ─────────────────────────────────────────────────
router.patch("/:id/pay", auth, async (req, res) => {
  const { amount, debit_account_id } = req.body;
  if (!amount || Number(amount) <= 0)
    return res.status(400).json({ error: "payment amount must be > 0" });

  try {
    await execute(
      `UPDATE loans
       SET paid_amount = paid_amount + :amount,
           status = CASE WHEN (paid_amount + :amount) >= principal THEN 'closed' ELSE status END
       WHERE loan_id = :loanId AND user_id = :userId`,
      { amount: Number(amount), loanId: Number(req.params.id), userId: req.user.userId },
      { autoCommit: true }
    );
    // Debit payment from chosen account
    if (debit_account_id) {
      await execute(
        `UPDATE accounts SET balance = balance - :1 WHERE account_id = :2 AND user_id = :3`,
        [Number(amount), Number(debit_account_id), req.user.userId],
        { autoCommit: true }
      );
    }
    const result = await execute("SELECT * FROM loans WHERE loan_id = :1", [req.params.id]);
    res.json(normalizeRow(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/loans/:id/close ───────────────────────────────────────────────
router.patch("/:id/close", auth, async (req, res) => {
  try {
    await execute(
      `UPDATE loans SET status = 'closed' WHERE loan_id = :1 AND user_id = :2`,
      [req.params.id, req.user.userId],
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/loans/:id ─────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await execute(
      "DELETE FROM loans WHERE loan_id = :1 AND user_id = :2",
      [req.params.id, req.user.userId],
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
