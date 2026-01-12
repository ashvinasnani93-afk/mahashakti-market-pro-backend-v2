// ==================================================
// OPTIONS SIGNAL ENGINE (PRACTICAL OPTIMIZATION)
// ==================================================

const { evaluateBuyerContext } = require("./optionsBuyer.engine");
const { getOptionsSellerContext } = require("./optionsSellerContext.service");

// Optimized No-Trade Zone (Narrower filter)
function isNoTradeZone({ spotPrice, ema20, ema50 }) {
  if (!spotPrice || !ema20 || !ema50) return false;

  const emaDiffPercent = (Math.abs(ema20 - ema50) / spotPrice) * 100;
  
  // EMA overlap logic relaxed to 0.10% (was 0.2%)
  const priceNearEMA = (Math.abs(spotPrice - ema20) / spotPrice) * 100 < 0.10;

  return emaDiffPercent < 0.10 && priceNearEMA;
}

function mapUISignal(type) {
  if (type === "BUY") return { uiSignal: "BUY", uiColor: "GREEN", uiIcon: "🟢" };
  if (type === "SELL") return { uiSignal: "SELL", uiColor: "RED", uiIcon: "🔴" };
  return { uiSignal: "WAIT", uiColor: "YELLOW", uiIcon: "🟡" };
}

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

  if (!symbol || !spotPrice || !ema20 || !ema50 || !rsi) {
    return { status: "WAIT", ...mapUISignal("WAIT") };
  }

  // Safety Gate
  if (!safety || safety.allowTrade === false) {
    return { status: "WAIT", regime: "HIGH_RISK", ...mapUISignal("WAIT") };
  }

  // Practical Trend Detection
  let trend = "SIDEWAYS";
  if (ema20 > ema50) trend = "UPTREND";
  else if (ema20 < ema50) trend = "DOWNTREND";

  let regime = "SIDEWAYS";
  if (trend !== "SIDEWAYS") regime = "TRENDING";
  if (isNoTradeZone({ spotPrice, ema20, ema50 })) regime = "NO_TRADE_ZONE";

  // RSI Filter: Relaxed (Allowing 30-70 range comfortably)
  if (rsi > 70 || rsi < 30) {
    return { status: "WAIT", regime: "OVERBOUGHT_OVERSOLD", ...mapUISignal("WAIT") };
  }

  // Buyer Logic
  const buyerContext = evaluateBuyerContext({ trend, rsi, vix, safety });
  if (buyerContext.buyerAllowed) {
    return { status: "READY", trend, regime: "TRENDING", ...mapUISignal("BUY") };
  }

  // Seller Logic
  const sellerContext = getOptionsSellerContext({ regime, trend, safety, expiryType });
  if (sellerContext.sellerAllowed) {
    return { status: "READY", trend, regime, ...mapUISignal("SELL") };
  }

  return { status: "WAIT", trend, regime, ...mapUISignal("WAIT") };
}

module.exports = {
  generateOptionsSignal,
};
