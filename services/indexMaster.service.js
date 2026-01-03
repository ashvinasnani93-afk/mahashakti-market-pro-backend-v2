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
 */
const INDEX_REGISTRY = {
  NIFTY: {
    instrumentType: "INDEX",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
  },

  BANKNIFTY: {
    instrumentType: "INDEX",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
  },

  FINNIFTY: {
    instrumentType: "INDEX",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY"],
  },

  MIDCPNIFTY: {
    instrumentType: "INDEX",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY"],
  },

  // --------------------------
  // STOCK OPTIONS (FUTURE READY)
  // --------------------------
  RELIANCE: {
    instrumentType: "STOCK",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
  },

  TCS: {
    instrumentType: "STOCK",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
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
