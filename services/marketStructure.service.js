// ==================================================
// MARKET STRUCTURE SERVICE (CORE – LOCKED)
// Detects UP / DOWN / SIDEWAYS using pure price logic
// ==================================================

function analyzeMarketStructure(data = {}) {
  const { highs = [], lows = [] } = data;

  if (
    !Array.isArray(highs) ||
    !Array.isArray(lows) ||
    highs.length < 3 ||
    lows.length < 3
  ) {
    return {
      valid: false,
      structure: "UNKNOWN",
      reason: "Insufficient swing data",
    };
  }

  const [h1, h2, h3] = highs.slice(-3);
  const [l1, l2, l3] = lows.slice(-3);

  // UPTREND
  if (h3 > h2 && h2 > h1 && l3 > l2 && l2 > l1) {
    return {
      valid: true,
      structure: "UPTREND",
      reason: "Higher highs and higher lows confirmed",
    };
  }

  // DOWNTREND
  if (h3 < h2 && h2 < h1 && l3 < l2 && l2 < l1) {
    return {
      valid: true,
      structure: "DOWNTREND",
      reason: "Lower highs and lower lows confirmed",
    };
  }

  // SIDEWAYS
  const highRange = Math.abs(h3 - h1) / h1;
  const lowRange = Math.abs(l3 - l1) / l1;

  if (highRange < 0.002 && lowRange < 0.002) {
    return {
      valid: false,
      structure: "SIDEWAYS",
      reason: "Price trapped in range (equal highs/lows)",
    };
  }

  return {
    valid: false,
    structure: "UNCLEAR",
    reason: "Structure not aligned cleanly",
  };
}

module.exports = {
  analyzeMarketStructure,
};
