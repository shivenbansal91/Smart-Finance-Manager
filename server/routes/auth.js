/**
 * routes/auth.js — Sign up, Sign in, Me  (Oracle DB version)
 *
 * KEY approach:
 *  - Avoid RETURNING INTO entirely (causes ORA-01745 bind name issues)
 *  - Instead: SELECT seq.NEXTVAL FROM DUAL → use that as a plain :1 bind
 *  - On signup: seed default categories + 1 default account for the user
 *  - Column names UPPERCASED by oracledb — normalised on the way out
 */

const express     = require("express");
const bcrypt      = require("bcryptjs");
const jwt         = require("jsonwebtoken");
const { execute } = require("../config/db");
const authMW      = require("../middleware/auth");

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "smartfinance_jwt_secret_2026";

// ── Default categories seeded for every new user ─────────────────────────────
const DEFAULT_CATEGORIES = [
  // Income
  { name: "Salary",       type: "income",  icon: "💼" },
  { name: "Freelance",    type: "income",  icon: "💻" },
  { name: "Investments",  type: "income",  icon: "📈" },
  { name: "Gifts",        type: "income",  icon: "🎁" },
  { name: "Other Income", type: "income",  icon: "💰" },
  // Expense
  { name: "Food & Dining",   type: "expense", icon: "🍕" },
  { name: "Transportation",  type: "expense", icon: "🚗" },
  { name: "Shopping",        type: "expense", icon: "🛒" },
  { name: "Healthcare",      type: "expense", icon: "💊" },
  { name: "Entertainment",   type: "expense", icon: "🎬" },
  { name: "Utilities",       type: "expense", icon: "💡" },
  { name: "Rent / Housing",  type: "expense", icon: "🏠" },
  { name: "Education",       type: "expense", icon: "📚" },
  { name: "Other Expense",   type: "expense", icon: "📦" },
];

// ── Default accounts seeded for every new user ────────────────────────────────
const DEFAULT_ACCOUNTS = [
  { name: "Main Bank Account", type: "bank",   balance: 0 },
  { name: "Cash Wallet",       type: "cash",   balance: 0 },
];

/**
 * Seed default categories and accounts for a newly created user.
 * Runs sequentially (non-critical — errors are logged, not thrown).
 */
async function seedDefaults(userId) {
  try {
    for (const cat of DEFAULT_CATEGORIES) {
      const seqR = await execute("SELECT seq_categories.NEXTVAL AS nid FROM DUAL", []);
      const newId = seqR.rows[0].NID;
      await execute(
        `INSERT INTO categories (category_id, user_id, name, type, icon)
         VALUES (:1, :2, :3, :4, :5)`,
        [newId, userId, cat.name, cat.type, cat.icon],
        { autoCommit: true }
      );
    }

    for (const acc of DEFAULT_ACCOUNTS) {
      const seqR = await execute("SELECT seq_accounts.NEXTVAL AS nid FROM DUAL", []);
      const newId = seqR.rows[0].NID;
      await execute(
        `INSERT INTO accounts (account_id, user_id, account_name, account_type, balance)
         VALUES (:1, :2, :3, :4, :5)`,
        [newId, userId, acc.name, acc.type, acc.balance],
        { autoCommit: true }
      );
    }

    console.log(`✅ Seeded defaults for user ${userId}`);
  } catch (seedErr) {
    console.error("⚠️  Seed defaults failed (non-fatal):", seedErr.message);
  }
}

// ── POST /api/auth/signup ────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email, and password are required" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    const hash = await bcrypt.hash(password, 10);

    // Get next PK from sequence first — avoids RETURNING INTO entirely
    const seqResult = await execute("SELECT seq_users.NEXTVAL AS nid FROM DUAL", []);
    const userId = seqResult.rows[0].NID;

    await execute(
      `INSERT INTO users (user_id, name, email, password_hash)
       VALUES (:1, :2, :3, :4)`,
      [userId, name.trim(), email.toLowerCase().trim(), hash],
      { autoCommit: true }
    );

    // Seed defaults in background (don't await — faster response)
    seedDefaults(userId);

    const cleanEmail = email.toLowerCase().trim();
    const cleanName  = name.trim();
    const token = jwt.sign({ userId, email: cleanEmail, name: cleanName }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { userId, email: cleanEmail, name: cleanName } });
  } catch (err) {
    if (err.errorNum === 1)
      return res.status(409).json({ error: "An account with this email already exists" });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/signin ────────────────────────────────────────────────────
router.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const result = await execute(
      "SELECT user_id, name, email, password_hash FROM users WHERE email = :1",
      [email.toLowerCase().trim()]
    );

    if (!result.rows || result.rows.length === 0)
      return res.status(401).json({ error: "Invalid email or password" });

    const user = result.rows[0];
    const ok   = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!ok)
      return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { userId: user.USER_ID, email: user.EMAIL, name: user.NAME },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token, user: { userId: user.USER_ID, email: user.EMAIL, name: user.NAME } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", authMW, (req, res) => {
  res.json({ user: req.user });
});

// ── DELETE /api/auth/account  (permanently delete user + all data) ───────────
router.delete("/account", authMW, async (req, res) => {
  try {
    // FK CASCADE deletes all accounts, categories, transactions, budgets, alerts
    await execute(
      "DELETE FROM users WHERE user_id = :1",
      [req.user.userId],
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
