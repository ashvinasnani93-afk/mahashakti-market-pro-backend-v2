// ==========================================
// SIGNAL ENGINE – STEP 1 (TREND CHECK)
// EMA 20 / EMA 50
// ==========================================

const { FinalDecision } = require("./signalDecision.service");

/**
 * STEP 1 – TREND CHECK
 */
function checkTrend({ closes = [], ema20 = [], ema50 = [] }) {
  if (!closes.length || !ema20.length || !ema50.length) {
    return {
      trend: "NO_TRADE",
      reason: "insufficient data",
    };
  }

  const price = closes[closes.length - 1];
  const e20 = ema20[ema20.length - 1];
  const e50 = ema50[ema50.length - 1];

  if (price > e20 && e20 > e50) {
    return {
      trend: "UPTREND",
      reason: "price > EMA20 > EMA50",
    };
  }

  if (price < e20 && e20 < e50) {
    return {
      trend: "DOWNTREND",
      reason: "price < EMA20 < EMA50",
    };
  }

  return {
    trend: "NO_TRADE",
    reason: "EMA compression / sideways",
  };
}

// ==========================================
// SIGNAL ENGINE – STEP 2 (RSI SANITY CHECK)
// ==========================================

/**
 * STEP 2 – RSI CHECK
 */
function checkRSI({ rsi, trend }) {
  if (typeof rsi !== "number") {
    return {
      allowed: false,
      reason: "RSI missing",
    };
  }

  if (trend === "UPTREND" && rsi >= 70) {
    return {
      allowed: false,
      reason: "RSI overbought",
    };
  }

  if (trend === "DOWNTREND" && rsi <= 30) {
    return {
      allowed: false,
      reason: "RSI oversold",
    };
  }

  return {
    allowed: true,
    reason: "RSI OK",
  };
}

// ==========================================
// SIGNAL ENGINE – STEP 3
// BREAKOUT / BREAKDOWN (CLOSE BASED)
// ==========================================

/**
 * STEP 3 – BREAKOUT CHECK
 */
function checkBreakout({ close, support, resistance, trend }) {
  if (
    typeof close !== "number" ||
    typeof support !== "number" ||
    typeof resistance !== "number"
  ) {
    return {
      allowed: false,
      reason: "levels missing",
    };
  }

  if (trend === "UPTREND" && close > resistance) {
    return {
      allowed: true,
      action: "BUY",
      reason: "bullish breakout",
    };
  }

  if (trend === "DOWNTREND" && close < support) {
    return {
      allowed: true,
      action: "SELL",
      reason: "bearish breakdown",
    };
  }

  return {
    allowed: false,
    reason: "no breakout confirmation",
  };
}

// ==========================================
// SIGNAL ENGINE – STEP 4
// VOLUME CONFIRMATION
// ==========================================

/**
 * STEP 4 – VOLUME CHECK
 */
function checkVolume({ volume, avgVolume }) {
  if (typeof volume !== "number" || typeof avgVolume !== "number") {
    return {
      allowed: false,
      reason: "volume data missing",
    };
  }

  if (volume > avgVolume) {
    return {
      allowed: true,
      reason: "volume confirmation OK",
    };
  }

  return {
    allowed: false,
    reason: "low volume – fake breakout risk",
  };
}

// ==========================================
// SIGNAL ENGINE – STEP 5
// FINAL DECISION RUNNER
// ==========================================

/**
 * FINAL SIGNAL ENGINE
 */
function runSignalEngine({
  closes,
  ema20,
  ema50,
  rsi,
  support,
  resistance,
  volume,
  avgVolume,
}) {
  const trendResult = checkTrend({ closes, ema20, ema50 });

  if (trendResult.trend === "NO_TRADE") {
    return {
      action: "WAIT",
      reason: trendResult.reason,
    };
  }

  const rsiResult = checkRSI({
    rsi,
    trend: trendResult.trend,
  });

  if (!rsiResult.allowed) {
    return {
      action: "WAIT",
      reason: rsiResult.reason,
    };
  }

  const breakoutResult = checkBreakout({
    close: closes[closes.length - 1],
    support,
    resistance,
    trend: trendResult.trend,
  });

  const volumeResult = checkVolume({
    volume,
    avgVolume,
  });

  return FinalDecision({
    trendResult,
    rsiResult,
    breakoutResult,
    volumeResult,
  });
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  checkTrend,
  checkRSI,
  checkBreakout,
  checkVolume,
  runSignalEngine,
};
