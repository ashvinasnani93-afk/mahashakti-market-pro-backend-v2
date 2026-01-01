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

// 🔒 SAFETY LAYER (Phase-1)
const { applySafety } = require("./signalSafety.service");

/**
 * finalDecision
 * @param {object} data
 * @returns {object}
 */
function finalDecision(data) {
  // -------------------------------
  // SAFETY CONTEXT (EXPLICIT)
  // -------------------------------
  const safetyContext = {
    isResultDay: data.isResultDay || false,
    isExpiryDay: data.isExpiryDay || false,
    tradeCountToday: data.tradeCountToday || 0,
    tradeType: data.tradeType || "INTRADAY",
  };

  // -------------------------------
  // STEP 1: TREND
  // -------------------------------
  const trendResult = checkTrend({
    closes: data.closes,
    ema20: data.ema20,
    ema50: data.ema50,
  });

  if (trendResult.trend === "NO_TRADE") {
    return applySafety(
      {
        signal: "WAIT",
        reason: trendResult.reason,
      },
      safetyContext
    );
  }

  // -------------------------------
  // STEP 2: RSI
  // -------------------------------
  const rsiResult = checkRSI({
    rsi: data.rsi,
    trend: trendResult.trend,
  });

  if (!rsiResult.allowed) {
    return applySafety(
      {
        signal: "WAIT",
        reason: rsiResult.reason,
      },
      safetyContext
    );
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
    return applySafety(
      {
        signal: "WAIT",
        reason: breakoutResult.reason,
      },
      safetyContext
    );
  }

  // -------------------------------
  // STEP 4: VOLUME CONFIRMATION
  // -------------------------------
  const volumeResult = checkVolume({
    volume: data.volume,
    avgVolume: data.avgVolume,
  });

  if (!volumeResult.allowed) {
    return applySafety(
      {
        signal: "WAIT",
        reason: volumeResult.reason,
      },
      safetyContext
    );
  }

  // -------------------------------
  // ✅ FINAL RAW SIGNAL
  // -------------------------------
  const rawSignal = {
    signal: breakoutResult.action, // BUY or SELL
    trend: trendResult.trend,
    reason: "All conditions satisfied",
  };

  // 🔒 APPLY SAFETY (result / expiry / overtrade etc.)
  return applySafety(rawSignal, safetyContext);
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  finalDecision,
};
