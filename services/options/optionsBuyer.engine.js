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
  // HARD SAFETY
  // -----------------------------------
  if (!safety) {
    return {
      buyerAllowed: false,
      reason: "Buyer blocked: safety context missing",
    };
  }

  if (safety.isExpiryDay || safety.isResultDay) {
    return {
      buyerAllowed: false,
      reason: "Buyer blocked: expiry / result day risk",
    };
  }

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
  // RSI SANITY
  // -----------------------------------
  if (typeof rsi !== "number") {
    return {
      buyerAllowed: false,
      reason: "Buyer blocked: RSI data missing",
    };
  }

  if (rsi >= 70) {
    return {
      buyerAllowed: false,
      reason: "Buyer blocked: RSI overbought",
    };
  }

  if (rsi <= 30) {
    return {
      buyerAllowed: false,
      reason: "Buyer blocked: RSI oversold",
    };
  }

  // -----------------------------------
  // VIX SAFETY (LOCKED – SOFT)
  // -----------------------------------
  if (typeof vix === "number" && vix >= 18) {
    return {
      buyerAllowed: false,
      reason: "Buyer blocked: high volatility (VIX)",
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
