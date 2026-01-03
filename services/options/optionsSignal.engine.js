// ==================================================
// OPTIONS SIGNAL ENGINE (PHASE-3)
// CORE BRAIN – RULE LOCKED
// NO DUMMY | NO SHORTCUT
// ==================================================

const { evaluateSellerContext } = require("./optionsSeller.engine");
const { evaluateBuyerContext } = require("./optionsBuyer.engine");

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

// ==========================================
// UI SIGNAL MAPPER (LOCKED)
// ==========================================
function mapUISignal({ buyerAllowed, sellerAllowed }) {
  if (buyerAllowed) {
    return {
      uiSignal: "BUY",
      uiColor: "GREEN",
      uiIcon: "🟢",
    };
  }

  if (sellerAllowed) {
    return {
      uiSignal: "SELL",
      uiColor: "RED",
      uiIcon: "🔴",
    };
  }

  return {
    uiSignal: "WAIT",
    uiColor: "YELLOW",
    uiIcon: "🟡",
  };
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
      ...mapUISignal({}),
      reason: "Result / expiry day risk",
    };
  }

  if (tradeContext === "INTRADAY_OPTIONS" && !safety.intradayAllowed) {
    return {
      status: "WAIT",
      ...mapUISignal({}),
      reason: "Intraday options blocked by safety",
    };
  }

  if (tradeContext === "POSITIONAL_OPTIONS" && !safety.positionalAllowed) {
    return {
      status: "WAIT",
      ...mapUISignal({}),
      reason: "Positional options blocked by safety",
    };
  }

  // --------------------------------------------------
  // TREND CHECK (EMA 20 / EMA 50)
  // --------------------------------------------------
  if (typeof ema20 !== "number" || typeof ema50 !== "number") {
    return {
      status: "WAIT",
      ...mapUISignal({}),
      reason: "EMA data missing",
    };
  }

  let trend = "SIDEWAYS";
  if (ema20 > ema50) trend = "UPTREND";
  else if (ema20 < ema50) trend = "DOWNTREND";

  // --------------------------------------------------
  // OPTIONS NO-TRADE ZONE
  // --------------------------------------------------
  if (isNoTradeZone({ spotPrice, ema20, ema50 })) {
    return {
      status: "WAIT",
      trend,
      regime: "NO_TRADE_ZONE",
      ...mapUISignal({}),
      reason: "EMA compression / price noise",
    };
  }

  // --------------------------------------------------
  // RSI + VIX SANITY
  // --------------------------------------------------
  if (typeof rsi !== "number") {
    return {
      status: "WAIT",
      ...mapUISignal({}),
      reason: "RSI data missing",
    };
  }

  const rsiExtreme = rsi >= 70 || rsi <= 30;
  const highVix = typeof vix === "number" && vix >= 18;

  if (rsiExtreme || highVix) {
    return {
      status: "WAIT",
      regime: "HIGH_RISK",
      ...mapUISignal({}),
      reason: "RSI extreme or high VIX",
    };
  }

  // --------------------------------------------------
  // BUYER ENGINE
  // --------------------------------------------------
  const buyerContext = evaluateBuyerContext({
    trend,
    rsi,
    vix,
    safety,
    tradeContext,
  });

  const buyerAllowed = buyerContext.buyerAllowed;

  // --------------------------------------------------
  // REGIME DECISION
  // --------------------------------------------------
  let regime = buyerAllowed ? "TRENDING" : "SIDEWAYS";
  let sellerAllowed = !buyerAllowed;

  // --------------------------------------------------
  // SELLER ENGINE
  // --------------------------------------------------
  let sellerContext = null;

  if (sellerAllowed) {
    sellerContext = evaluateSellerContext({
      trend,
      rsi,
      safety,
      regime,
      vix,
    });

    if (!sellerContext.sellerAllowed) {
      return {
        status: "WAIT",
        trend,
        regime,
        ...mapUISignal({}),
        reason: sellerContext.reason || sellerContext.note,
      };
    }
  }

  // --------------------------------------------------
  // FINAL OUTPUT (UI READY)
  // --------------------------------------------------
  const ui = mapUISignal({ buyerAllowed, sellerAllowed });

  return {
    status: "READY",
    engine: "OPTIONS_SIGNAL_ENGINE",
    symbol,
    spotPrice,
    trend,
    regime,

    buyerAllowed,
    buyerReason: buyerContext.reason,

    sellerAllowed: sellerContext ? sellerContext.sellerAllowed : false,
    sellerStrategy: sellerContext ? sellerContext.strategy : null,
    sellerReason: sellerContext ? sellerContext.note : null,

    // 🔥 UI LOCKED OUTPUT
    uiSignal: ui.uiSignal,
    uiColor: ui.uiColor,
    uiIcon: ui.uiIcon,

    note: "Options buyer/seller regime evaluated (UI symbol based)",
  };
}

// --------------------------------------------------
// EXPORT
// --------------------------------------------------
module.exports = {
  generateOptionsSignal,
};
