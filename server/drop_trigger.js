/**
 * drop_trigger.js — One-time script to drop the TRG_BUDGET_ALERT trigger
 *
 * This trigger causes ORA-04091 (mutating table) because it reads from
 * TRANSACTIONS inside a trigger that fires on INSERT INTO TRANSACTIONS.
 * Budget alert logic has been moved to Node.js instead.
 *
 * Usage:  cd server && node drop_trigger.js
 */

const oracledb = require("oracledb");
const path     = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function main() {
  const conn = await oracledb.getConnection({
    user:          process.env.DB_USER        || "system",
    password:      process.env.DB_PASSWORD    || "oracle123",
    connectString: process.env.DB_CONNECT_STR || "localhost:1521/XEPDB1",
  });

  try {
    await conn.execute("DROP TRIGGER TRG_BUDGET_ALERT");
    console.log("✅ TRG_BUDGET_ALERT dropped successfully.");
    console.log("   Budget alerts are now handled by Node.js (no more ORA-04091).");
  } catch (err) {
    if (err.errorNum === 4080) {
      // ORA-04080: trigger does not exist — already dropped, that's fine
      console.log("ℹ️  TRG_BUDGET_ALERT does not exist — nothing to drop.");
    } else {
      console.error("❌ Failed:", err.message);
    }
  } finally {
    await conn.close();
  }
}

main();
