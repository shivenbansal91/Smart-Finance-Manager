/**
 * routes/categories.js — List, Create, Delete categories  (Oracle DB version)
 *
 * Fix for ORA-01745:
 *  - Replaced RETURNING INTO with: SELECT seq.NEXTVAL FROM DUAL then plain INSERT
 *  - Column names normalised UPPERCASE → lowercase before sending to client
 */

const express     = require("express");
const { execute } = require("../config/db");
const auth        = require("../middleware/auth");

const router = express.Router();

// ── GET /api/categories ──────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await execute(
      "SELECT category_id, user_id, name, type, icon FROM categories WHERE user_id = :1 ORDER BY type, name",
      [req.user.userId]
    );
    const rows = (result.rows || []).map(r => ({
      category_id: r.CATEGORY_ID,
      user_id:     r.USER_ID,
      name:        r.NAME,
      type:        r.TYPE,
      icon:        r.ICON,
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/categories ─────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { name, type, icon = "💰" } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: "Category name is required" });
  if (!["income", "expense"].includes(type))
    return res.status(400).json({ error: "Type must be 'income' or 'expense'" });

  try {
    // Step 1: get next PK — no RETURNING INTO needed
    const seqResult = await execute("SELECT seq_categories.NEXTVAL AS nid FROM DUAL", []);
    const newId = seqResult.rows[0].NID;

    // Step 2: plain INSERT with all positional binds
    await execute(
      `INSERT INTO categories (category_id, user_id, name, type, icon)
       VALUES (:1, :2, :3, :4, :5)`,
      [newId, req.user.userId, name.trim(), type, icon],
      { autoCommit: true }
    );

    // Step 3: fetch newly inserted row
    const result = await execute(
      "SELECT category_id, user_id, name, type, icon FROM categories WHERE category_id = :1",
      [newId]
    );
    const r = result.rows[0];
    res.json({
      category_id: r.CATEGORY_ID,
      user_id:     r.USER_ID,
      name:        r.NAME,
      type:        r.TYPE,
      icon:        r.ICON,
    });
  } catch (err) {
    if (err.errorNum === 1)
      return res.status(409).json({ error: "A category with this name and type already exists" });
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/categories/:id ───────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await execute(
      "DELETE FROM categories WHERE category_id = :1 AND user_id = :2",
      [req.params.id, req.user.userId],
      { autoCommit: true }
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.errorNum === 2292)
      return res.status(409).json({ error: "Category is used by transactions — delete those first" });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
