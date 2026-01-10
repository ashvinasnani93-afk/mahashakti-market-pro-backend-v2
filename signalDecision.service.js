/*
====================================================================
MAHASHAKTI MARKET PRO — SIGNAL DECISION FLOW (LOCKED)
====================================================================
... (poora explanation block yahin)
====================================================================
*/
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
const { generateStrongSignal } = require("./services/strongBuy.engine");
const {
  evaluateMomentumContext,
} = require("./services/momentumAdapter.service");
// 🆕 SECTOR PARTICIPATION (CONTEXT ONLY)
const {
  analyzeSectorParticipation,
} = require("./services/sectorParticipation.service");

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
//  const regime = detectMarketRegime(data);
//  if (regime.regime === "SIDEWAYS") {
//    return applySafety(
//      {
//        signal: "WAIT",
//        riskTag,
//      },
//      safetyContext
//    );
//  }

  // =====================================
  // STEP 1: TREND (EMA 20 / 50)
  // =====================================
  const trendResult = checkTrend({
    closes: data.closes,
    ema20: data.ema20,
    ema50: data.ema50,
  });
const trend = trendResult.trend;
 if (trendResult.trend === "NO_TRADE") {
  return applySafety(
    {
      signal: "WAIT",
      riskTag,
    },
    safetyContext
  );
}

// =====================================
// EMA CONTEXT (EXPLAINABLE LOGIC)
// =====================================
const emaContext =
  trendResult.trend === "UPTREND"
    ? {
        bias: "BUY_ALLOWED",
        meaning: "Price > EMA20 > EMA50 (bullish alignment)",
      }
    : trendResult.trend === "DOWNTREND"
    ? {
        bias: "SELL_ALLOWED",
        meaning: "Price < EMA20 < EMA50 (bearish alignment)",
      }
    : {
        bias: "WAIT_ONLY",
        meaning: "EMA compressed / sideways",
      };

  // =====================================
  // STEP 2: MARKET STRUCTURE (HH/HL / LH/LL)
  // =====================================
  const structure = analyzeMarketStructure(data);
  if (!structure.valid) {
    return applySafety(
      {
        signal: "WAIT",
        riskTag,
      },
      safetyContext
    );
  }
// =====================================
// MARKET STRUCTURE CONTEXT (EXPLAINABLE)
// =====================================
const structureContext =
  structure.structure === "UPTREND"
    ? {
        bias: "BUY_ALLOWED",
        meaning: "Higher High + Higher Low (trend continuation)",
      }
    : structure.structure === "DOWNTREND"
    ? {
        bias: "SELL_ALLOWED",
        meaning: "Lower High + Lower Low (trend continuation)",
      }
    : {
        bias: "WAIT_ONLY",
        meaning: "Structure broken / unclear",
      };
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
        riskTag,
      },
      safetyContext
    );
  }
// =====================================
// RSI CONTEXT (EXPLAINABLE)
// =====================================
const rsiContext =
  data.rsi >= 55 && trendResult.trend === "UPTREND"
    ? {
        bias: "BUY_ALLOWED",
        meaning: "RSI above 55 with bullish trend",
      }
    : data.rsi <= 45 && trendResult.trend === "DOWNTREND"
    ? {
        bias: "SELL_ALLOWED",
        meaning: "RSI below 45 with bearish trend",
      }
    : {
        bias: "WAIT_ONLY",
        meaning: "RSI in no-trade zone (45-55)",
      };
  // =====================================
  // STEP 4: BREAKOUT / BREAKDOWN (CLOSE BASED)
  // =====================================
  const breakoutResult = checkBreakout({
    close: data.close,
    support: data.support,
    resistance: data.resistance,
    trend: trendResult.trend,
  });
const breakoutAction = breakoutResult.action || null;
  if (!breakoutResult.allowed) {
    return applySafety(
      {
        signal: "WAIT",
        riskTag,
      },
      safetyContext
    );
  }
// =====================================
// BREAKOUT CONTEXT (EXPLAINABLE)
// =====================================
const breakoutContext =
  breakoutResult.action === "BUY"
    ? {
        bias: "BUY_ALLOWED",
        meaning: "Close above resistance (confirmed breakout)",
      }
    : breakoutResult.action === "SELL"
    ? {
        bias: "SELL_ALLOWED",
        meaning: "Close below support (confirmed breakdown)",
      }
   : {
        bias: "WAIT_ONLY",
        meaning: "No valid breakout / breakdown",
      };
  // =====================================
  // STEP 5: MARKET BREADTH DIRECTION FILTER
  // =====================================
  const breadth = analyzeMarketBreadth(data.breadth || {});

 if (
  breakoutResult.action === "BUY" &&
  breadth.strength === "BEARISH"
) {
  return applySafety(
    { signal: "WAIT", riskTag },
    safetyContext
  );
}
if (
  breakoutResult.action === "SELL" &&
  breadth.strength === "BULLISH"
) {
  return applySafety(
    { signal: "WAIT", riskTag },
    safetyContext
  );
}
// =====================================
// MARKET BREADTH CONTEXT (EXPLAINABLE)
// =====================================
const breadthContext =
  breadth.strength === "BULLISH"
    ? {
        bias: "BUY_ALLOWED",
        meaning: "Majority stocks advancing",
      }
    : breadth.strength === "BEARISH"
    ? {
        bias: "SELL_ALLOWED",
        meaning: "Majority stocks declining",
      }
    : {
        bias: "WAIT_ONLY",
        meaning: "Breadth not supportive",
      };
// =====================================================
// STEP 5.1 – STRONG BUY / STRONG SELL (OPERATOR GRADE)
// =====================================================

const strongSignalResult = checkStrongSignal({
  trend: trendResult.trend,
  breakoutAction,
  close: data.close,
  prevClose: data.prevClose,
  volume: data.volume,
  avgVolume: data.avgVolume,
});

// 🚨 STRONG SIGNAL OVERRIDE
if (strongSignalResult.strong) {
  return applySafety(
    {
      signal: strongSignalResult.signal,
      reason: strongSignalResult.reason,
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
        riskTag,
      },
      safetyContext
    );
  }
// =====================================
// PRICE ACTION CONTEXT
// =====================================
const priceActionContext =
  priceAction.valid && priceAction.sentiment === "BULLISH"
    ? {
        bias: "BUY_ALLOWED",
        meaning: "Strong bullish candle / acceptance",
      }
    : priceAction.valid && priceAction.sentiment === "BEARISH"
    ? {
        bias: "SELL_ALLOWED",
        meaning: "Strong bearish candle / rejection",
      }
    : {
        bias: "WAIT_ONLY",
        meaning: "Weak or indecisive candles",
      };
 // =====================================
// STEP 6.5: SECTOR PARTICIPATION (CARRY-3 RELAX)
// =====================================
const sectorParticipation = analyzeSectorParticipation(
  data.sectors || []
);

// ❗ RELAXATION RULE:
// Sector WEAK allowed ONLY if price action + breakout are strong
if (
  sectorParticipation.participation === "WEAK" &&
  !(
    priceAction.valid === true &&
    priceAction.strength === "STRONG" &&
    breakoutResult.allowed === true
  )
) {
  return applySafety(
    {
      signal: "WAIT",
      riskTag,
    },
    safetyContext
  );
}
// =====================================
// SECTOR PARTICIPATION CONTEXT
// =====================================
const sectorContext =
  sectorParticipation.participation === "STRONG"
    ? {
        bias: "TRADE_ALLOWED",
        meaning: "Leading sectors participating",
      }
    : {
        bias: "WAIT_ONLY",
        meaning: "Sector participation weak",
      };
  // =====================================
  // STEP 7: VOLUME VALIDATION (REAL MOVE)
  // =====================================
  const volumeCheck = validateVolume({
    currentVolume: data.volume,
    averageVolume: data.avgVolume,
    priceDirection:
      breakoutResult.action === "BUY" ? "UP" : "DOWN",
  });

  if (!volumeCheck.valid) {
    return applySafety(
      {
        signal: "WAIT",
        riskTag,
      },
      safetyContext
    );
  }
// =====================================
// VOLUME CONTEXT
// =====================================
const volumeContext =
  volumeCheck.valid
    ? {
        bias: "TRADE_ALLOWED",
        meaning: "Above average volume confirms move",
      }
    : {
        bias: "WAIT_ONLY",
        meaning: "Low volume, move not trustworthy",
      };
// =====================================
// STEP 7.5: CONTEXT MOMENTUM (SAFE)
// =====================================
// STEP 7.5: CONTEXT MOMENTUM (SAFE)
const momentum = {
  active:
    data.forceMomentum === true ||
    (
      typeof data.volume === "number" &&
      typeof data.avgVolume === "number" &&
      data.volume >= data.avgVolume * 1.25 &&
      (
        (trendResult.trend === "UPTREND" && data.rsi >= 50) ||
        (trendResult.trend === "DOWNTREND" && data.rsi <= 50)
      )
    )
};

if (!momentum.active) {
  return applySafety(
    {
      signal: "WAIT",
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
          riskTag: fastMove.riskTag || riskTag,
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
  const strong = generateStrongSignal({
    structure:
      structure.structure === "UPTREND"
        ? "UP"
        : structure.structure === "DOWNTREND"
        ? "DOWN"
        : "NONE",

    trend: trendResult.trend,

    emaAlignment:
      trendResult.trend === "UPTREND" ? "BULLISH" : "BEARISH",

    priceAction:
      priceAction.sentiment === "BULLISH" &&
      priceAction.strength === "STRONG"
        ? "STRONG_BULL"
        : priceAction.sentiment === "BEARISH" &&
          priceAction.strength === "STRONG"
        ? "STRONG_BEAR"
        : "WEAK",

    volumeConfirm: volumeCheck.valid === true,

    breakoutQuality:
      breakoutResult.allowed ? "REAL" : "FAKE",

    marketBreadth: breadth.strength || "SIDEWAYS",

    // ✅ FIX: sectorParticipation sirf EK baar
    sectorParticipation: sectorParticipation.participation,

    vixLevel:
      typeof data.vix === "number" && data.vix >= 20
        ? "HIGH"
        : typeof data.vix === "number" && data.vix <= 12
        ? "LOW"
        : "NORMAL",

    isResultDay: safetyContext.isResultDay,
    isExpiryDay: safetyContext.isExpiryDay,
  });

  if (
    strong.strong &&
    ((strong.signal === "STRONG_BUY" &&
      (oiSummary.bias === "BEARISH" ||
        pcrContext.bias === "BEARISH")) ||
      (strong.signal === "STRONG_SELL" &&
        (oiSummary.bias === "BULLISH" ||
          pcrContext.bias === "BULLISH")))
  ) {
    return applySafety(
      {
        signal: "WAIT",
        riskTag,
      },
      safetyContext
    );
  }

 // =====================================
  // FINAL SIGNAL (UI-SAFE – LOCKED)
  // =====================================
  const finalSignal =
    strong.strong
      ? strong.signal
      : breakoutResult.action || "WAIT";

  // 🔒 UI SAFE RETURN — NO REASON / NO TEXT
  return {
    signal: finalSignal,
  };
}

module.exports = {
  finalDecision,
};
