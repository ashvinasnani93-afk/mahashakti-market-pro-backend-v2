// ==================================================
// OPTIONS SIGNAL ENGINE (PHASE-3)
// CORE BRAIN – RULE LOCKED
// NO DUMMY | NO SHORTCUT
// ==================================================

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

  // EMA compression check
  const emaDiffPercent =
    (Math.abs(ema20 - ema50) / spotPrice) * 100;

  // Price too close to EMA (noise zone)
  const priceNearEMA =
    (Math.abs(spotPrice - ema20) / spotPrice) * 100 < 0.15;

  // NO-TRADE ZONE condition
  if (emaDiffPercent < 0.2 && priceNearEMA) {
    return true;
  }

  return false;
}

/**
 * generateOptionsSignal
 * @param {object} context
 * @returns {object}
 *
 * Context comes ONLY from optionsMaster.service
 * No direct market / API calls here
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
    rsi, // ✅ RSI added
  } = context;

  // --------------------------------------------------
  // HARD INPUT VALIDATION
  // --------------------------------------------------
  if (!symbol || typeof spotPrice !== "number") {
    return {
      status: "WAIT",
      reason: "Invalid symbol or spot price",
    };
  }

  if (!expiryType || !tradeContext) {
    return {
      status: "WAIT",
      reason: "Missing expiry or trade context",
    };
  }

  // --------------------------------------------------
  // SAFETY GATE (NON-NEGOTIABLE)
  // --------------------------------------------------
  if (!safety) {
    return {
      status: "WAIT",
      reason: "Safety context missing",
    };
  }

  if (safety.isExpiryDay) {
    return {
      status: "WAIT",
      reason: "Blocked by expiry-day safety rule",
    };
  }

  if (
    tradeContext === "INTRADAY_OPTIONS" &&
    !safety.intradayAllowed
  ) {
    return {
      status: "WAIT",
      reason: "Intraday options not allowed by safety layer",
    };
  }

  if (
    tradeContext === "POSITIONAL_OPTIONS" &&
    !safety.positionalAllowed
  ) {
    return {
      status: "WAIT",
      reason: "Positional options not allowed by safety layer",
    };
  }

  // --------------------------------------------------
  // TREND CHECK (EMA 20 / EMA 50) – LOCKED
  // --------------------------------------------------
  if (typeof ema20 !== "number" || typeof ema50 !== "number") {
    return {
      status: "WAIT",
      reason: "EMA data missing for options trend evaluation",
    };
  }

  let trend = "SIDEWAYS";
  if (ema20 > ema50) trend = "UPTREND";
  else if (ema20 < ema50) trend = "DOWNTREND";

  // --------------------------------------------------
  // 🔒 OPTIONS NO-TRADE ZONE (LOCKED)
  // --------------------------------------------------
  if (isNoTradeZone({ spotPrice, ema20, ema50 })) {
    return {
      status: "WAIT",
      trend,
      reason: "Options no-trade zone: EMA compression / price noise",
    };
  }

  // --------------------------------------------------
  // RSI SANITY CHECK (OPTIONS) – LOCKED
  // --------------------------------------------------
  if (typeof rsi !== "number") {
    return {
      status: "WAIT",
      reason: "RSI data missing",
    };
  }

  if (rsi >= 70) {
    return {
      status: "WAIT",
      reason: "RSI overbought – no fresh options entry",
    };
  }

  if (rsi <= 30) {
    return {
      status: "WAIT",
      reason: "RSI oversold – no fresh options entry",
    };
  }

  // --------------------------------------------------
  // FINAL ENGINE OUTPUT (NO BUY / SELL)
  // --------------------------------------------------
  return {
    status: "WAIT",
    engine: "OPTIONS_SIGNAL_ENGINE",
    trend,
    rsiStatus: "NORMAL",
    note:
      "EMA trend + RSI sanity + no-trade zone evaluated. Rules locked.",
  };
}

// --------------------------------------------------
// EXPORT
// --------------------------------------------------
module.exports = {
  generateOptionsSignal,
};
