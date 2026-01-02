// ==========================================
// OPTIONS MASTER SERVICE (PHASE-3)
// Central controller for Options logic
// NIFTY / BANKNIFTY / STOCK OPTIONS
// ==========================================

/**
 * getOptionsContext
 * @param {object} data
 * @returns {object}
 */
function getOptionsContext(data = {}) {
  const {
    symbol,
    spotPrice,
    expiry,
    tradeType,
  } = data;

  // -----------------------------
  // HARD SAFETY CHECK
  // -----------------------------
  if (!symbol || !spotPrice || !expiry || !tradeType) {
    return {
      status: "WAIT",
      reason: "Insufficient options input data",
    };
  }

  // -----------------------------
  // EXPIRY CONTEXT
  // -----------------------------
  const expiryType =
    expiry === "WEEKLY"
      ? "WEEKLY_EXPIRY"
      : expiry === "MONTHLY"
      ? "MONTHLY_EXPIRY"
      : "UNKNOWN_EXPIRY";

  // -----------------------------
  // TRADE TYPE CONTEXT
  // -----------------------------
  const tradeContext =
    tradeType === "INTRADAY"
      ? "INTRADAY_OPTIONS"
      : "POSITIONAL_OPTIONS";

  // -----------------------------
  // BASE CONTEXT (NO SIGNAL)
  // -----------------------------
  return {
    status: "READY",
    symbol,
    spotPrice,
    expiryType,
    tradeContext,
    note: "Options context prepared (no signal yet)",
  };
}
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getOptionsContext,
};
