/**
 * db.js — Oracle DB connection pool (oracledb)
 * Exported helpers: connectDB(), getPool(), execute()
 * Call connectDB() at server startup BEFORE app.listen().
 */

const oracledb = require("oracledb");
const path     = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// Use thin mode (no Oracle Client installation needed)
//oracledb.initOracleClient();   // comment this out if using Thin mode only

// Return rows as plain objects instead of arrays
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Auto-commit by default (routes that need transactions manage commits manually)
oracledb.autoCommit = true;

let pool = null;

async function connectDB() {
  try {
    pool = await oracledb.createPool({
      user:             process.env.DB_USER        || "system",
      password:         process.env.DB_PASSWORD    || "oracle123",
      connectString:    process.env.DB_CONNECT_STR || "localhost:1521/XEPDB1",
      poolMin:          2,
      poolMax:          10,
      poolIncrement:    1,
    });

    // Eagerly verify the connection is reachable
    const conn = await pool.getConnection();
    await conn.close();
    console.log(`✅ Oracle DB connected → ${process.env.DB_CONNECT_STR || "localhost:1521/XEPDB1"}`);
  } catch (err) {
    console.error("\n❌ Cannot connect to Oracle DB!");
    console.error("   Error:", err.message);
    console.error("   Check: DB_USER, DB_PASSWORD, DB_CONNECT_STR in .env\n");
    throw err;
  }
}

function getPool() {
  return pool;
}

/**
 * Convenience wrapper — borrows a connection from pool, runs query, releases it.
 * Returns { rows, outBinds, rowsAffected, lastRowid }
 *
 * @param {string} sql    — SQL with :1/:2 bind placeholders
 * @param {Array}  binds  — positional bind values  (default [])
 * @param {object} opts   — extra oracledb execute options
 */
async function execute(sql, binds = [], opts = {}) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.execute(sql, binds, opts);
    return result;
  } finally {
    await conn.close();
  }
}

module.exports = { connectDB, getPool, execute };
