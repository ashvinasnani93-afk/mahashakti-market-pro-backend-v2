// ==================================================
// OPTIONS SAFETY SERVICE (PHASE-4B)
// Capital + Event + Volatility Protection
// NO BUY / SELL DECISION (SAFETY ONLY)
// ==================================================

/**
 * getOptionsSafetyContext
 * @param {object} context
 * @returns {object}
 *
 * This service ONLY decides:
 * - Whether options trade is allowed
 * - Risk level (NORMAL / HIGH)
 * - Clear, explainable safety reason (TEXT)
 *
 * ❌ No BUY / SELL
 * ❌ No strike logic
 * ❌ No execution
 */
function getOptionsSafetyContext(context = {}) {
 const {
  tradeContext,       // INTRADAY_OPTIONS / POSITIONAL_OPTIONS
  expiryType,
  isExpiryDay = false,
  isResultDay = false,
  vix,
  overnightRisk = false,
} = context;

  // ------------------------------
  // DEFAULT SAFETY STATE
  // ------------------------------
  const safety = {
    allowTrade: true,
    riskLevel: "NORMAL",
    reason: null,
  };

  // ------------------------------
  // HARD BLOCK: RESULT DAY
  // ------------------------------
  if (isResultDay) {
    return {
      safety: {
        allowTrade: false,
        riskLevel: "HIGH",
        reason: "Options blocked: result day event risk",
      },
      note: "Equity results can cause sudden option volatility",
    };
  }

  // ------------------------------
  // HARD BLOCK: EXPIRY DAY
  // ------------------------------
  if (isExpiryDay) {
    return {
      safety: {
        allowTrade: false,
        riskLevel: "HIGH",
        reason: "Options blocked: expiry day risk",
      },
      note: "Expiry day has extreme theta decay and random moves",
    };
  }

  // ------------------------------
  // HIGH VOLATILITY (VIX) – SAFETY BLOCK
  // ------------------------------
  if (typeof vix === "number" && vix >= 18) {
    return {
      safety: {
        allowTrade: false,
        riskLevel: "HIGH",
        reason: "Options blocked: high volatility environment (VIX elevated)",
      },
      note: "High VIX leads to fast premium expansion and whipsaws",
    };
  }

  // ------------------------------
  // POSITIONAL OVERNIGHT RISK
  // ------------------------------
  if (tradeContext === "POSITIONAL_OPTIONS" && overnightRisk === true)
  ) {
    return {
      safety: {
        allowTrade: false,
        riskLevel: "HIGH",
        reason: "Options blocked: overnight gap risk",
      },
      note: "Overnight gaps can destroy option premium",
    };
  }

  // ------------------------------
  // WEEKLY EXPIRY WARNING (SOFT RISK)
  // ------------------------------
  if (expiryType === "WEEKLY_EXPIRY") {
    safety.riskLevel = "HIGH";
    safety.reason = "Weekly expiry: fast theta decay risk";
  }

  // ------------------------------
  // SAFE PASS
  // ------------------------------
  return {
    safety,
    note: "Options safety checks passed",
  };
}

// ==================================================
// EXPORT
// ==================================================
module.exports = {
  getOptionsSafetyContext,
};
