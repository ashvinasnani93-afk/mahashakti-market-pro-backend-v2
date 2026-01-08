// ==================================================
// OPTIONS SIGNAL ENGINE (PHASE-3 FINAL)
// CORE BRAIN – RULE LOCKED
// UI SYMBOL BASED (NO BUY/SELL WORD DEPENDENCY)
// ==================================================

const { evaluateBuyerContext } = require("./optionsBuyer.engine");
const {
  getOptionsSellerContext,
} = require("./optionsSellerContext.service");

// ==========================================
// OPTIONS NO-TRADE ZONE (FOUNDATION)
// ==========================================
function isNoTradeZone({ spotPrice, ema20, ema50 }) {
  if (
    typeof spotPrice !== "number" ||
    typeof ema20 !== "number" ||
    typeof ema50 !== "number"
  ) {
    return false;
  }

  const emaDiffPercent =
    (Math.abs(ema20 - ema50) / spotPrice) * 100;

  const priceNearEMA =
    (Math.abs(spotPrice - ema20) / spotPrice) * 100 < 0.15;

  return emaDiffPercent < 0.2 && priceNearEMA;
}

// ==========================================
// UI SIGNAL MAPPER (LOCKED ACROSS APP)
// ==========================================
function mapUISignal(type) {
  if (type === "BUY") {
    return { uiSignal: "BUY", uiColor: "GREEN", uiIcon: "🟢" };
  }
  if (type === "SELL") {
    return { uiSignal: "SELL", uiColor: "RED", uiIcon: "🔴" };
  }
  return { uiSignal: "WAIT", uiColor: "YELLOW", uiIcon: "🟡" };
}

/**
 * generateOptionsSignal
 * Context comes ONLY from optionsMaster.service
 */
function generateOptionsSignal(context = {}) {
  const {
    symbol,
    spotPrice,
    expiryType,
    tradeContext,
    safety,
    ema20,
    ema50,
    rsi,
    vix,
  } = context;

  // --------------------------------------------------
  // HARD INPUT VALIDATION
  // --------------------------------------------------
  if (!symbol || typeof spotPrice !== "number") {
    return {
      status: "WAIT",
      ...mapUISignal("WAIT"),
    };
  }

  if (!expiryType || !tradeContext) {
    return {
      status: "WAIT",
      ...mapUISignal("WAIT"),
    };
  }

  // --------------------------------------------------
  // SAFETY GATE (FINAL AUTHORITY)
  // --------------------------------------------------
  if (!safety || safety.allowTrade === false) {
    return {
      status: "WAIT",
      regime: "HIGH_RISK",
      ...mapUISignal("WAIT"),
    };
  }

  // --------------------------------------------------
  // TREND CHECK (EMA 20 / EMA 50)
  // --------------------------------------------------
  if (typeof ema20 !== "number" || typeof ema50 !== "number") {
    return {
      status: "WAIT",
      ...mapUISignal("WAIT"),
    };
  }

  let trend = "SIDEWAYS";
  if (ema20 > ema50) trend = "UPTREND";
  else if (ema20 < ema50) trend = "DOWNTREND";

  // --------------------------------------------------
  // REGIME DETECTION (FIXED)
  // --------------------------------------------------
  let regime = "SIDEWAYS";

  if (trend !== "SIDEWAYS") {
    regime = "TRENDING";
  }

  if (isNoTradeZone({ spotPrice, ema20, ema50 })) {
    regime = "NO_TRADE_ZONE";
  }

  // --------------------------------------------------
  // RSI + VIX SANITY
  // --------------------------------------------------
  if (typeof rsi !== "number") {
    return {
      status: "WAIT",
      regime,
      ...mapUISignal("WAIT"),
    };
  }

  if (rsi >= 70 || rsi <= 30 || (typeof vix === "number" && vix >= 18)) {
    return {
      status: "WAIT",
      regime: "HIGH_RISK",
      ...mapUISignal("WAIT"),
    };
  }

  // --------------------------------------------------
  // BUYER ENGINE (FIXED INPUT)
  // --------------------------------------------------
  const buyerContext = evaluateBuyerContext({
    trend,
    rsi,
    vix,
    safety,
  });

  if (buyerContext.buyerAllowed) {
   return {
  status: "READY",
  trend,
  regime: "TRENDING",
  ...mapUISignal("BUY"),
};
  }

  // --------------------------------------------------
  // SELLER CONTEXT SERVICE (FIXED LAYER)
  // --------------------------------------------------
  const sellerContext = getOptionsSellerContext({
    regime,
    trend,
    safety,
    expiryType,
  });

  if (sellerContext.sellerAllowed) {
   return {
  status: "READY",
  trend,
  regime,
  ...mapUISignal("SELL"),
};
  }

  // --------------------------------------------------
  // FINAL WAIT
  // --------------------------------------------------
  return {
    status: "WAIT",
    trend,
    regime,
    ...mapUISignal("WAIT"),
  };
}

// --------------------------------------------------
// EXPORT
// --------------------------------------------------
module.exports = {
  generateOptionsSignal,
};
