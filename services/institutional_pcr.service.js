// ==========================================
// PCR SERVICE – INSTITUTIONAL CONTEXT (PHASE-2A)
// Put Call Ratio interpretation
// ==========================================

/**
 * getPCRContext
 * @param {number} pcrValue
 * @returns {object} bias + note
 */
function getPCRContext(pcrValue) {
  if (typeof pcrValue !== "number" || isNaN(pcrValue)) {
    return {
      bias: "NEUTRAL",
      note: "Invalid PCR value",
    };
  }

  // Institutional Interpretation
  if (pcrValue < 0.7) {
    return {
      bias: "BEARISH",
      note: "Low PCR → Call dominance → Market vulnerable",
    };
  }

  if (pcrValue >= 0.7 && pcrValue <= 1.2) {
    return {
      bias: "NEUTRAL",
      note: "Balanced PCR → No strong institutional edge",
    };
  }

  if (pcrValue > 1.2) {
    return {
      bias: "BULLISH",
      note: "High PCR → Put writing → Institutional support",
    };
  }

  return {
    bias: "NEUTRAL",
    note: "PCR unclear",
  };
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getPCRContext,
};
