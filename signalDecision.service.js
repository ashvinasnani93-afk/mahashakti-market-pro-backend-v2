// ==========================================
// SIGNAL DECISION ENGINE – FINAL OPERATOR GRADE
// PHASE-2A + 6 LOCKED RULES + STRONG BUY CORE
// BUY / SELL / STRONG BUY / STRONG SELL / WAIT
// ==========================================

// ---------- CORE TECHNICAL ----------
const {
  checkTrend,
  checkRSI,
  checkBreakout,
  checkVolume,
} = require("./signal.engine");

// ---------- NEW LOCKED MODULES ----------
const { detectMarketRegime } = require("./services/marketRegime.service");
const { analyzeMarketBreadth } = require("./services/marketBreadth.service");
const { analyzeMarketStructure } = require("./services/marketStructure.service");
const { analyzePriceAction } = require("./services/priceAction.service");
const { validateVolume } = require("./services/volumeValidation.service");
const { evaluateStrongBuy } = require("./services/strongBuy.engine");

// ---------- INTRADAY FAST MOVE ----------
const { detectFastMove } = require("./services/intradayFastMove.service");

// ---------- SAFETY (LOCKED) ----------
const { applySafety } = require("./signalSafety.service");

// ---------- INSTITUTIONAL ----------
const { summarizeOI } = require("./services/institutional_oi.service");
const { getPCRContext } = require("./services/institutional_pcr.service");

// ---------- GREEKS (TEXT ONLY) ----------
const { getGreeksContext } = require("./services/greeks.service");

/**
 * finalDecision
 */
function finalDecision(data = {}) {

  // =====================================
  // SAFETY CONTEXT (LOCKED)
  // =====================================
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

  // =====================================
  // STEP 0: MARKET REGIME (SIDEWAYS KILL)
  // =====================================
  const regime = detectMarketRegime(data);
  if (regime.regime === "SIDEWAYS") {
    return applySafety(
      {
        signal: "WAIT",
        reason: "Sideways market detected",
        mode: "NO_TRADE",
        riskTag,
      },
      safetyContext
    );
  }

  // =====================================
  // STEP 1: TREND (EMA 20 / 50)
  // =====================================
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

  // =====================================
  // STEP 2: MARKET STRUCTURE (HH/HL / LH/LL)
  // =====================================
  const structure = analyzeMarketStructure(data);
  if (!structure.valid) {
    return applySafety(
      {
        signal: "WAIT",
        reason: structure.reason,
        mode: "STRUCTURE_BLOCK",
        riskTag,
      },
      safetyContext
    );
  }

  // =====================================
  // STEP 3: RSI SANITY
  // =====================================
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

  // =====================================
  // STEP 4: MARKET BREADTH (PARTICIPATION)
  // =====================================
  const breadth = analyzeMarketBreadth(data.breadth || {});
 if (breadth.status !== "STRONG") {
    return applySafety(
      {
        signal: "WAIT",
        reason: breadth.reason,
        mode: "BREADTH_BLOCK",
        riskTag,
      },
      safetyContext
    );
  }

  // =====================================
  // STEP 5: BREAKOUT / BREAKDOWN (CLOSE BASED)
  // =====================================
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

  // =====================================
  // STEP 6: PRICE ACTION + GAP QUALITY
  // =====================================
  const priceAction = analyzePriceAction(data);
  if (!priceAction.valid) {
    return applySafety(
      {
        signal: "WAIT",
        reason: priceAction.reason,
        mode: "PRICE_ACTION_BLOCK",
        riskTag,
      },
      safetyContext
    );
  }

  // =====================================
  // STEP 7: VOLUME VALIDATION (REAL MOVE)
  // =====================================
  const volumeCheck = validateVolume({
    volume: data.volume,
    avgVolume: data.avgVolume,
  });

  if (!volumeCheck.valid) {
    return applySafety(
      {
        signal: "WAIT",
        reason: volumeCheck.reason,
        mode: "VOLUME_BLOCK",
        riskTag,
      },
      safetyContext
    );
  }

  // =====================================
  // STEP 8: INTRADAY FAST MOVE (OVERRIDE)
  // =====================================
  if (data.tradeType === "INTRADAY") {
    const fastMove = detectFastMove({
      ltp: data.close,
      prevLtp: data.prevClose,
      volume: data.volume,
      avgVolume: data.avgVolume,
      trend: trendResult.trend,
      isExpiryDay: safetyContext.isExpiryDay,
      isResultDay: safetyContext.isResultDay,
    });

    if (fastMove.signal && fastMove.signal !== "WAIT") {
      return applySafety(
        {
          signal: fastMove.signal,
          reason: fastMove.reason,
          mode: "FAST_MOVE",
          riskTag,
        },
        safetyContext
      );
    }
  }

  // =====================================
  // STEP 9: INSTITUTIONAL FILTER (OI + PCR)
  // =====================================
  const oiSummary = summarizeOI(data.oiData || []);
  const pcrContext = getPCRContext(data.pcrValue);
  const greeksContext = getGreeksContext(data.greeks || {});

  // =====================================
  // STEP 10: STRONG BUY / STRONG SELL (RARE)
  // =====================================
  const strong = evaluateStrongBuy({
    trend: trendResult.trend,
    breakoutAction: breakoutResult.action,
    priceAction,
    volumeCheck,
    breadth,
    structure,
  });

  if (
    strong.strong &&
    ((strong.signal === "STRONG_BUY" &&
      (oiSummary.bias === "BEARISH" || pcrContext.bias === "BEARISH")) ||
     (strong.signal === "STRONG_SELL" &&
      (oiSummary.bias === "BULLISH" || pcrContext.bias === "BULLISH")))
  ) {
    return applySafety(
      {
        signal: "WAIT",
        reason: "Strong setup but institutional conflict",
        mode: "INSTITUTION_BLOCK",
        riskTag,
      },
      safetyContext
    );
  }

  // =====================================
  // FINAL SIGNAL (PRIORITY)
  // =====================================
  const finalSignal = strong.strong
    ? strong.signal
    : breakoutResult.action;

  const finalReason = strong.strong
    ? strong.reason
    : "All core + regime + breadth conditions aligned";

  return applySafety(
    {
      signal: finalSignal,
      trend: trendResult.trend,
      reason: finalReason,

      institutionalBias: oiSummary.bias,
      pcrBias: pcrContext.bias,
      greeksNote: greeksContext.note,

      mode: strong.strong ? "STRONG" : "NORMAL",
      riskTag,
    },
    safetyContext
  );
}

module.exports = {
  finalDecision,
};
