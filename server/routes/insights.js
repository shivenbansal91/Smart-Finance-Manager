/**
 * routes/insights.js — AI Spending Insights Engine
 *
 * Rule-based engine that analyses the user's transactions and generates
 * human-readable insights. Optionally enriches them with Gemini AI
 * (GEMINI_API_KEY in .env).
 *
 * GET /api/insights
 */

const express     = require("express");
const { execute } = require("../config/db");
const auth        = require("../middleware/auth");

const router = express.Router();

// ── Gemini setup (optional) ───────────────────────────────────────────────────
let geminiModel = null;
try {
  if (process.env.GEMINI_API_KEY) {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Try current model names in order — fall back if one is unavailable
    const MODEL_PREFERENCE = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash"];
    geminiModel = genAI.getGenerativeModel({ model: MODEL_PREFERENCE[0] });
    // Store fallbacks for use in enrichWithGemini
    geminiModel._genAI = genAI;
    geminiModel._modelFallbacks = MODEL_PREFERENCE;
    console.log(`✅ Gemini AI ready (${MODEL_PREFERENCE[0]})`);
  }
} catch (e) {
  console.warn("⚠️  Gemini SDK not available — rule-based insights only");
}

// ── Rule-based engine ─────────────────────────────────────────────────────────

/**
 * Generate insights from raw transaction data.
 * @param {object[]} txns  — rows from Oracle (lowercase keys)
 * @returns {object[]}     — list of insight objects
 */
function generate_insights(txns) {
  const insights  = [];
  const now       = new Date();
  const curMonth  = now.getMonth();
  const curYear   = now.getFullYear();
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
  const prevYear  = curMonth === 0 ? curYear - 1 : curYear;

  const expenses = txns.filter(t => t.category_type === "expense");
  const income   = txns.filter(t => t.category_type === "income");

  if (txns.length === 0) {
    return [{ type: "info", icon: "info", text: "No transactions found yet. Start adding transactions to unlock insights.", suggestion: null }];
  }

  // ── 1. Monthly comparison per category ──────────────────────────────────────
  const byCatMonth = {};
  for (const t of expenses) {
    const d = new Date(t.txn_date);
    const key = `${t.category_name}`;
    if (!byCatMonth[key]) byCatMonth[key] = { cur: 0, prev: 0 };
    if (d.getMonth() === curMonth  && d.getFullYear() === curYear)  byCatMonth[key].cur  += Number(t.amount);
    if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) byCatMonth[key].prev += Number(t.amount);
  }

  for (const [cat, { cur, prev }] of Object.entries(byCatMonth)) {
    if (prev === 0 || cur === 0) continue;
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (Math.abs(pct) < 10) continue; // ignore tiny fluctuations

    if (pct > 0) {
      insights.push({
        type: "warning",
        icon: "trending-up",
        text: `You spent ${pct}% more on ${cat} this month vs last month (₹${cur.toFixed(0)} vs ₹${prev.toFixed(0)}).`,
        suggestion: pct >= 30 ? `Consider reducing ${cat} spending to save ₹${Math.round(cur - prev)}/month.` : null,
      });
    } else {
      insights.push({
        type: "success",
        icon: "trending-down",
        text: `Great job! You spent ${Math.abs(pct)}% less on ${cat} this month (₹${cur.toFixed(0)} vs ₹${prev.toFixed(0)}).`,
        suggestion: null,
      });
    }
  }

  // ── 2. Top 3 expense categories (all-time) ──────────────────────────────────
  const catTotals = {};
  for (const t of expenses) {
    catTotals[t.category_name] = (catTotals[t.category_name] || 0) + Number(t.amount);
  }
  const top3 = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (top3.length > 0) {
    const names = top3.map(([name]) => name).join(", ");
    insights.push({
      type: "info",
      icon: "bar-chart",
      text: `Your top ${top3.length} spending categories are: ${names}.`,
      suggestion: `Focus on reducing spend in "${top3[0][0]}" — your biggest expense at ₹${top3[0][1].toFixed(0)}.`,
    });
  }

  // ── 3. Weekend vs Weekday spending ──────────────────────────────────────────
  let weekendTotal = 0, weekdayTotal = 0;
  let weekendCount = 0, weekdayCount = 0;
  for (const t of expenses) {
    const day = new Date(t.txn_date).getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) { weekendTotal += Number(t.amount); weekendCount++; }
    else                        { weekdayTotal += Number(t.amount); weekdayCount++; }
  }
  if (weekendCount > 0 && weekdayCount > 0) {
    const avgWeekend = weekendTotal / weekendCount;
    const avgWeekday = weekdayTotal / weekdayCount;
    const wRatio     = Math.round(((avgWeekend - avgWeekday) / avgWeekday) * 100);
    if (wRatio > 20) {
      insights.push({
        type: "warning",
        icon: "calendar",
        text: `Weekend spending is ${wRatio}% higher than weekdays on average (₹${avgWeekend.toFixed(0)} vs ₹${avgWeekday.toFixed(0)} per transaction).`,
        suggestion: "Try setting a weekend budget to control impulse spending.",
      });
    } else if (wRatio < -20) {
      insights.push({
        type: "success",
        icon: "calendar",
        text: `You spend less on weekends — weekday avg ₹${avgWeekday.toFixed(0)} vs weekend avg ₹${avgWeekend.toFixed(0)}.`,
        suggestion: null,
      });
    }
  }

  // ── 4. Savings rate this month ───────────────────────────────────────────────
  const thisMonthIncome  = income.filter(t  => { const d = new Date(t.txn_date);  return d.getMonth() === curMonth && d.getFullYear() === curYear; }).reduce((s, t) => s + Number(t.amount), 0);
  const thisMonthExpense = expenses.filter(t => { const d = new Date(t.txn_date); return d.getMonth() === curMonth && d.getFullYear() === curYear; }).reduce((s, t) => s + Number(t.amount), 0);
  if (thisMonthIncome > 0) {
    const savingsRate = Math.round(((thisMonthIncome - thisMonthExpense) / thisMonthIncome) * 100);
    if (savingsRate < 10) {
      insights.push({
        type: "danger",
        icon: "alert-triangle",
        text: `Your savings rate this month is only ${savingsRate}%. Expenses (₹${thisMonthExpense.toFixed(0)}) are very close to income (₹${thisMonthIncome.toFixed(0)}).`,
        suggestion: "Aim for at least 20% savings. Review recurring expenses.",
      });
    } else if (savingsRate >= 30) {
      insights.push({
        type: "success",
        icon: "piggy-bank",
        text: `Excellent! You're saving ${savingsRate}% of your income this month (₹${(thisMonthIncome - thisMonthExpense).toFixed(0)} saved).`,
        suggestion: "Consider investing the surplus in an SIP or FD.",
      });
    } else {
      insights.push({
        type: "info",
        icon: "piggy-bank",
        text: `You're saving ${savingsRate}% of your income this month. That's a decent start!`,
        suggestion: "Aim for 30% savings by trimming discretionary spending.",
      });
    }
  }

  // ── 5. Largest single expense ────────────────────────────────────────────────
  if (expenses.length > 0) {
    const largest = expenses.reduce((a, b) => Number(a.amount) > Number(b.amount) ? a : b);
    if (Number(largest.amount) > 5000) {
      insights.push({
        type: "info",
        icon: "zap",
        text: `Largest single expense: ₹${Number(largest.amount).toFixed(0)} on "${largest.description || largest.category_name}".`,
        suggestion: null,
      });
    }
  }

  return insights.length > 0 ? insights : [
    { type: "info", icon: "info", text: "Keep tracking your transactions for personalised insights!", suggestion: null },
  ];
}

// ── Loan payoff advisor ────────────────────────────────────────────────────────────
function generate_loan_insights(loans, txns) {
  if (!loans.length) return [];
  const insights = [];
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear  = now.getFullYear();

  // 3-month avg income & expense from transactions
  const recent = txns.filter(t => {
    const d = new Date(t.txn_date);
    return (curYear - d.getFullYear()) * 12 + (curMonth - d.getMonth()) <= 3;
  });
  const avgIncome  = recent.filter(t => t.category_type === "income") .reduce((s,t) => s + t.amount, 0) / 3;
  const avgExpense = recent.filter(t => t.category_type === "expense").reduce((s,t) => s + t.amount, 0) / 3;
  const monthlyNet = avgIncome - avgExpense;

  const totalEmi  = loans.reduce((s, l) => s + l.emi_amount, 0);
  const totalDebt = loans.reduce((s, l) => s + l.remaining_balance, 0);
  const surplus   = monthlyNet - totalEmi;

  // ── Overall debt burden ──
  insights.push({
    type: surplus < 0 ? "danger" : "info",
    icon: "landmark",
    text: `You have ${loans.length} active loan(s) with ₹${totalDebt.toFixed(0)} remaining. Monthly EMI: ₹${totalEmi.toFixed(0)}.`,
    suggestion: surplus < 0
      ? `Your EMIs (₹${totalEmi.toFixed(0)}) exceed your net monthly cash flow (₹${monthlyNet.toFixed(0)}). Prioritise reducing discretionary expenses.`
      : `After EMIs you have ~₹${surplus.toFixed(0)} buffer monthly — consider putting part of it toward extra loan repayments.`,
  });

  // ── Per-loan payoff timeline ──
  for (const loan of loans) {
    if (loan.emi_amount <= 0) continue;
    const monthsLeft = Math.ceil(loan.remaining_balance / loan.emi_amount);
    const yrs = Math.floor(monthsLeft / 12);
    const mos = monthsLeft % 12;
    const timeStr = yrs > 0 ? `${yrs}yr ${mos}mo` : `${mos} month(s)`;

    const extra = surplus > 0 ? Math.min(Math.round(surplus * 0.4), loan.remaining_balance) : 0;
    const fasterMonths = extra > 0 ? Math.ceil(loan.remaining_balance / (loan.emi_amount + extra)) : null;
    const savedMonths  = fasterMonths ? monthsLeft - fasterMonths : 0;

    insights.push({
      type: "loan",
      icon: "bar-chart",
      text: `"${loan.lender_name}" clears in ~${timeStr} at ₹${loan.emi_amount}/mo. Remaining: ₹${loan.remaining_balance.toFixed(0)}.`,
      suggestion: (fasterMonths && savedMonths > 0)
        ? `Paying ₹${extra} extra/month reduces payoff by ${savedMonths} month(s) — real interest savings!`
        : `Keep paying your EMI on time to stay on track.`,
    });
  }

  // ── Avalanche tip for multiple loans ──
  if (loans.length > 1) {
    const highRate = [...loans].sort((a, b) => b.interest_rate - a.interest_rate)[0];
    if (highRate.interest_rate > 0) {
      insights.push({
        type: "loan",
        icon: "zap",
        text: `Avalanche Strategy: Focus extra payments on "${highRate.lender_name}" (${highRate.interest_rate}% p.a.) — your highest-interest debt.`,
        suggestion: "Paying off high-interest debt first minimises total interest paid across all your loans.",
      });
    }
  }

  return insights;
}

// ── Gemini enrichment ─────────────────────────────────────────────────────────
async function enrichWithGemini(ruleInsights, txnSummary) {
  if (!geminiModel) return null;
  const genAI  = geminiModel._genAI;
  const models = geminiModel._modelFallbacks || ["gemini-2.0-flash"];

  const prompt = `
You are a personal finance advisor AI. Below is a brief summary of a user's finances:
${JSON.stringify(txnSummary, null, 2)}

Rule-based insights already generated:
${ruleInsights.map(i => "- " + i.text).join("\n")}

Generate 2-3 SHORT, friendly, actionable additional insights or tips (not repeating the above).
Format each as a JSON object array: [{"text": "...", "suggestion": "..."}]
Keep each text under 120 characters. Focus on practical advice.
Return ONLY the JSON array, no markdown or explanation.`;

  for (const modelName of models) {
    try {
      const model  = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const raw    = result.response.text().trim().replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);
      return parsed.map(item => ({
        type:       "ai",
        icon:       "sparkles",
        text:       item.text,
        suggestion: item.suggestion || null,
      }));
    } catch (err) {
      if (err.message && err.message.includes("404")) {
        console.warn(`⚠️  Model "${modelName}" unavailable, trying next…`);
        continue; // try the next model
      }
      console.warn("⚠️  Gemini enrichment failed:", err.message);
      return null;
    }
  }
  console.warn("⚠️  All Gemini models failed — returning rule-based insights only");
  return null;
}

// ── GET /api/insights ─────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await execute(
      `SELECT t.transaction_id, t.amount, t.txn_date, t.description,
              c.name AS category_name, c.type AS category_type
       FROM transactions t
       JOIN categories c ON c.category_id = t.category_id
       WHERE t.user_id = :1
         AND t.txn_date >= ADD_MONTHS(SYSDATE, -3)
       ORDER BY t.txn_date DESC`,
      [req.user.userId]
    );

    const txns = (result.rows || []).map(r => ({
      transaction_id: r.TRANSACTION_ID,
      amount:         Number(r.AMOUNT),
      txn_date:       r.TXN_DATE,
      description:    r.DESCRIPTION,
      category_name:  r.CATEGORY_NAME,
      category_type:  r.CATEGORY_TYPE,
    }));

    const ruleInsights = generate_insights(txns);

    // ── Loan payoff advisor ──
    const loansResult = await execute(
      `SELECT * FROM loans WHERE user_id = :1 AND status = 'active'`,
      [req.user.userId]
    );
    const activeLoans = (loansResult.rows || []).map(r => ({
      loan_id:           r.LOAN_ID,
      lender_name:       r.LENDER_NAME,
      principal:         Number(r.PRINCIPAL),
      interest_rate:     Number(r.INTEREST_RATE) || 0,
      emi_amount:        Number(r.EMI_AMOUNT),
      remaining_balance: Math.max(0, Number(r.PRINCIPAL) - Number(r.PAID_AMOUNT)),
    }));
    const loanInsights = generate_loan_insights(activeLoans, txns);

    // Build a compact summary for Gemini context
    const catTotals = {};
    txns.filter(t => t.category_type === "expense").forEach(t => {
      catTotals[t.category_name] = (catTotals[t.category_name] || 0) + t.amount;
    });
    const totalIncome  = txns.filter(t => t.category_type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpense = txns.filter(t => t.category_type === "expense").reduce((s, t) => s + t.amount, 0);
    const txnSummary   = { totalIncome, totalExpense, categoryBreakdown: catTotals, transactionCount: txns.length };

    const aiInsights  = await enrichWithGemini(ruleInsights, txnSummary);
    const allInsights = [
      ...ruleInsights,
      ...loanInsights,
      ...(aiInsights ?? []),
    ];

    res.json({
      insights:   allInsights,
      hasGemini:  !!geminiModel,
      generated:  new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
