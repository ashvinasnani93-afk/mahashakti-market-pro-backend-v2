// ==================================================
// OPTIONS SIGNAL ENGINE (FINAL – NO DEAD WAIT)
// ==================================================

const { evaluateBuyerContext } = require("./optionsBuyer.engine");
const { getOptionsSellerContext } = require("./optionsSellerContext.service");

// ---------- NO TRADE ZONE ----------
function isNoTradeZone({ spotPrice, ema20, ema50 }) {
  if (!spotPrice || !ema20 || !ema50) return false;

  const emaDiffPercent = (Math.abs(ema20 - ema50) / spotPrice) * 100;
  const priceNearEMA =
    (Math.abs(spotPrice - ema20) / spotPrice) * 100 < 0.1;

  return emaDiffPercent < 0.1 && priceNearEMA;
}

// ---------- UI SIGNAL ----------
function mapUISignal(type) {
  if (type === "BUY")
    return { uiSignal: "BUY", uiColor: "GREEN", uiIcon: "🟢" };

  if (type === "SELL")
    return { uiSignal: "SELL", uiColor: "RED", uiIcon: "🔴" };

  return { uiSignal: "WAIT", uiColor: "YELLOW", uiIcon: "🟡" };
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
  } = context;

  // BASIC CHECK
  if (!symbol || !spotPrice || !ema20 || !ema50 || !rsi) {
    return { status: "WAIT", ...mapUISignal("WAIT") };
  }

  // SAFETY CHECK
  if (safety.allowTrade === false) {
    return {
      status: "WAIT",
      regime: "HIGH_RISK",
      ...mapUISignal("WAIT"),
    };
  }

  // TREND
  let trend = "SIDEWAYS";
  if (ema20 > ema50) trend = "UPTREND";
  else if (ema20 < ema50) trend = "DOWNTREND";

  let regime = trend === "SIDEWAYS" ? "SIDEWAYS" : "TRENDING";

  if (isNoTradeZone({ spotPrice, ema20, ema50 })) {
    regime = "NO_TRADE_ZONE";
  }

  // RSI FILTER
  if (rsi > 70 || rsi < 30) {
    return {
      status: "WAIT",
      regime: "OVERBOUGHT_OVERSOLD",
      ...mapUISignal("WAIT"),
    };
  }

  // BUY LOGIC
  const buyerContext = evaluateBuyerContext({ trend, rsi, vix, safety });
  if (buyerContext?.buyerAllowed) {
    return {
      status: "READY",
      trend,
      regime: "TRENDING",
      ...mapUISignal("BUY"),
    };
  }

  // SELL LOGIC
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
      regime,
      ...mapUISignal("SELL"),
    };
  }

  // 🔥 FINAL FALLBACK (NO MORE WAIT)
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

  // REAL SIDEWAYS
  return {
    status: "WAIT",
    trend,
    regime,
    ...mapUISignal("WAIT"),
  };
}

module.exports = {
  generateOptionsSignal,
};
