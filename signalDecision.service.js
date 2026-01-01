// ==========================================
// SIGNAL DECISION ENGINE – FINAL STEP (PHASE-2A + C3.1)
// Combines Technical + Institutional + Safety
// BUY / SELL / WAIT
// ==========================================

const {
  checkTrend,
  checkRSI,
  checkBreakout,
  checkVolume,
} = require("./signal.engine");
// ⚡ INTRADAY FAST MOVE ENGINE
const { detectFastMove } = require("./intradayFastMove.service");
// 🔒 SAFETY LAYER (Phase-1 LOCKED)
const { applySafety } = require("./signalSafety.service");

// 🏦 INSTITUTIONAL CONTEXT (REAL – PHASE-2A)
const { summarizeOI } = require("./institutional/oi.service");
const { getPCRContext } = require("./institutional/pcr.service");
const { detectFastMove } = require("./services/intradayFastMove.service");
/**
 * finalDecision
 * @param {object} data
 * @returns {object}
 */
function finalDecision(data) {
  // -------------------------------
  // SAFETY + RISK CONTEXT
  // -------------------------------
  const safetyContext = {
    isResultDay: data.isResultDay || false,
    isExpiryDay: data.isExpiryDay || false,
    tradeCountToday: data.tradeCountToday || 0,
    tradeType: data.tradeType || "INTRADAY",

    // 🟡 VIX CONTEXT (C3.1 – SAFETY ONLY)
    vix: typeof data.vix === "number" ? data.vix : null,
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
      { signal: "WAIT", reason: trendResult.reason },
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
      { signal: "WAIT", reason: rsiResult.reason },
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
      { signal: "WAIT", reason: breakoutResult.reason },
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
      { signal: "WAIT", reason: volumeResult.reason },
      safetyContext
    );
  }
// -------------------------------
// STEP 4.5: INTRADAY FAST MOVE CHECK (PHASE-2B)
// -------------------------------
if (data.tradeType === "INTRADAY") {
  const fastMoveResult = detectFastMove({
    ltp: data.close,
    prevLtp: data.prevClose,
    volume: data.volume,
    avgVolume: data.avgVolume,
    trend: trendResult.trend,
    isExpiryDay: safetyContext.isExpiryDay,
    isResultDay: safetyContext.isResultDay,
  });

  if (fastMoveResult.signal && fastMoveResult.signal !== "WAIT") {
    return applySafety(
      {
        signal: fastMoveResult.signal,
        reason: fastMoveResult.reason,
        mode: fastMoveResult.mode,
      },
      safetyContext
    );
  }
}
  // -------------------------------
  // STEP 5: INSTITUTIONAL CONFIRMATION
  // -------------------------------
  const oiSummary = summarizeOI(data.oiData || []);
  const pcrContext = getPCRContext(data.pcrValue);

  // ❌ Block BUY if institution bearish
  if (
    breakoutResult.action === "BUY" &&
    (oiSummary.bias === "BEARISH" || pcrContext.bias === "BEARISH")
  ) {
    return applySafety(
      {
        signal: "WAIT",
        trend: trendResult.trend,
        reason: "Technical BUY but institutional bearish",
      },
      safetyContext
    );
  }

  // ❌ Block SELL if institution bullish
  if (
    breakoutResult.action === "SELL" &&
    (oiSummary.bias === "BULLISH" || pcrContext.bias === "BULLISH")
  ) {
    return applySafety(
      {
        signal: "WAIT",
        trend: trendResult.trend,
        reason: "Technical SELL but institutional bullish",
      },
      safetyContext
    );
  }

  // -------------------------------
  // ✅ FINAL SIGNAL (CORE UNCHANGED)
  // -------------------------------
  const rawSignal = {
    signal: breakoutResult.action, // BUY / SELL
    trend: trendResult.trend,
    reason: "Technical + Institutional conditions aligned",
  };

  // 🔒 APPLY SAFETY (Result / Expiry / Overtrade / VIX context)
  return applySafety(rawSignal, safetyContext);
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  finalDecision,
};
