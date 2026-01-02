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
 * Input comes from optionsMaster.service
 */
function generateOptionsSignal(context = {}) {
  const {
    symbol,
    spotPrice,
    expiryType,
    tradeContext,
    safety,
  } = context;

  // ------------------------------
  // HARD SAFETY GATE
  // ------------------------------
  if (!symbol || !spotPrice || !expiryType || !tradeContext) {
    return {
      status: "WAIT",
      reason: "Incomplete options context",
    };
  }

  // ------------------------------
  // SAFETY ENFORCEMENT
  // ------------------------------
  if (!safety || safety.isExpiryDay) {
    return {
      status: "WAIT",
      reason: "Blocked by expiry day safety",
    };
  }

  // ------------------------------
  // SIGNAL PLACEHOLDER (LOCKED)
  // ------------------------------
  return {
    status: "WAIT",
    reason: "Signal engine initialized (rules not evaluated yet)",
  };
}

// ------------------------------
// EXPORT
// ------------------------------
module.exports = {
  generateOptionsSignal,
};
