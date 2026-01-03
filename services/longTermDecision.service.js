// ==================================================
// LONG-TERM EQUITY DECISION ENGINE (PHASE-L)
// HOLD / PARTIAL EXIT / FULL EXIT
// RULE-LOCKED | NO FIXED TIME | NO PREDICTION
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
 * - timeInTradeDays (number)
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
  // SAFETY LAYER (LOCKED)
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
  // PROFIT / LOSS CONTEXT (TEXT ONLY)
  // --------------------------------------------------
  const pnlPercent =
    ((currentPrice - entryPrice) / entryPrice) * 100;

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
      pnlPercent: Number(pnlPercent.toFixed(2)),
      note:
        "Weekly and Monthly trends aligned upward. Long-term HOLD advised.",
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
      pnlPercent: Number(pnlPercent.toFixed(2)),
      note:
        "Weekly trend weakened but monthly trend intact. Partial profit booking advised.",
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
      pnlPercent: Number(pnlPercent.toFixed(2)),
      note:
        "Weekly and Monthly trends both down. Long-term exit advised.",
    };
  }

  // --------------------------------------------------
  // DEFAULT SAFE HOLD
  // --------------------------------------------------
  return {
    status: "OK",
    action: "HOLD",
    confidence: "LOW",
    pnlPercent: Number(pnlPercent.toFixed(2)),
    note:
      "Trend mixed but no structural breakdown. Continue holding with caution.",
  };
}

// ==================================================
// EXPORT
// ==================================================
module.exports = {
  decideLongTermAction,
};
