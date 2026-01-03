// ==================================================
// COMMODITY DECISION SERVICE (PHASE-C2)
// Direction / Zone based logic
// NO FIXED TARGETS | NO EXECUTION
// ==================================================

const { getCommoditySafetyContext } = require("./commoditySafety.service");

/**
 * decideCommodityTrade
 * @param {object} data
 * @returns {object}
 *
 * Supported commodities:
 * GOLD | SILVER | CRUDE | NATURAL_GAS
 */
function decideCommodityTrade(data = {}) {
  const {
    commodity,
    trend,        // UPTREND / DOWNTREND / SIDEWAYS
    price,
    safetyInput,  // event / spike / volatility info
    userType = "FREE", // FREE / TRIAL / PRO
  } = data;

  // -----------------------------
  // BASIC INPUT CHECK
  // -----------------------------
  if (!commodity || typeof price !== "number") {
    return {
      status: "WAIT",
      reason: "Invalid commodity input",
    };
  }

  // -----------------------------
  // SAFETY CHECK (MANDATORY)
  // -----------------------------
  const safety = getCommoditySafetyContext(safetyInput || {});

  if (safety.status !== "SAFE") {
    return {
      status: "WAIT",
      reason: safety.reason,
    };
  }

  // -----------------------------
  // FREE / TRIAL → DIRECTION ONLY
  // -----------------------------
  if (userType === "FREE" || userType === "TRIAL") {
    return {
      status: "READY",
      commodity,
      direction: trend,
      note: "Direction only (Free / Trial mode)",
    };
  }

  // -----------------------------
  // PRO USER → ZONE BASED OUTPUT
  // -----------------------------
  if (userType === "PRO") {
    let zone = "NEUTRAL";

    if (trend === "UPTREND") zone = "BUY_ZONE";
    if (trend === "DOWNTREND") zone = "SELL_ZONE";

    return {
      status: "READY",
      commodity,
      trend,
      zone,
      note: "Zone-based commodity view (no fixed targets)",
    };
  }

  // -----------------------------
  // FALLBACK
  // -----------------------------
  return {
    status: "WAIT",
    reason: "Unable to determine commodity decision",
  };
}

// ==================================================
// EXPORT
// ==================================================
module.exports = {
  decideCommodityTrade,
};
