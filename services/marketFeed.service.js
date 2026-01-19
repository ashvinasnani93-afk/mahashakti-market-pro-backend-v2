// ==========================================
// MARKET FEED SERVICE (REAL DATA PIPELINE)
// MAHASHAKTI MARKET PRO
// Role: Collect live market data and normalize for signal engine
// ==========================================

// This service prepares REAL market data
// and sends clean input to signalDecision.service.js

function buildEngineData(raw = {}) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const normalize = (v) => {
    if (typeof v === "number") return v;
    if (Array.isArray(v) && v.length > 0) return v[v.length - 1];
    return null;
  };

  const normalizeArray = (v) => {
    if (Array.isArray(v)) return v;
    return [];
  };

  return {
    // =====================
    // BASIC IDENTITY
    // =====================
    symbol: raw.symbol || raw.indexName || "UNKNOWN",
    segment: raw.segment || "EQUITY",
    tradeType: raw.tradeType || "INTRADAY",

    // =====================
    // PRICE DATA
    // =====================
    open: normalize(raw.open),
    high: normalize(raw.high),
    low: normalize(raw.low),
    close: normalize(raw.close || raw.spotPrice),
    prevClose: normalize(raw.prevClose),

    // =====================
    // INDICATORS
    // =====================
    ema20: normalize(raw.ema20),
    ema50: normalize(raw.ema50),
    rsi: normalize(raw.rsi),

    // =====================
    // VOLUME
    // =====================
    volume: normalize(raw.volume),
    avgVolume: normalize(raw.avgVolume),

    // =====================
    // RANGE LEVELS
    // =====================
    rangeHigh: normalize(raw.rangeHigh || raw.high),
    rangeLow: normalize(raw.rangeLow || raw.low),

    // =====================
    // ARRAYS (HISTORY)
    // =====================
    closes: normalizeArray(raw.closes),
    highs: normalizeArray(raw.highs),
    lows: normalizeArray(raw.lows),
    volumes: normalizeArray(raw.volumes),

    // =====================
    // CONTEXT FLAGS
    // =====================
    isResultDay: raw.isResultDay === true,
    isExpiryDay: raw.isExpiryDay === true,
    tradeCountToday: Number(raw.tradeCountToday || 0),

    // =====================
    // VOLATILITY
    // =====================
    vix: normalize(raw.vix),

    // =====================
    // OPTIONAL INSTITUTIONAL DATA
    // =====================
    fiiNet: normalize(raw.fiiNet),
    diiNet: normalize(raw.diiNet),
    pcrValue: normalize(raw.pcrValue),
  };
}

module.exports = {
  buildEngineData,
};
