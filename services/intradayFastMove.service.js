// ==========================================
// INTRADAY FAST-MOVE ENGINE (PHASE-2B)
// REAL, RULE-LOCKED
// BUY / SELL / HOLD / WAIT
// ==========================================

/**
 * detectFastMove
 * @param {object} data
 * @returns {object}
 *
 * Required data:
 * - ltp
 * - prevLtp
 * - volume
 * - avgVolume
 * - trend (UPTREND / DOWNTREND)
 * - isExpiryDay
 * - isResultDay
 */
function detectFastMove(data = {}) {
  const {
    ltp,
    prevLtp,
    volume,
    avgVolume,
    trend,
    isExpiryDay = false,
    isResultDay = false,
  } = data;

  // -------------------------------
  // HARD SAFETY
  // -------------------------------
  if (
    typeof ltp !== "number" ||
    typeof prevLtp !== "number" ||
    typeof volume !== "number" ||
    typeof avgVolume !== "number"
  ) {
    return {
      signal: "WAIT",
      reason: "Fast-move: insufficient data",
    };
  }

  // -------------------------------
  // RESULT / EXPIRY BLOCK
  // -------------------------------
  if (isResultDay) {
    return {
      signal: "WAIT",
      reason: "Fast-move blocked on result day",
    };
  }

  if (isExpiryDay) {
    return {
      signal: "WAIT",
      reason: "Fast-move blocked on expiry day",
    };
  }

  // -------------------------------
  // PRICE CHANGE %
  // -------------------------------
  const changePercent = ((ltp - prevLtp) / prevLtp) * 100;
  const absChange = Math.abs(changePercent);

  // -------------------------------
  // FAST MOVE CONDITIONS
  // -------------------------------
  const priceBurst = absChange >= 0.35; // sudden move
  const volumeBurst = volume >= avgVolume * 1.5;

  if (!priceBurst || !volumeBurst) {
    return {
      signal: "WAIT",
      reason: "No fast-move detected",
    };
  }

  // -------------------------------
  // DIRECTIONAL LOGIC
  // -------------------------------
  if (changePercent > 0 && trend === "UPTREND") {
    return {
      signal: "BUY",
      reason: "Intraday fast bullish move with volume",
      mode: "FAST_MOVE",
    };
  }

  if (changePercent < 0 && trend === "DOWNTREND") {
    return {
      signal: "SELL",
      reason: "Intraday fast bearish move with volume",
      mode: "FAST_MOVE",
    };
  }

  // -------------------------------
  // MISALIGNED MOVE
  // -------------------------------
  return {
    signal: "HOLD",
    reason: "Fast move detected but trend misaligned",
    mode: "FAST_MOVE",
  };
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  detectFastMove,
};
