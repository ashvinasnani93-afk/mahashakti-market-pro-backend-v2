// ==================================================
// MARKET STRUCTURE SERVICE (CORE – LOCKED)
// Detects UP / DOWN / SIDEWAYS using pure price logic
// NO INDICATORS | NO PREDICTION
// ==================================================

/**
 * detectMarketStructure
 * @param {object} data
 * @returns {object}
 *
 * Required:
 * - highs: number[]   (recent swing highs)
 * - lows: number[]    (recent swing lows)
 */
function detectMarketStructure(data = {}) {
  const { highs = [], lows = [] } = data;

  // -----------------------------
  // HARD VALIDATION
  // -----------------------------
  if (
    !Array.isArray(highs) ||
    !Array.isArray(lows) ||
    highs.length < 3 ||
    lows.length < 3
  ) {
    return {
      structure: "UNKNOWN",
      reason: "Insufficient swing data",
    };
  }

  // Take last 3 swings
  const [h1, h2, h3] = highs.slice(-3);
  const [l1, l2, l3] = lows.slice(-3);

  // -----------------------------
  // TRENDING UP
  // Higher High + Higher Low
  // -----------------------------
  if (h3 > h2 && h2 > h1 && l3 > l2 && l2 > l1) {
    return {
      structure: "UPTREND",
      reason: "Higher highs and higher lows confirmed",
    };
  }

  // -----------------------------
  // TRENDING DOWN
  // Lower High + Lower Low
  // -----------------------------
  if (h3 < h2 && h2 < h1 && l3 < l2 && l2 < l1) {
    return {
      structure: "DOWNTREND",
      reason: "Lower highs and lower lows confirmed",
    };
  }

  // -----------------------------
  // SIDEWAYS / RANGE
  // Equal highs or equal lows
  // -----------------------------
  const highRange = Math.abs(h3 - h1) / h1;
  const lowRange = Math.abs(l3 - l1) / l1;

  if (highRange < 0.002 && lowRange < 0.002) {
    return {
      structure: "SIDEWAYS",
      reason: "Price trapped in range (equal highs/lows)",
    };
  }

  // -----------------------------
  // DEFAULT – NO CLEAR STRUCTURE
  // -----------------------------
  return {
    structure: "UNCLEAR",
    reason: "Structure not aligned cleanly",
  };
}

// ==================================================
// EXPORT
// ==================================================
module.exports = {
  detectMarketStructure,
};
