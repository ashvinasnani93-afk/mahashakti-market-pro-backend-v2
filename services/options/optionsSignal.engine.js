// ==================================================
// OPTIONS SIGNAL ENGINE (PHASE-3)
// CORE BRAIN – RULE LOCKED
// NO DUMMY | NO SHORTCUT
// ==================================================

/**
 * generateOptionsSignal
 * @param {object} context
 * @returns {object}
 *
 * Context comes ONLY from optionsMaster.service
 * No direct market / API calls here
 */
function generateOptionsSignal(context = {}) {
 const {
  symbol,
  spotPrice,
  expiryType,
  tradeContext,
  safety,

  ema20,
  ema50,
} = context;

  // --------------------------------------------------
  // HARD INPUT VALIDATION
  // --------------------------------------------------
  if (!symbol || typeof spotPrice !== "number") {
    return {
      status: "WAIT",
      reason: "Invalid symbol or spot price",
    };
  }

  if (!expiryType || !tradeContext) {
    return {
      status: "WAIT",
      reason: "Missing expiry or trade context",
    };
  }

  // --------------------------------------------------
  // SAFETY GATE (NON-NEGOTIABLE)
  // --------------------------------------------------
  if (!safety) {
    return {
      status: "WAIT",
      reason: "Safety context missing",
    };
  }

  // Expiry day = no fresh options signal
  if (safety.isExpiryDay) {
    return {
      status: "WAIT",
      reason: "Blocked by expiry-day safety rule",
    };
  }

  // Intraday trade blocked if not allowed
  if (
    tradeContext === "INTRADAY_OPTIONS" &&
    !safety.intradayAllowed
  ) {
    return {
      status: "WAIT",
      reason: "Intraday options not allowed by safety layer",
    };
  }

  // Positional trade blocked if not allowed
  if (
    tradeContext === "POSITIONAL_OPTIONS" &&
    !safety.positionalAllowed
  ) {
    return {
      status: "WAIT",
      reason: "Positional options not allowed by safety layer",
    };
  }

  // --------------------------------------------------
  // SIGNAL ENGINE STATUS (RULES LOCKED – NO EXECUTION)
  // --------------------------------------------------
  return {
    status: "WAIT",
    engine: "OPTIONS_SIGNAL_ENGINE",
    note: "Signal engine ready. Awaiting indicator + price action rules.",
  };
}

// --------------------------------------------------
// EXPORT
// --------------------------------------------------
module.exports = {
  generateOptionsSignal,
};
