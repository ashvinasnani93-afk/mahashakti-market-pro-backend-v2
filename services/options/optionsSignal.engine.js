// ==================================================
// OPTIONS SIGNAL ENGINE (PHASE-3)
// CORE BRAIN – RULE LOCKED
// NO DUMMY | NO SHORTCUT
// ==================================================

const { evaluateSellerContext } = require("./optionsSeller.engine");

// ==========================================
// OPTIONS NO-TRADE ZONE (FOUNDATION)
// Sideways / Noise market protection
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
    return { status: "WAIT", reason: "Invalid symbol or spot price" };
  }

  if (!expiryType || !tradeContext) {
    return { status: "WAIT", reason: "Missing expiry or trade context" };
  }

  // --------------------------------------------------
  // SAFETY GATE (NON-NEGOTIABLE)
  // --------------------------------------------------
  if (!safety) {
    return { status: "WAIT", reason: "Safety context missing" };
  }

  if (safety.isExpiryDay || safety.isResultDay) {
    return {
      status: "WAIT",
      regime: "HIGH_RISK",
      buyerAllowed: false,
      sellerAllowed: false,
      reason: "Result / expiry day risk",
    };
  }

  if (tradeContext === "INTRADAY_OPTIONS" && !safety.intradayAllowed) {
    return { status: "WAIT", reason: "Intraday options blocked by safety" };
  }

  if (tradeContext === "POSITIONAL_OPTIONS" && !safety.positionalAllowed) {
    return { status: "WAIT", reason: "Positional options blocked by safety" };
  }

  // --------------------------------------------------
  // TREND CHECK (EMA 20 / EMA 50)
  // --------------------------------------------------
  if (typeof ema20 !== "number" || typeof ema50 !== "number") {
    return { status: "WAIT", reason: "EMA data missing" };
  }

  let trend = "SIDEWAYS";
  if (ema20 > ema50) trend = "UPTREND";
  else if (ema20 < ema50) trend = "DOWNTREND";

  // --------------------------------------------------
  // NO-TRADE ZONE
  // --------------------------------------------------
  if (isNoTradeZone({ spotPrice, ema20, ema50 })) {
    return {
      status: "WAIT",
      trend,
      regime: "NO_TRADE_ZONE",
      buyerAllowed: false,
      sellerAllowed: false,
      reason: "EMA compression / price noise",
    };
  }

  // --------------------------------------------------
  // RSI + VIX SANITY
  // --------------------------------------------------
  if (typeof rsi !== "number") {
    return { status: "WAIT", reason: "RSI data missing" };
  }

  const rsiExtreme = rsi >= 70 || rsi <= 30;
  const highVix = typeof vix === "number" && vix >= 18;

  if (rsiExtreme || highVix) {
    return {
      status: "WAIT",
      regime: "HIGH_RISK",
      buyerAllowed: false,
      sellerAllowed: false,
      reason: "RSI extreme or high VIX",
    };
  }

  // --------------------------------------------------
  // BUYER / SELLER REGIME
  // --------------------------------------------------
  let regime = "SIDEWAYS";
  let buyerAllowed = false;
  let sellerAllowed = false;

  if (trend === "UPTREND" || trend === "DOWNTREND") {
    regime = "TRENDING";
    buyerAllowed = true;
  } else {
    regime = "SIDEWAYS";
    sellerAllowed = true;
  }

  // --------------------------------------------------
  // 🔥 SELLER ENGINE FINAL DECISION
  // --------------------------------------------------
  if (sellerAllowed) {
    const sellerContext = evaluateSellerContext({
      trend,
      rsi,
      safety,
    });

    if (sellerContext.sellerAllowed) {
      return {
        status: "SELL_ALLOWED",
        engine: "OPTIONS_SIGNAL_ENGINE",
        mode: "OPTION_SELLER",
        strategy: sellerContext.strategy,
        trend,
        regime,
        buyerAllowed: false,
        sellerAllowed: true,
        reason: sellerContext.note,
      };
    }
  }

  // --------------------------------------------------
  // FINAL OUTPUT (NO EXECUTION)
  // --------------------------------------------------
  return {
    status: "READY",
    engine: "OPTIONS_SIGNAL_ENGINE",
    symbol,
    spotPrice,
    trend,
    regime,
    buyerAllowed,
    sellerAllowed,
    note: "Options regime evaluated (buyer/seller rules applied)",
  };
}

// --------------------------------------------------
// EXPORT
// --------------------------------------------------
module.exports = {
  generateOptionsSignal,
};
