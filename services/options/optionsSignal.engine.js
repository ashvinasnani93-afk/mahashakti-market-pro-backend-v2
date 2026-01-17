// ==================================================
// OPTIONS SIGNAL ENGINE (FINAL – STRONG SIGNAL WIRED)
// MAHASHAKTI MARKET PRO
// BUY / SELL / STRONG BUY / STRONG SELL / WAIT
// ==================================================

const { evaluateBuyerContext } = require("./optionsBuyer.engine");
const { getOptionsSellerContext } = require("./optionsSellerContext.service");
const { generateStrongSignal } = require("./strongBuy.engine"); // 🔥 STRONG SIGNAL WIRING

// ---------- NO TRADE ZONE ----------
function isNoTradeZone({ spotPrice, ema20, ema50 }) {
  if (!spotPrice || !ema20 || !ema50) return false;

  const emaDiffPercent = (Math.abs(ema20 - ema50) / spotPrice) * 100;
  const priceNearEMA =
    (Math.abs(spotPrice - ema20) / spotPrice) * 100 < 0.1;

  return emaDiffPercent < 0.1 && priceNearEMA;
}

// ---------- UI SIGNAL MAPPING ----------
function mapUISignal(type) {
  const mapping = {
    STRONG_BUY: {
      uiSignal: "STRONG_BUY",
      uiColor: "DARK_GREEN",
      uiIcon: "🟢🔥",
    },
    STRONG_SELL: {
      uiSignal: "STRONG_SELL",
      uiColor: "DARK_RED",
      uiIcon: "🔴🔥",
    },
    BUY: { uiSignal: "BUY", uiColor: "GREEN", uiIcon: "🟢" },
    SELL: { uiSignal: "SELL", uiColor: "RED", uiIcon: "🔴" },
    WAIT: { uiSignal: "WAIT", uiColor: "YELLOW", uiIcon: "🟡" },
  };

  return mapping[type] || mapping.WAIT;
}

// ---------- MAIN ENGINE ----------
function generateOptionsSignal(context = {}) {
  const {
    symbol,
    spotPrice,
    ema20,
    ema50,
    rsi,
    vix,
    safety = { allowTrade: true },
    expiryType,

    // 🆕 OPTIONAL CONTEXT FOR STRONG ENGINE
    volumeConfirm = true,
    breakoutQuality = "REAL",
    marketBreadth = "BULLISH",
    isResultDay = false,
    isExpiryDay = false,
  } = context;

  // ==========================
  // 1. BASIC CHECK
  // ==========================
  if (!symbol || !spotPrice || !ema20 || !ema50 || !rsi) {
    return { status: "WAIT", ...mapUISignal("WAIT") };
  }

  // ==========================
  // 2. SAFETY CHECK
  // ==========================
  if (safety.allowTrade === false) {
    return {
      status: "WAIT",
      regime: "HIGH_RISK",
      ...mapUISignal("WAIT"),
    };
  }

  // ==========================
  // 3. TREND & REGIME
  // ==========================
  let trend = "SIDEWAYS";
  if (ema20 > ema50) trend = "UPTREND";
  else if (ema20 < ema50) trend = "DOWNTREND";

  let regime = trend === "SIDEWAYS" ? "SIDEWAYS" : "TRENDING";

  if (isNoTradeZone({ spotPrice, ema20, ema50 })) {
    regime = "NO_TRADE_ZONE";
  }

  // ==========================
  // 4. RSI EXTREMES (SOFT BLOCK)
  // ==========================
  if (rsi > 75 || rsi < 25) {
    return {
      status: "WAIT",
      regime: "OVERBOUGHT_OVERSOLD",
      ...mapUISignal("WAIT"),
    };
  }

  // ==========================
  // 5. 🔥 STRONG SIGNAL ENGINE (PRIORITY)
  // ==========================
  const strongContext = {
    structure: trend === "UPTREND" ? "UP" : "DOWN",
    trend,
    emaAlignment: trend === "UPTREND" ? "BULLISH" : "BEARISH",
    priceAction:
      trend === "UPTREND"
        ? rsi >= 60
          ? "STRONG_BULL"
          : "WEAK"
        : rsi <= 40
        ? "STRONG_BEAR"
        : "WEAK",
    volumeConfirm,
    breakoutQuality,
    marketBreadth,
    vixLevel: typeof vix === "number" && vix > 20 ? "HIGH" : "NORMAL",
    isResultDay,
    isExpiryDay,
  };

  const strongResult = generateStrongSignal(strongContext);

  if (strongResult?.status === "READY") {
    return {
      status: "READY",
      trend,
      regime: "TRENDING",
      ...mapUISignal(strongResult.signal), // STRONG_BUY / STRONG_SELL
      note: strongResult.note || "Strong institutional move detected",
    };
  }

  // ==========================
  // 6. STANDARD BUY LOGIC
  // ==========================
  const buyerContext = evaluateBuyerContext({
    trend,
    rsi,
    vix,
    safety,
    volumeSpike: volumeConfirm,
  });

  if (buyerContext?.buyerAllowed) {
    return {
      status: "READY",
      trend,
      regime: "TRENDING",
      ...mapUISignal("BUY"),
    };
  }

  // ==========================
  // 7. STANDARD SELL LOGIC
  // ==========================
  const sellerContext = getOptionsSellerContext({
    trend,
    regime,
    safety,
    expiryType,
  });

  if (sellerContext?.sellerAllowed) {
    return {
      status: "READY",
      trend,
      regime: "TRENDING",
      ...mapUISignal("SELL"),
    };
  }

  // ==========================
  // 8. FINAL FALLBACK (NO DEAD WAIT)
  // ==========================
  if (trend === "UPTREND") {
    return {
      status: "READY",
      trend,
      regime: "TRENDING",
      ...mapUISignal("BUY"),
    };
  }

  if (trend === "DOWNTREND") {
    return {
      status: "READY",
      trend,
      regime: "TRENDING",
      ...mapUISignal("SELL"),
    };
  }

  // TRUE SIDEWAYS
  return {
    status: "WAIT",
    trend,
    regime,
    ...mapUISignal("WAIT"),
  };
}

// ==================================================
// EXPORT
// ==================================================
module.exports = {
  generateOptionsSignal,
};
