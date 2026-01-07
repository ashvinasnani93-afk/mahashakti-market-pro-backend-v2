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
  // HARD SAFETY – INPUT
  // -------------------------------
  if (
    typeof ltp !== "number" ||
    typeof prevLtp !== "number" ||
    prevLtp <= 0 ||
    typeof volume !== "number" ||
    typeof avgVolume !== "number" ||
    volume <= 0 ||
    avgVolume <= 0
  ) {
    return {
      signal: "WAIT",
      
    };
  }

  // -------------------------------
  // TREND SAFETY
  // -------------------------------
  if (trend !== "UPTREND" && trend !== "DOWNTREND") {
    return {
      signal: "WAIT",
      
    };
  }

  // -------------------------------
  // RESULT / EXPIRY BLOCK (LOCKED)
  // -------------------------------
  if (isResultDay) {
    return {
      signal: "WAIT",
    
    };
  }

  if (isExpiryDay) {
    return {
      signal: "WAIT",
     
    };
  }

  // -------------------------------
  // PRICE CHANGE %
  // -------------------------------
  const changePercent = ((ltp - prevLtp) / prevLtp) * 100;
  const absChange = Math.abs(changePercent);

  // -------------------------------
  // EXTREME SPIKE SAFETY (CAPITAL PROTECT)
  // -------------------------------
  if (absChange > 1.8) {
   return {
  signal: "WAIT",
};
  }

  // -------------------------------
  // FAST MOVE CONDITIONS
  // -------------------------------
  const priceBurst = absChange >= 0.35; // sudden move
  const volumeBurst = volume >= avgVolume * 1.5;

  if (!priceBurst || !volumeBurst) {
    return {
      signal: "WAIT",
     
    };
  }

  // -------------------------------
  // DIRECTIONAL LOGIC
  // -------------------------------
  if (changePercent > 0 && trend === "UPTREND") {
    return {
      signal: "BUY",
      
    };
  }

  if (changePercent < 0 && trend === "DOWNTREND") {
    return {
      signal: "SELL",
     
    };
  }

  // -------------------------------
  // MISALIGNED MOVE
  // -------------------------------
 return {
  signal: "WAIT",
};
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  detectFastMove,
};
