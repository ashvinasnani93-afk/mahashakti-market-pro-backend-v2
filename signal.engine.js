// ==========================================
// SIGNAL ENGINE – CORE CHECKS + STRONG BUY LAYER
// Trend / RSI / Breakout / Volume
// ==========================================

// ==========================================
// STEP 1 – TREND CHECK
// EMA 20 / EMA 50 (LOCKED)
// ==========================================
function checkTrend({ closes = [], ema20 = [], ema50 = [] }) {
  // ===== SAFETY CHECK =====
  if (
    !Array.isArray(closes) ||
    !Array.isArray(ema20) ||
    !Array.isArray(ema50) ||
    !closes.length ||
    !ema20.length ||
    !ema50.length
  ) {
    return {
      trend: "NO_TRADE",
      reason: "insufficient data",
    };
  }

  const price = closes[closes.length - 1];
  const e20 = ema20[ema20.length - 1];
  const e50 = ema50[ema50.length - 1];

  // ===== NUMBER VALIDATION =====
  if (
    typeof price !== "number" ||
    typeof e20 !== "number" ||
    typeof e50 !== "number"
  ) {
    return {
      trend: "NO_TRADE",
      reason: "invalid EMA / price data",
    };
  }

  // ===== UPTREND =====
  if (price > e20 && e20 > e50) {
    return {
      trend: "UPTREND",
      reason: "price > EMA20 > EMA50",
    };
  }

  // ===== DOWNTREND =====
  if (price < e20 && e20 < e50) {
    return {
      trend: "DOWNTREND",
      reason: "price < EMA20 < EMA50",
    };
  }

  // ===== SIDEWAYS / COMPRESSION =====
  return {
    trend: "NO_TRADE",
    reason: "EMA compression / sideways",
  };
}
// ===== STEP 1 EXECUTION =====
const trendResult = checkTrend({
  closes,
  ema20,
  ema50,
});

const trend = trendResult.trend;
// ==========================================
// STEP 2 – RSI SANITY CHECK (LOCKED)
// ==========================================
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
// STEP 3 – BREAKOUT / BREAKDOWN
// CLOSE BASED CONFIRMATION (LOCKED)
// ==========================================
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
// STEP 4 – VOLUME CONFIRMATION (LOCKED)
// ==========================================
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
// 🔥 STEP 5 – STRONG BUY / STRONG SELL CHECK
// OPERATOR-GRADE CONFIRMATION (NEW – LOCKED)
// ==========================================
function checkStrongSignal({
  trend,
  breakoutAction,
  close,
  prevClose,
  volume,
  avgVolume,
}) {
  if (!trend || !breakoutAction) {
    return {
      strong: false,
    };
  }

  // Candle strength
  const candleBody = Math.abs(close - prevClose);
  const strongCandle = candleBody > 0 && candleBody >= (close * 0.002); // ~0.2%

  const highVolume = volume >= avgVolume * 1.5;

  if (
    breakoutAction === "BUY" &&
    trend === "UPTREND" &&
    strongCandle &&
    highVolume
  ) {
    return {
      strong: true,
      signal: "STRONG_BUY",
      reason: "Strong bullish candle + high volume in uptrend",
    };
  }

  if (
    breakoutAction === "SELL" &&
    trend === "DOWNTREND" &&
    strongCandle &&
    highVolume
  ) {
    return {
      strong: true,
      signal: "STRONG_SELL",
      reason: "Strong bearish candle + high volume in downtrend",
    };
  }

  return {
    strong: false,
  };
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  checkTrend,
  checkRSI,
  checkBreakout,
  checkVolume,
  checkStrongSignal, // 🔥 NEW (USED BY finalDecision)
};
