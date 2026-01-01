// ==========================================
// SIGNAL SAFETY SERVICE – PHASE 1 (FINAL)
// FINAL SAFETY + CONTEXT LAYER
// (RULE-LOCKED IMPLEMENTATION)
// ==========================================

/**
 * applySafety
 * @param {object} signalResult
 *   { signal: "BUY" | "SELL" | "WAIT", reason?: string, trend?: string }
 * @param {object} context
 *   {
 *     isResultDay: boolean,
 *     isExpiryDay: boolean,
 *     tradeCountToday: number,
 *     tradeType: "INTRADAY" | "EQUITY"
 *   }
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
  } = context;

  // -------------------------------
  // RESULT DAY SAFETY (LOCKED)
  // -------------------------------
  if (isResultDay && signalResult.signal !== "WAIT") {
    return {
      signal: "WAIT",
      reason: "Result-day safety active",
    };
  }

  // -------------------------------
  // EXPIRY DAY SAFETY (LOCKED)
  // -------------------------------
  if (isExpiryDay && signalResult.signal !== "WAIT") {
    return {
      signal: "WAIT",
      reason: "Expiry-day safety active",
    };
  }

  // -------------------------------
  // OVERTRADE GUARD (LOCKED)
  // -------------------------------
  if (tradeCountToday >= 3 && signalResult.signal !== "WAIT") {
    return {
      signal: "WAIT",
      reason: "Overtrade guard: daily limit reached",
    };
  }

  // -------------------------------
  // EQUITY vs INTRADAY SAFETY
  // -------------------------------
  if (tradeType === "EQUITY" && signalResult.signal === "SELL") {
    return {
      signal: "WAIT",
      reason: "Equity safety: no panic sell allowed",
    };
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
