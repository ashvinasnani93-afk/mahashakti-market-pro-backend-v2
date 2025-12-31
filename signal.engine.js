// ==========================================
// SIGNAL ENGINE – STEP 1 (TREND CHECK)
// EMA 20 / EMA 50
// ==========================================

/**
 * checkTrend
 * @param {number[]} closes - candle close prices (latest last)
 * @param {number[]} ema20  - EMA 20 values (latest last)
 * @param {number[]} ema50  - EMA 50 values (latest last)
 * @returns {object}
 */
function checkTrend({ closes = [], ema20 = [], ema50 = [] }) {
  if (
    closes.length === 0 ||
    ema20.length === 0 ||
    ema50.length === 0
  ) {
    return {
      trend: "NO_TRADE",
      reason: "insufficient data",
    };
  }

  const price = closes[closes.length - 1];
  const e20 = ema20[ema20.length - 1];
  const e50 = ema50[ema50.length - 1];

  // 📈 UPTREND
  if (price > e20 && e20 > e50) {
    return {
      trend: "UPTREND",
      reason: "price > EMA20 > EMA50",
    };
  }

  // 📉 DOWNTREND
  if (price < e20 && e20 < e50) {
    return {
      trend: "DOWNTREND",
      reason: "price < EMA20 < EMA50",
    };
  }

  // ⛔ NO TRADE ZONE
  return {
    trend: "NO_TRADE",
    reason: "EMA compression / sideways",
  };
}

// ==========================================
// SIGNAL ENGINE – STEP 2 (RSI SANITY CHECK)
// ==========================================

/**
 * checkRSI
 * @param {number} rsi - latest RSI value
 * @param {string} trend - UPTREND / DOWNTREND / NO_TRADE
 * @returns {object}
 */
function checkRSI({ rsi, trend }) {
  if (typeof rsi !== "number") {
    return {
      allowed: false,
      reason: "RSI data missing",
    };
  }

  // ❌ Overbought – no fresh BUY
  if (trend === "UPTREND" && rsi >= 70) {
    return {
      allowed: false,
      reason: "RSI overbought (>=70)",
    };
  }

  // ❌ Oversold – no fresh SELL
  if (trend === "DOWNTREND" && rsi <= 30) {
    return {
      allowed: false,
      reason: "RSI oversold (<=30)",
    };
  }

  // ✅ Safe zone
  return {
    allowed: true,
    reason: "RSI within safe range",
  };
}

// ==========================================
// SIGNAL ENGINE – STEP 3
// BREAKOUT / BREAKDOWN (CANDLE CLOSE)
// ==========================================

/**
 * checkBreakout
 * @param {number} close - latest candle close price
 * @param {number} support - support level
 * @param {number} resistance - resistance level
 * @param {string} trend - UPTREND / DOWNTREND
 */
function checkBreakout({ close, support, resistance, trend }) {
  if (
    typeof close !== "number" ||
    typeof support !== "number" ||
    typeof resistance !== "number"
  ) {
    return {
      allowed: false,
      reason: "price levels missing",
    };
  }

  // ✅ BUY condition
  if (trend === "UPTREND" && close > resistance) {
    return {
      allowed: true,
      action: "BUY",
      reason: "bullish breakout with close",
    };
  }

  // ✅ SELL condition
  if (trend === "DOWNTREND" && close < support) {
    return {
      allowed: true,
      action: "SELL",
      reason: "bearish breakdown with close",
    };
  }

  // ❌ No confirmation
  return {
    allowed: false,
    reason: "no confirmed breakout/breakdown",
  };
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  checkTrend,
  checkRSI,
  checkBreakout,
};
