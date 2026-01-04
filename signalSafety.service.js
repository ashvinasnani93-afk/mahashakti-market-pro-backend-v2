// ==========================================
// SIGNAL SAFETY SERVICE – PHASE 1 + C3.2
// FINAL SAFETY + CONTEXT LAYER
// (RULE-LOCKED IMPLEMENTATION)
// ==========================================

/**
 * applySafety
 * @param {object} signalResult
 * @param {object} context
 * @returns {object} FINAL SAFE SIGNAL
 */
function applySafety(signalResult, context = {}) {
  // -------------------------------
  // HARD SAFETY: invalid input
  // -------------------------------
  if (!signalResult || !signalResult.signal) {
    return {
      signal: "WAIT",
      reason: "Safety: invalid signal input",
      safety: "FAILED",
    };
  }

  // -------------------------------
  // CONTEXT DEFAULTS
  // -------------------------------
  const {
    isResultDay = false,
    isExpiryDay = false,
    tradeCountToday = 0,
    tradeType = "INTRADAY",
    vix = null, // 🟡 VIX CONTEXT (C3.2)
  } = context;

  // -------------------------------
  // RESULT DAY SAFETY (LOCKED)
  // -------------------------------
  if (isResultDay && signalResult.signal !== "WAIT") {
    return {
      ...signalResult,
      signal: "WAIT",
      reason: "Result-day safety active",
      safety: "BLOCKED",
    };
  }

  // -------------------------------
  // EXPIRY DAY SAFETY (LOCKED)
  // -------------------------------
  if (isExpiryDay && signalResult.signal !== "WAIT") {
    return {
      ...signalResult,
      signal: "WAIT",
      reason: "Expiry-day safety active",
      safety: "BLOCKED",
    };
  }

  // -------------------------------
  // OVERTRADE GUARD (LOCKED)
  // -------------------------------
  if (tradeCountToday >= 3 && signalResult.signal !== "WAIT") {
    return {
      ...signalResult,
      signal: "WAIT",
      reason: "Overtrade guard: daily limit reached",
      safety: "BLOCKED",
    };
  }

  // -------------------------------
  // EQUITY vs INTRADAY SAFETY (LOCKED)
  // -------------------------------
  if (tradeType === "EQUITY" && signalResult.signal === "SELL") {
    return {
      ...signalResult,
      signal: "WAIT",
      reason: "Equity safety: no panic sell allowed",
      safety: "BLOCKED",
    };
  }

  // -------------------------------
  // 🟡 VIX BEHAVIOR MESSAGE (C3.2 – NON-BLOCKING)
  // -------------------------------
  if (typeof vix === "number") {
    if (vix >= 20) {
      return {
        ...signalResult,
        note: "High volatility (VIX elevated) – trade with caution",
        safety: "PASSED",
      };
    }

    if (vix <= 12) {
      return {
        ...signalResult,
        note: "Low volatility – stable market conditions",
        safety: "PASSED",
      };
    }
  }

  // -------------------------------
  // SAFE PASS THROUGH
  // -------------------------------
  return {
    ...signalResult,
    safety: "PASSED",
  };
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  applySafety,
};
