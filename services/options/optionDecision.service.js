// ==================================================
// OPTION DECISION SERVICE (PHASE-4 | STEP-2A)
// FINAL OPTIONS DECISION BRAIN
// BUY vs SELL vs NO-TRADE (TEXT + UI SYMBOL)
// RULE-LOCKED | NO EXECUTION
// ==================================================

/**
 * decideOptionTrade
 * @param {object} data
 * @returns {object}
 *
 * This service:
 * - FINAL decision wrapper for OPTIONS only
 * - BUY / SELL / NO-TRADE (TEXT + UI SYMBOL)
 * - Theta decay awareness (TEXT)
 * - Greeks bias awareness (TEXT)
 * - Expiry + Overnight risk awareness
 * - Clear separation from Equity logic
 */
// ==================================================
// OPTION DECISION SERVICE (FINAL – UI SAFE)
// CUSTOMER SE LOGIC HIDDEN
// SYMBOL ONLY OUTPUT
// ==================================================

const { generateOptionsSignal } = require("./optionsSignal.engine");

function decideOptionTrade(data = {}) {
  // HARD SAFETY
  if (!data || typeof data !== "object") {
    return {
      status: "WAIT",
      signal: "🟡",
    };
  }

  const result = generateOptionsSignal(data);

  if (!result || typeof result !== "object") {
    return {
      status: "WAIT",
      signal: "🟡",
    };
  }

  // ONLY SYMBOL – NO TEXT
  if (result.uiIcon === "🟢") {
    return { status: "OK", signal: "🟢" };
  }

  if (result.uiIcon === "🔴") {
    return { status: "OK", signal: "🔴" };
  }

  return {
    status: "WAIT",
    signal: "🟡",
  };
}


// ==================================================
// EXPORT
// ==================================================
module.exports = {
  decideOptionTrade,
};
