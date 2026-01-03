// ==========================================
// INDEX MASTER SERVICE (FOUNDATION)
// Central registry for all instruments
// NO SIGNAL | NO INDICATORS | RULE-LOCKED
// ==========================================

/**
 * INDEX / INSTRUMENT REGISTRY
 * This decides:
 * - Which symbols are allowed
 * - Which segments they belong to
 * - What trade types are allowed
 * - Whether OPTION CHAIN is supported
 */
const INDEX_REGISTRY = {
  // ==========================
  // NSE INDEXES
  // ==========================
  NIFTY: {
    instrumentType: "INDEX",
    exchange: "NSE",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
    optionChain: true,
  },

  BANKNIFTY: {
    instrumentType: "INDEX",
    exchange: "NSE",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
    optionChain: true,
  },

  FINNIFTY: {
    instrumentType: "INDEX",
    exchange: "NSE",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY"],
    optionChain: true,
  },

  MIDCPNIFTY: {
    instrumentType: "INDEX",
    exchange: "NSE",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY"],
    optionChain: true,
  },

  // ==========================
  // BSE INDEX
  // ==========================
  SENSEX: {
    instrumentType: "INDEX",
    exchange: "BSE",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
    optionChain: true,
  },

  // ==========================
  // STOCK OPTIONS (STARTER SET)
  // ==========================
  RELIANCE: {
    instrumentType: "STOCK",
    exchange: "NSE",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
    optionChain: true,
  },

  TCS: {
    instrumentType: "STOCK",
    exchange: "NSE",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
    optionChain: true,
  },

  // ==========================
  // VOLATILITY INDEX (DISPLAY ONLY)
  // ==========================
  VIX: {
    instrumentType: "INDEX",
    exchange: "NSE",
    segments: ["DISPLAY_ONLY"],
    allowedTradeTypes: [],
    optionChain: false,
    note: "Used only for risk & safety context",
  },
};

/**
 * getIndexConfig
 * @param {string} symbol
 * @returns {object|null}
 */
function getIndexConfig(symbol) {
  if (!symbol) return null;
  const key = symbol.toUpperCase();
  return INDEX_REGISTRY[key] || null;
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getIndexConfig,
};
