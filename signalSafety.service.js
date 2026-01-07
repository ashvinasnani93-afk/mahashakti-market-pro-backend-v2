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
    };
  }

  // -------------------------------
  // EXPIRY DAY SAFETY (LOCKED)
  // -------------------------------
  if (isExpiryDay && signalResult.signal !== "WAIT") {
    return {
      ...signalResult,
      signal: "WAIT",
    };
  }

  // -------------------------------
  // OVERTRADE GUARD (LOCKED)
  // -------------------------------
  if (tradeCountToday >= 3 && signalResult.signal !== "WAIT") {
    return {
      ...signalResult,
      signal: "WAIT",
    };
  }

  // -------------------------------
  // EQUITY vs INTRADAY SAFETY (LOCKED)
  // -------------------------------
  if (tradeType === "EQUITY" && signalResult.signal === "SELL") {
    return {
      ...signalResult,
      signal: "WAIT",
    };
  }

  // -------------------------------
  // SAFE PASS THROUGH
  // -------------------------------
 return {
  signal: signalResult.signal,
};
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  applySafety,
};
