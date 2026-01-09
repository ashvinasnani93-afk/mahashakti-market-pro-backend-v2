/*
====================================================================
MAHASHAKTI MARKET PRO — SIGNAL DECISION FLOW (LOCKED)
====================================================================

FINAL OUTPUT POSSIBLE:
- BUY
- SELL
- STRONG_BUY
- STRONG_SELL
- WAIT

IMPORTANT:
- Ye file signal generate karti hai
- Har step fail hone par signal = WAIT
- Koi bhi step skip nahi hota
- ORDER FIXED hai (change = rule break)

====================================================================
STEP-0 : MARKET REGIME FILTER
====================================================================
INPUT:
- EMA20, EMA50
- candle overlap
- price speed
- optional VIX

LOGIC:
- Agar market SIDEWAYS detect ho →
  SIGNAL = WAIT

WHY:
- Sideways market me breakout fake hote hain
- Capital protection first priority

====================================================================
STEP-1 : EMA TREND FILTER (20 / 50)
====================================================================
BUY DIRECTION:
- price > EMA20
- EMA20 > EMA50

SELL DIRECTION:
- price < EMA20
- EMA20 < EMA50

WAIT:
- EMA overlap
- price EMA ke beech
- flat / unclear trend

RULE:
- EMA sirf trend batata hai
- EMA akela BUY / SELL nahi deta
- EMA WAIT → final signal WAIT

====================================================================
STEP-2 : MARKET STRUCTURE FILTER
====================================================================
BUY allowed only if:
- Higher High
- Higher Low
- Structure = UPTREND

SELL allowed only if:
- Lower High
- Lower Low
- Structure = DOWNTREND

FAIL CASE:
- Structure unclear / sideways
→ SIGNAL = WAIT

WHY:
- Trend bina structure ke unreliable hota hai

====================================================================
STEP-3 : RSI SANITY FILTER
====================================================================
BUY BLOCKED if:
- RSI >= 70 (overbought)

SELL BLOCKED if:
- RSI <= 30 (oversold)

ALLOWED:
- RSI normal zone me ho
- RSI trend ke against extreme na ho

WHY:
- Late entry avoid karna
- Exhaustion moves se bachna

====================================================================
STEP-4 : BREAKOUT / BREAKDOWN CONFIRMATION
====================================================================
BUY:
- Close > Resistance
- Trend = UPTREND

SELL:
- Close < Support
- Trend = DOWNTREND

IMPORTANT:
- Sirf CLOSE based confirmation
- Wick / intrabar ignore

FAIL:
- No clear close breakout
→ SIGNAL = WAIT

====================================================================
STEP-5 : MARKET BREADTH FILTER
====================================================================
BUY allowed only if:
- Breadth = BULLISH

SELL allowed only if:
- Breadth = BEARISH

WHY:
- Index / stock akela nahi chalna chahiye
- Market support zaruri

====================================================================
STEP-5.5 : SECTOR PARTICIPATION FILTER
====================================================================
REQUIRED:
- Active sectors >= threshold

BLOCK:
- Participation = WEAK
→ SIGNAL = WAIT

WHY:
- Sector support bina move fail hota hai
- Is filter ke bina fake breakouts aate hain

====================================================================
STEP-6 : PRICE ACTION QUALITY
====================================================================
BUY:
- Strong bullish candle
- Clear body dominance

SELL:
- Strong bearish candle
- Clear seller control

BLOCK:
- Doji
- Weak / indecision candle

WHY:
- Entry candle ka quality critical hai

====================================================================
STEP-7 : VOLUME VALIDATION
====================================================================
CONFIRM:
- Volume >= Average Volume
- Direction ke saath volume align

FAIL:
- Low volume breakout
→ SIGNAL = WAIT

WHY:
- Volume bina move = manipulation risk

====================================================================
STEP-8 : INTRADAY FAST MOVE (OVERRIDE)
====================================================================
APPLIES ONLY IF:
- tradeType = INTRADAY

LOGIC:
- Sudden price + volume expansion
- Expiry / Result day rules applied

NOTE:
- Ye override hai
- Normal flow ke upar ka safety layer

====================================================================
STEP-9 : INSTITUTIONAL FILTER (OI + PCR)
====================================================================
BLOCK:
- BUY ke against heavy bearish OI / PCR
- SELL ke against heavy bullish OI / PCR

WHY:
- Retail vs institution conflict avoid karna

====================================================================
STEP-10 : STRONG BUY / STRONG SELL (RARE)
====================================================================
ALL MUST ALIGN:
- Structure
- Trend
- EMA alignment
- Strong price action
- High volume
- Real breakout
- Market breadth
- Sector participation
- VIX not high
- Not result / expiry day

FAIL:
- Ek bhi mismatch
→ Normal BUY / SELL or WAIT

WHY:
- STRONG signals sirf high-conviction ke liye

====================================================================
FINAL OUTPUT RULE
====================================================================
- Agar STRONG signal valid → STRONG_BUY / STRONG_SELL
- Else agar breakout valid → BUY / SELL
- Else → WAIT

NO EXCEPTION.
NO SHORTCUT.
CAPITAL PROTECTION FIRST.
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
  const regime = detectMarketRegime(data);
  if (regime.regime === "SIDEWAYS") {
    return applySafety(
      {
        signal: "WAIT",
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
        riskTag,
      },
      safetyContext
    );
  }

  // =====================================
  // STEP 4: BREAKOUT / BREAKDOWN (CLOSE BASED)
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
        riskTag,
      },
      safetyContext
    );
  }

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
