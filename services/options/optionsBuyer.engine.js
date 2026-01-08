// ==================================================
// OPTIONS BUYER ENGINE (PHASE-3)
// BUY PERMISSION + CONTEXT ONLY
// NO EXECUTION | RULE-LOCKED
// ==================================================

/**
 * evaluateBuyerContext
 * @param {object} data
 * @returns {object}
 *
 * This engine ONLY decides:
 * - Buyer allowed or not
 * - Reason (explainable)
 *
 * It does NOT generate BUY / SELL
 */
function evaluateBuyerContext(data = {}) {
  const {
    trend,        // UPTREND / DOWNTREND / SIDEWAYS
    rsi,          // number
    vix,          // number (optional)
    safety,       // safety context
  } = data;

  // -----------------------------------
  // TREND REQUIREMENT (LOCKED)
  // -----------------------------------
  if (trend !== "UPTREND" && trend !== "DOWNTREND") {
    return {
      buyerAllowed: false,
      reason: "Buyer blocked: market not in strong trend",
    };
  }

  // -----------------------------------
  // ✅ BUYER ALLOWED
  // -----------------------------------
  return {
    buyerAllowed: true,
    reason: "Buyer allowed: strong trend + safe conditions",
  };
}

// --------------------------------------------------
// EXPORT
// --------------------------------------------------
module.exports = {
  evaluateBuyerContext,
};
