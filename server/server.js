/**
 * server.js — Smart Finance Manager API
 *
 * Startup order (race condition fix):
 *   1. Connect to Oracle DB  ← FIRST
 *   2. Start listening       ← only after DB is ready
 *
 * Routes:
 *   POST   /api/auth/signup
 *   POST   /api/auth/signin
 *   GET    /api/auth/me
 *   GET    /api/accounts
 *   POST   /api/accounts
 *   DELETE /api/accounts/:id
 *   GET    /api/categories
 *   POST   /api/categories
 *   DELETE /api/categories/:id
 *   GET    /api/transactions
 *   POST   /api/transactions
 *   DELETE /api/transactions/:id
 *   GET    /api/budgets
 *   POST   /api/budgets
 *   DELETE /api/budgets/:id
 *   GET    /api/budget-alerts
 *   GET    /api/budget-alerts/count
 *   PATCH  /api/budget-alerts/:id/read
 *   GET    /api/dashboard
 *   GET    /api/health
 */

const express = require("express");
const cors    = require("cors");
const path    = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { connectDB, execute } = require("./config/db");

// ── Route modules ─────────────────────────────────────────────────────────────
const authRoutes        = require("./routes/auth");
const accountRoutes     = require("./routes/accounts");
const categoryRoutes    = require("./routes/categories");
const transactionRoutes = require("./routes/transactions");
const budgetRoutes      = require("./routes/budgets");
const alertRoutes       = require("./routes/alerts");
const dashboardRoutes   = require("./routes/dashboard");

const app  = express();
const PORT = process.env.API_PORT || 3001;

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(express.json());
app.use(cors({ origin: "*", credentials: true }));

// ── Root route (friendly info page) ──────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    name:    "Smart Finance Manager API",
    version: "1.0.0",
    status:  "running",
    db:      "Oracle XE",
    docs:    "Use /api/health to verify DB connection",
  });
});

// ── Health check (public — no auth) ──────────────────────────────────────────
app.get("/api/health", async (req, res) => {
  try {
    await execute("SELECT 1 FROM DUAL");
    res.json({ ok: true, db: process.env.DB_CONNECT_STR || "172.16.166.45:1521/XEPDB1" });
  } catch {
    res.status(503).json({ ok: false, error: "Oracle DB query failed" });
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",           authRoutes);
app.use("/api/accounts",       accountRoutes);
app.use("/api/categories",     categoryRoutes);
app.use("/api/transactions",   transactionRoutes);
app.use("/api/budgets",        budgetRoutes);
app.use("/api/budget-alerts",  alertRoutes);
app.use("/api/dashboard",      dashboardRoutes);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Startup: connect DB FIRST, then listen ───────────────────────────────────
async function start() {
  try {
    await connectDB();           // ← establish pool and verify connection
    app.listen(PORT, () => {
      console.log(`\n🚀 Smart Finance API  → http://localhost:${PORT}`);
      console.log(`   Frontend           → http://localhost:8080  (npm run dev)\n`);
    });
  } catch {
    // connectDB already printed the error details
    process.exit(1);
  }
}

start();
