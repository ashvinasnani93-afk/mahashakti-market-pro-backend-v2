// ==================================================
// LONG-TERM EQUITY DECISION ENGINE (PHASE-L1 FINAL)
// HOLD / PARTIAL EXIT / FULL EXIT
// CONDITION BASED – NO FIXED TIME – NO PREDICTION
// ==================================================

const { applyLongTermSafety } = require("./longTermSafety.service");

/**
 * decideLongTermAction
 * @param {object} data
 * @returns {object}
 *
 * Required:
 * - symbol
 * - weeklyTrend   (UPTREND / DOWNTREND / SIDEWAYS)
 * - monthlyTrend  (UPTREND / DOWNTREND / SIDEWAYS)
 * - entryPrice
 * - currentPrice
 * - timeInTradeDays (number, optional)
 */
function decideLongTermAction(data = {}) {
  const {
    symbol,
    weeklyTrend,
    monthlyTrend,
    entryPrice,
    currentPrice,
    timeInTradeDays,
  } = data;

  // --------------------------------------------------
  // HARD INPUT VALIDATION
  // --------------------------------------------------
  if (
    !symbol ||
    !weeklyTrend ||
    !monthlyTrend ||
    typeof entryPrice !== "number" ||
    typeof currentPrice !== "number"
  ) {
    return {
      status: "WAIT",
      action: "NO_DECISION",
      reason: "Insufficient long-term input data",
    };
  }

  // --------------------------------------------------
  // SAFETY LAYER (LOCKED – NON NEGOTIABLE)
  // --------------------------------------------------
  const safetyResult = applyLongTermSafety({
    weeklyTrend,
    monthlyTrend,
  });

  if (safetyResult.status !== "SAFE") {
    return {
      status: "WAIT",
      action: "NO_DECISION",
      reason: safetyResult.reason,
    };
  }

  // --------------------------------------------------
  // PROFIT / LOSS CONTEXT (TEXT ONLY – NOT DECISION DRIVER)
  // --------------------------------------------------
  const pnlPercent =
    ((currentPrice - entryPrice) / entryPrice) * 100;

  // --------------------------------------------------
  // TIME IN TRADE CONTEXT (TEXT ONLY)
  // --------------------------------------------------
  let timeContext = "Holding period not specified";
  if (typeof timeInTradeDays === "number") {
    if (timeInTradeDays < 90) {
      timeContext = "Early stage long-term holding";
    } else if (timeInTradeDays < 365) {
      timeContext = "Mid-stage long-term holding";
    } else {
      timeContext = "Mature long-term holding";
    }
  }

  // --------------------------------------------------
  // CORE LONG-TERM LOGIC (LOCKED)
  // --------------------------------------------------

  // 🟢 STRONG HOLD CONDITION
  if (
    weeklyTrend === "UPTREND" &&
    monthlyTrend === "UPTREND"
  ) {
    return {
      status: "OK",
      action: "HOLD",
      confidence: "HIGH",
      trendContext: "Weekly and Monthly trends aligned upward",
      timeContext,
      pnlContext: `Approx P&L: ${pnlPercent.toFixed(2)}%`,
      note:
        "Long-term structure strong. No exit pressure. Continue holding.",
    };
  }

  // 🟡 PARTIAL EXIT CONDITION
  if (
    weeklyTrend === "DOWNTREND" &&
    monthlyTrend === "UPTREND"
  ) {
    return {
      status: "OK",
      action: "PARTIAL_EXIT",
      confidence: "MEDIUM",
      trendContext:
        "Weekly trend weakened, monthly trend still supportive",
      timeContext,
      pnlContext: `Approx P&L: ${pnlPercent.toFixed(2)}%`,
      note:
        "Structural caution phase. Partial profit booking can reduce risk.",
    };
  }

  // 🔴 FULL EXIT CONDITION
  if (
    weeklyTrend === "DOWNTREND" &&
    monthlyTrend === "DOWNTREND"
  ) {
    return {
      status: "OK",
      action: "FULL_EXIT",
      confidence: "HIGH",
      trendContext: "Weekly and Monthly structure broken",
      timeContext,
      pnlContext: `Approx P&L: ${pnlPercent.toFixed(2)}%`,
      note:
        "Long-term trend damage confirmed. Capital protection prioritized.",
    };
  }

  // --------------------------------------------------
  // DEFAULT SAFE HOLD
  // --------------------------------------------------
  return {
    status: "OK",
    action: "HOLD",
    confidence: "LOW",
    trendContext: "Mixed or sideways long-term structure",
    timeContext,
    pnlContext: `Approx P&L: ${pnlPercent.toFixed(2)}%`,
    note:
      "No clear breakdown. Hold with patience and monitor structure.",
  };
}

// ==================================================
// EXPORT
// ==================================================
module.exports = {
  decideLongTermAction,
};
