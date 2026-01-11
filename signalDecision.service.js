// ==========================================
// SIGNAL DECISION ENGINE – FOUNDER VERSION
// GROUP-WISE LOGIC (SOFTENED + SAFE)
// BUY / SELL / STRONG BUY / STRONG SELL / WAIT
// ==========================================

// ---------- CORE TECH ----------
const {
  checkTrend,
  checkRSI,
  checkBreakout,
  checkVolume,
} = require("./signal.engine");

// ---------- DIRECTION (HARD) ----------
const { detectMarketRegime } = require("./services/marketRegime.service");
const { analyzeMarketBreadth } = require("./services/marketBreadth.service");
const { analyzeMarketStructure } = require("./services/marketStructure.service");

// ---------- ENTRY QUALITY ----------
const { analyzePriceAction } = require("./services/priceAction.service");
const { analyzeSectorParticipation } = require("./services/sectorParticipation.service");

// ---------- STRONG SIGNAL ----------
const { generateStrongSignal } = require("./services/strongBuy.engine");

// ---------- SAFETY (SOFTENED) ----------
const { applySafety } = require("./signalSafety.service");

/**
 * FINAL DECISION
 */
function finalDecision(data = {}) {

  // ==================================================
  // GROUP-1: MARKET DIRECTION (❌ HARD – NEVER SOFT)
  // ==================================================

  const regime = detectMarketRegime(data);
  if (regime.regime === "SIDEWAYS") {
    return { signal: "WAIT" };
  }

  const trendResult = checkTrend({
    closes: data.closes,
    ema20: data.ema20,
    ema50: data.ema50,
  });

  if (trendResult.trend === "NO_TRADE") {
    return { signal: "WAIT" };
  }

  const structure = analyzeMarketStructure(data);
  if (!structure.valid) {
    return { signal: "WAIT" };
  }

 const breadth = analyzeMarketBreadth(data.breadthData || {});
  if (
    (trendResult.trend === "UPTREND" && breadth.strength !== "BULLISH") ||
    (trendResult.trend === "DOWNTREND" && breadth.strength !== "BEARISH")
  ) {
    return { signal: "WAIT" };
  }

  const breakoutResult = checkBreakout({
    close: data.close,
    support: data.support,
    resistance: data.resistance,
    trend: trendResult.trend,
  });

  if (!breakoutResult.allowed) {
    return { signal: "WAIT" };
  }

  // ==================================================
  // 🟡 GROUP-2: ENTRY QUALITY (✅ SOFTENED – MAIN FIX)
  // Rule: 2 OUT OF 4 REQUIRED
  // ==================================================

  let entryScore = 0;

  // 1️⃣ RSI sanity
  const rsiCheck = checkRSI({
    rsi: data.rsi,
    trend: trendResult.trend,
  });
  if (rsiCheck.allowed) entryScore++;

  // 2️⃣ Volume confirmation
  const volumeCheck = checkVolume({
    volume: data.volume,
    avgVolume: data.avgVolume,
  });
  if (volumeCheck.allowed) entryScore++;

  // 3️⃣ Candle quality
  const priceAction = analyzePriceAction(data);
  if (priceAction.valid) entryScore++;

  // 4️⃣ Sector participation
  const sector = analyzeSectorParticipation(data.sectors || []);
  if (sector.participation !== "WEAK") entryScore++;

  // ❌ ENTRY FAIL
  if (entryScore < 2) {
    return { signal: "WAIT" };
  }

  // ==================================================
  // 🔥 GROUP-3: STRONG BUY / STRONG SELL (RARE)
  // ==================================================

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

    volumeConfirm: volumeCheck.allowed === true,
    breakoutQuality: "REAL",
    marketBreadth: breadth.strength,
    vixLevel:
      typeof data.vix === "number" && data.vix >= 20
        ? "HIGH"
        : "NORMAL",

    isResultDay: data.isResultDay === true,
    isExpiryDay: data.isExpiryDay === true,
  });

  // ==================================================
  // 🔴 GROUP-4: PROTECTION (⚠️ SOFT – WARN ONLY)
  // ==================================================

  const baseSignal = strong.signal
    ? strong.signal
    : breakoutResult.action;

  const safeSignal = applySafety(
    { signal: baseSignal },
    {
      isResultDay: data.isResultDay,
      isExpiryDay: data.isExpiryDay,
      tradeCountToday: data.tradeCountToday,
      tradeType: data.tradeType,
      vix: data.vix,
    }
  );

  // ==================================================
  // ✅ FINAL OUTPUT
  // ==================================================
  return {
    signal: safeSignal.signal || "WAIT",
  };
}

module.exports = {
  finalDecision,
};
