// ==========================================
// PCR SERVICE – INSTITUTIONAL CONTEXT (PHASE-2A)
// Put Call Ratio interpretation (TEXT ONLY)
// ==========================================

/**
 * getPCRContext
 * @param {number} pcrValue
 * @returns {object} bias + note
 *
 * ⚠️ Context only
 * ❌ No BUY / SELL enforcement
 */
function getPCRContext(pcrValue) {
  // -----------------------------
  // HARD VALIDATION
  // -----------------------------
  if (typeof pcrValue !== "number" || isNaN(pcrValue)) {
    return {
      bias: "NEUTRAL",
      note: "PCR data unavailable or invalid",
    };
  }

  // -----------------------------
  // EXTREME LOW PCR
  // -----------------------------
  if (pcrValue < 0.6) {
    return {
      bias: "BEARISH",
      note:
        "Very low PCR → Excessive call writing → Market vulnerable to fall",
    };
  }

  // -----------------------------
  // LOW PCR
  // -----------------------------
  if (pcrValue >= 0.6 && pcrValue < 0.9) {
    return {
      bias: "BEARISH",
      note:
        "Low PCR → Call dominance → Weak institutional support",
    };
  }

  // -----------------------------
  // BALANCED PCR
  // -----------------------------
  if (pcrValue >= 0.9 && pcrValue <= 1.2) {
    return {
      bias: "NEUTRAL",
      note:
        "Balanced PCR → No strong institutional directional edge",
    };
  }

  // -----------------------------
  // HIGH PCR
  // -----------------------------
  if (pcrValue > 1.2 && pcrValue <= 1.5) {
    return {
      bias: "BULLISH",
      note:
        "High PCR → Put writing → Institutional support present",
    };
  }

  // -----------------------------
  // EXTREME HIGH PCR
  // -----------------------------
  if (pcrValue > 1.5) {
    return {
      bias: "BULLISH",
      note:
        "Very high PCR → Heavy put writing → Strong support but reversal risk",
    };
  }

  // -----------------------------
  // FALLBACK
  // -----------------------------
  return {
    bias: "NEUTRAL",
    note: "PCR interpretation unclear",
  };
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getPCRContext,
};
