/**
 * routes/accounts.js — List, Create, Delete accounts  (Oracle DB version)
 *
 * Fix for ORA-01745:
 *  - Replaced RETURNING INTO with: SELECT seq.NEXTVAL FROM DUAL then plain INSERT
 *  - Column names normalised UPPERCASE → lowercase before sending to client
 */

const express     = require("express");
const { execute } = require("../config/db");
const auth        = require("../middleware/auth");

const router = express.Router();

// ── GET /api/accounts ────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await execute(
      `SELECT account_id, user_id, account_name, account_type, balance, created_at
       FROM accounts WHERE user_id = :1 ORDER BY created_at`,
      [req.user.userId]
    );
    const rows = (result.rows || []).map(r => ({
      account_id:   r.ACCOUNT_ID,
      user_id:      r.USER_ID,
      account_name: r.ACCOUNT_NAME,
      account_type: r.ACCOUNT_TYPE,
      balance:      Number(r.BALANCE),
      created_at:   r.CREATED_AT,
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/accounts ───────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { account_name, account_type = "bank", balance = 0 } = req.body;
  if (!account_name || !account_name.trim())
    return res.status(400).json({ error: "Account name is required" });

  const validTypes = ["bank", "cash", "credit", "savings"];
  if (!validTypes.includes(account_type))
    return res.status(400).json({ error: `account_type must be one of: ${validTypes.join(", ")}` });

  try {
    // Step 1: get next PK
    const seqResult = await execute("SELECT seq_accounts.NEXTVAL AS nid FROM DUAL", []);
    const newId = seqResult.rows[0].NID;

    // Step 2: plain INSERT
    await execute(
      `INSERT INTO accounts (account_id, user_id, account_name, account_type, balance)
       VALUES (:1, :2, :3, :4, :5)`,
      [newId, req.user.userId, account_name.trim(), account_type, Number(balance)],
      { autoCommit: true }
    );

    // Step 3: fetch the new row
    const result = await execute(
      `SELECT account_id, user_id, account_name, account_type, balance, created_at
       FROM accounts WHERE account_id = :1`,
      [newId]
    );
    const r = result.rows[0];
    res.json({
      account_id:   r.ACCOUNT_ID,
      user_id:      r.USER_ID,
      account_name: r.ACCOUNT_NAME,
      account_type: r.ACCOUNT_TYPE,
      balance:      Number(r.BALANCE),
      created_at:   r.CREATED_AT,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/accounts/:id ─────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await execute(
      "DELETE FROM accounts WHERE account_id = :1 AND user_id = :2",
      [req.params.id, req.user.userId],
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/accounts/:id/balance — set the current balance directly ────────
// Used by the "Edit balance" dialog so users can enter what they actually have.
router.patch("/:id/balance", auth, async (req, res) => {
  const { balance } = req.body;
  if (balance === undefined || balance === null || isNaN(Number(balance)))
    return res.status(400).json({ error: "balance is required and must be a number" });

  try {
    await execute(
      "UPDATE accounts SET balance = :1 WHERE account_id = :2 AND user_id = :3",
      [Number(balance), req.params.id, req.user.userId],
      { autoCommit: true }
    );
    const result = await execute(
      `SELECT account_id, user_id, account_name, account_type, balance, created_at
       FROM accounts WHERE account_id = :1`,
      [req.params.id]
    );
    if (!result.rows || result.rows.length === 0)
      return res.status(404).json({ error: "Account not found" });
    const r = result.rows[0];
    res.json({
      account_id:   r.ACCOUNT_ID,
      user_id:      r.USER_ID,
      account_name: r.ACCOUNT_NAME,
      account_type: r.ACCOUNT_TYPE,
      balance:      Number(r.BALANCE),
      created_at:   r.CREATED_AT,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
