/**
 * routes/subscriptions.js — Automatic Subscription Detection
 *
 * GET    /api/subscriptions          — list stored subscriptions
 * POST   /api/subscriptions/detect   — run detection on transactions
 * PATCH  /api/subscriptions/:id/toggle — toggle active status
 * DELETE /api/subscriptions/:id      — remove a subscription
 */

const express     = require("express");
const { execute } = require("../config/db");
const auth        = require("../middleware/auth");

const router = express.Router();

function normalizeRow(r) {
  return {
    subscription_id: r.SUBSCRIPTION_ID,
    user_id:         r.USER_ID,
    merchant:        r.MERCHANT,
    amount:          Number(r.AMOUNT),
    interval_type:   r.INTERVAL_TYPE,
    last_seen:       r.LAST_SEEN,
    is_active:       r.IS_ACTIVE,
    detected_at:     r.DETECTED_AT,
  };
}

// ── detect_subscriptions(transactions) ────────────────────────────────────────
function detect_subscriptions(txns) {
  // Group expense transactions by description (merchant proxy) + amount
  const groups = {};
  for (const t of txns) {
    if (!t.description) continue;
    const merchant = t.description.trim().toLowerCase();
    const key      = `${merchant}||${t.amount}`;
    if (!groups[key]) groups[key] = { merchant: t.description.trim(), amount: Number(t.amount), dates: [] };
    groups[key].dates.push(new Date(t.txn_date));
  }

  const detected = [];
  for (const { merchant, amount, dates } of Object.values(groups)) {
    if (dates.length < 2) continue; // need at least 2 occurrences
    dates.sort((a, b) => a - b);

    // Calculate gaps between consecutive occurrences
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      const diffDays = Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      gaps.push(diffDays);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    let interval_type = null;
    if (avgGap >= 25 && avgGap <= 35)  interval_type = "monthly";
    if (avgGap >= 5  && avgGap <= 9)   interval_type = "weekly";

    if (interval_type) {
      detected.push({ merchant, amount, interval_type, last_seen: dates[dates.length - 1] });
    }
  }
  return detected;
}

// ── GET /api/subscriptions ────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await execute(
      `SELECT * FROM subscriptions WHERE user_id = :1 ORDER BY amount DESC`,
      [req.user.userId]
    );
    const subs = (result.rows || []).map(normalizeRow);

    const monthlyTotal = subs
      .filter(s => s.is_active && s.interval_type === "monthly")
      .reduce((sum, s) => sum + s.amount, 0);
    const weeklyTotal = subs
      .filter(s => s.is_active && s.interval_type === "weekly")
      .reduce((sum, s) => sum + s.amount * 4, 0); // weekly × 4 ≈ monthly

    res.json({ subscriptions: subs, monthlyTotal: monthlyTotal + weeklyTotal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/subscriptions/detect ───────────────────────────────────────────
router.post("/detect", auth, async (req, res) => {
  try {
    // Fetch last 6 months of expense transactions with descriptions
    const result = await execute(
      `SELECT t.amount, t.txn_date, t.description
       FROM transactions t
       JOIN categories c ON c.category_id = t.category_id
       WHERE t.user_id = :1
         AND c.type = 'expense'
         AND t.description IS NOT NULL
         AND t.txn_date >= ADD_MONTHS(SYSDATE, -6)
       ORDER BY t.txn_date`,
      [req.user.userId]
    );

    const txns     = (result.rows || []).map(r => ({
      amount:      Number(r.AMOUNT),
      txn_date:    r.TXN_DATE,
      description: r.DESCRIPTION,
    }));
    const detected = detect_subscriptions(txns);

    let upserted = 0;
    for (const sub of detected) {
      // Check if already exists
      const exists = await execute(
        `SELECT subscription_id FROM subscriptions WHERE user_id = :1 AND LOWER(merchant) = :2 AND amount = :3`,
        [req.user.userId, sub.merchant.toLowerCase(), sub.amount]
      );

      if (exists.rows && exists.rows.length > 0) {
        // Update last_seen
        await execute(
          `UPDATE subscriptions SET last_seen = :1, detected_at = SYSTIMESTAMP WHERE subscription_id = :2`,
          [sub.last_seen, exists.rows[0].SUBSCRIPTION_ID],
          { autoCommit: true }
        );
      } else {
        const seqRes = await execute("SELECT seq_subscriptions.NEXTVAL AS nid FROM DUAL");
        const id     = seqRes.rows[0].NID;
        await execute(
          `INSERT INTO subscriptions (subscription_id, user_id, merchant, amount, interval_type, last_seen)
           VALUES (:1, :2, :3, :4, :5, :6)`,
          [id, req.user.userId, sub.merchant, sub.amount, sub.interval_type, sub.last_seen],
          { autoCommit: true }
        );
        upserted++;
      }
    }

    res.json({ ok: true, detected: detected.length, newlyAdded: upserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/subscriptions/:id/toggle ──────────────────────────────────────
router.patch("/:id/toggle", auth, async (req, res) => {
  try {
    await execute(
      `UPDATE subscriptions SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END
       WHERE subscription_id = :1 AND user_id = :2`,
      [req.params.id, req.user.userId],
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/subscriptions/:id ────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await execute(
      "DELETE FROM subscriptions WHERE subscription_id = :1 AND user_id = :2",
      [req.params.id, req.user.userId],
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
