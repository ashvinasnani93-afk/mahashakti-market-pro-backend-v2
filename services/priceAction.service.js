// ==================================================
// PRICE ACTION SERVICE (FINAL – LOCKED)
// Candle psychology engine
// Reads strength, rejection, and control
// ==================================================

/**
 * analyzePriceAction
 * @param {object} candle
 * @returns {object}
 *
 * Required:
 * - open
 * - high
 * - low
 * - close
 */
function analyzePriceAction(candle = {}) {
  const { open, high, low, close } = candle;

  // -----------------------------
  // HARD VALIDATION
  // -----------------------------
  if (
    typeof open !== "number" ||
    typeof high !== "number" ||
    typeof low !== "number" ||
    typeof close !== "number"
  ) {
    return {
      sentiment: "UNKNOWN",
      strength: 0,
      reason: "Invalid candle data",
    };
  }

  // -----------------------------
  // BASIC PARAMETERS
  // -----------------------------
  const body = Math.abs(close - open);
  const range = high - low;
  const upperWick = high - Math.max(open, close);
  const lowerWick = Math.min(open, close) - low;

  if (range === 0) {
    return {
      sentiment: "UNKNOWN",
      strength: 0,
      reason: "Zero range candle",
    };
  }

  const bodyPercent = (body / range) * 100;
  const upperWickPercent = (upperWick / range) * 100;
  const lowerWickPercent = (lowerWick / range) * 100;

  // -----------------------------
  // STRONG BULLISH
  // -----------------------------
  if (close > open && bodyPercent > 60 && upperWickPercent < 20) {
    return {
      sentiment: "BULLISH",
      strength: "STRONG",
      reason: "Big green candle closing near high with small upper wick",
    };
  }

  // -----------------------------
  // STRONG BEARISH
  // -----------------------------
  if (close < open && bodyPercent > 60 && lowerWickPercent < 20) {
    return {
      sentiment: "BEARISH",
      strength: "STRONG",
      reason: "Big red candle closing near low with small lower wick",
    };
  }

  // -----------------------------
  // REJECTION FROM SUPPORT (BUY ZONE)
  // -----------------------------
  if (close > open && lowerWickPercent > 40 && bodyPercent < 40) {
    return {
      sentiment: "BULLISH",
      strength: "MEDIUM",
      reason: "Strong lower wick – buyers rejection visible",
    };
  }

  // -----------------------------
  // REJECTION FROM RESISTANCE (SELL ZONE)
  // -----------------------------
  if (close < open && upperWickPercent > 40 && bodyPercent < 40) {
    return {
      sentiment: "BEARISH",
      strength: "MEDIUM",
      reason: "Strong upper wick – sellers rejection visible",
    };
  }

  // -----------------------------
  // SIDEWAYS / INDECISION
  // -----------------------------
  if (bodyPercent < 25) {
    return {
      sentiment: "NEUTRAL",
      strength: "WEAK",
      reason: "Small body / Doji – market indecision",
    };
  }

  // -----------------------------
  // DEFAULT SAFE OUTPUT
  // -----------------------------
  return {
    sentiment: "NEUTRAL",
    strength: "UNKNOWN",
    reason: "No clear candle pattern",
  };
}

// ==================================================
// EXPORT
// ==================================================
module.exports = {
  analyzePriceAction,
};
