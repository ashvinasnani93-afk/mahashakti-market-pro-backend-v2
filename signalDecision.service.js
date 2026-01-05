// ==========================================
// SIGNAL DECISION ENGINE – FINAL
// PHASE-2A + STRONG BUY / STRONG SELL (LOCKED)
// BUY / SELL / STRONG BUY / STRONG SELL / WAIT
// ==========================================

const {
  checkTrend,
  checkRSI,
  checkBreakout,
  checkVolume,
  checkStrongSignal,
} = require("./signal.engine");

// ⚡ INTRADAY FAST MOVE ENGINE
const { detectFastMove } = require("./services/intradayFastMove.service");

// 🔒 SAFETY LAYER (LOCKED)
const { applySafety } = require("./signalSafety.service");

// 🏦 INSTITUTIONAL CONTEXT
const { summarizeOI } = require("./services/institutional_oi.service");
const { getPCRContext } = require("./services/institutional_pcr.service");

// 🧠 GREEKS CONTEXT (TEXT ONLY)
const { getGreeksContext } = require("./services/greeks.service");

/**
 * finalDecision
 * @param {object} data
 * @returns {object}
 */
function finalDecision(data = {}) {
  // ----------------------------------
  // SAFETY CONTEXT
  // ----------------------------------
  const safetyContext = {
    isResultDay: data.isResultDay || false,
    isExpiryDay: data.isExpiryDay || false,
    tradeCountToday: data.tradeCountToday || 0,
    tradeType: data.tradeType || "INTRADAY",
    vix: typeof data.vix === "number" ? data.vix : null,
  };

  let riskTag = "NORMAL";
  if (safetyContext.isResultDay) riskTag = "RESULT_DAY";
  else if (safetyContext.isExpiryDay) riskTag = "EXPIRY_DAY";

  // ----------------------------------
  // STEP 1: TREND
  // ----------------------------------
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
        mode: "NORMAL",
        riskTag,
      },
      safetyContext
    );
  }

  // ----------------------------------
  // STEP 2: RSI
  // ----------------------------------
  const rsiResult = checkRSI({
    rsi: data.rsi,
    trend: trendResult.trend,
  });

  if (!rsiResult.allowed) {
    return applySafety(
      {
        signal: "WAIT",
        reason: rsiResult.reason,
        mode: "NORMAL",
        riskTag,
      },
      safetyContext
    );
  }

  // ----------------------------------
  // STEP 3: BREAKOUT / BREAKDOWN
  // ----------------------------------
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
        mode: "NORMAL",
        riskTag,
      },
      safetyContext
    );
  }

  // ----------------------------------
  // STEP 4: VOLUME CONFIRMATION
  // ----------------------------------
  const volumeResult = checkVolume({
    volume: data.volume,
    avgVolume: data.avgVolume,
  });

  if (!volumeResult.allowed) {
    return applySafety(
      {
        signal: "WAIT",
        reason: volumeResult.reason,
        mode: "NORMAL",
        riskTag,
      },
      safetyContext
    );
  }

  // ----------------------------------
  // STEP 4.5: INTRADAY FAST MOVE
  // ----------------------------------
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
          mode: fastMoveResult.mode || "FAST_MOVE",
          riskTag,
        },
        safetyContext
      );
    }
  }

  // ----------------------------------
  // STEP 4.8: STRONG BUY / STRONG SELL
  // ----------------------------------
  const strongResult = checkStrongSignal({
    trend: trendResult.trend,
    breakoutAction: breakoutResult.action,
    close: data.close,
    prevClose: data.prevClose,
    volume: data.volume,
    avgVolume: data.avgVolume,
  });

  // ----------------------------------
  // STEP 5: INSTITUTIONAL CONTEXT
  // ----------------------------------
  const oiSummary = summarizeOI(data.oiData || []);
  const pcrContext = getPCRContext(data.pcrValue);
  const greeksContext = getGreeksContext(data.greeks || {});

  // ❌ INSTITUTIONAL CONFLICT BLOCK
  if (
    (strongResult.signal === "STRONG_BUY" ||
      breakoutResult.action === "BUY") &&
    (oiSummary.bias === "BEARISH" || pcrContext.bias === "BEARISH")
  ) {
    return applySafety(
      {
        signal: "WAIT",
        reason: "Bullish setup but institutional bearish",
        mode: "NORMAL",
        riskTag,
      },
      safetyContext
    );
  }

  if (
    (strongResult.signal === "STRONG_SELL" ||
      breakoutResult.action === "SELL") &&
    (oiSummary.bias === "BULLISH" || pcrContext.bias === "BULLISH")
  ) {
    return applySafety(
      {
        signal: "WAIT",
        reason: "Bearish setup but institutional bullish",
        mode: "NORMAL",
        riskTag,
      },
      safetyContext
    );
  }

  // ----------------------------------
  // FINAL SIGNAL PRIORITY
  // STRONG > NORMAL
  // ----------------------------------
  const finalSignal = strongResult.strong
    ? strongResult.signal
    : breakoutResult.action;

  const finalReason = strongResult.strong
    ? strongResult.reason
    : "Technical + Institutional conditions aligned";

  return applySafety(
    {
      signal: finalSignal, // BUY / SELL / STRONG BUY / STRONG SELL
      trend: trendResult.trend,
      reason: finalReason,

      institutionalBias: oiSummary.bias,
      pcrBias: pcrContext.bias,
      greeksBias: greeksContext.bias,
      greeksNote: greeksContext.note,

      mode: strongResult.strong ? "STRONG" : "NORMAL",
      riskTag,
    },
    safetyContext
  );
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  finalDecision,
};
