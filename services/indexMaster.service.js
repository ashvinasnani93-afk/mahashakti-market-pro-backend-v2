// ==========================================
// INDEX MASTER SERVICE (FOUNDATION)
// Central registry for all instruments
// NO SIGNAL | NO INDICATORS | RULE-LOCKED
// ==========================================

/**
 * INDEX / INSTRUMENT REGISTRY
 * This decides:
 * - Which symbols are allowed
 * - Which segment/page they belong to
 * - Whether options chain is supported
 * - UI intent mapping (color/symbol based, NOT text)
 */

const INDEX_REGISTRY = {
  // ==========================
  // INDEX OPTIONS
  // ==========================
  NIFTY: {
    instrumentType: "INDEX",
    category: "INDEX_OPTIONS",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
    optionChain: true,
    uiIntent: {
      BUY: "GREEN",
      SELL: "RED",
      WAIT: "YELLOW",
    },
  },

  BANKNIFTY: {
    instrumentType: "INDEX",
    category: "INDEX_OPTIONS",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
    optionChain: true,
    uiIntent: {
      BUY: "GREEN",
      SELL: "RED",
      WAIT: "YELLOW",
    },
  },

  FINNIFTY: {
    instrumentType: "INDEX",
    category: "INDEX_OPTIONS",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY"],
    optionChain: true,
    uiIntent: {
      BUY: "GREEN",
      SELL: "RED",
      WAIT: "YELLOW",
    },
  },

  MIDCPNIFTY: {
    instrumentType: "INDEX",
    category: "INDEX_OPTIONS",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY"],
    optionChain: true,
    uiIntent: {
      BUY: "GREEN",
      SELL: "RED",
      WAIT: "YELLOW",
    },
  },

  // ==========================
  // STOCK OPTIONS
  // ==========================
  RELIANCE: {
    instrumentType: "STOCK",
    category: "STOCK_OPTIONS",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
    optionChain: true,
    uiIntent: {
      BUY: "GREEN",
      SELL: "RED",
      WAIT: "YELLOW",
    },
  },

  TCS: {
    instrumentType: "STOCK",
    category: "STOCK_OPTIONS",
    segments: ["EQUITY", "OPTIONS"],
    allowedTradeTypes: ["INTRADAY", "POSITIONAL"],
    optionChain: true,
    uiIntent: {
      BUY: "GREEN",
      SELL: "RED",
      WAIT: "YELLOW",
    },
  },

  // ==========================
  // VOLATILITY INDEX (DISPLAY ONLY)
  // ==========================
  VIX: {
    instrumentType: "INDEX",
    category: "VOLATILITY",
    segments: ["DISPLAY_ONLY"],
    allowedTradeTypes: [],
    optionChain: false,
    uiIntent: {
      INFO: "BLUE",
    },
    note: "VIX is safety-only. No trading allowed.",
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
