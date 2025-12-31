// ==========================================
// SIGNAL DECISION ENGINE – FINAL STEP
// Combines all checks → BUY / SELL / WAIT
// ==========================================

const {
  checkTrend,
  checkRSI,
  checkBreakout,
  checkVolume,
} = require("./signal.engine");

/**
 * finalDecision
 * @param {object} data
 * @returns {object}
 */
function finalDecision(data) {
  // -------------------------------
  // STEP 1: TREND
  // -------------------------------
  const trendResult = checkTrend({
    closes: data.closes,
    ema20: data.ema20,
    ema50: data.ema50,
  });

  if (trendResult.trend === "NO_TRADE") {
    return {
      signal: "WAIT",
      reason: trendResult.reason,
    };
  }

  // -------------------------------
  // STEP 2: RSI
  // -------------------------------
  const rsiResult = checkRSI({
    rsi: data.rsi,
    trend: trendResult.trend,
  });

  if (!rsiResult.allowed) {
    return {
      signal: "WAIT",
      reason: rsiResult.reason,
    };
  }

  // -------------------------------
  // STEP 3: BREAKOUT / BREAKDOWN
  // -------------------------------
  const breakoutResult = checkBreakout({
    close: data.close,
    support: data.support,
    resistance: data.resistance,
    trend: trendResult.trend,
  });

  if (!breakoutResult.allowed) {
    return {
      signal: "WAIT",
      reason: breakoutResult.reason,
    };
  }

  // -------------------------------
  // STEP 4: VOLUME CONFIRMATION
  // -------------------------------
  const volumeResult = checkVolume({
    volume: data.volume,
    avgVolume: data.avgVolume,
  });

  if (!volumeResult.allowed) {
    return {
      signal: "WAIT",
      reason: volumeResult.reason,
    };
  }

  // -------------------------------
  // ✅ FINAL SIGNAL
  // -------------------------------
  return {
    signal: breakoutResult.action, // BUY or SELL
    trend: trendResult.trend,
    reason: "All conditions satisfied",
  };
}

// ==========================================
// EXPORT (⚠️ ONLY small f)
// ==========================================
module.exports = {
  finalDecision,
};
