/**
 * auth.js — JWT authentication middleware
 * Verifies the Bearer token attached to every protected request.
 * Sets req.user = { userId, email, name } on success.
 */

const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "smartfinance_jwt_secret_2026";

function auth(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "No token provided" });

  const token = header.replace("Bearer ", "").trim();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = auth;
