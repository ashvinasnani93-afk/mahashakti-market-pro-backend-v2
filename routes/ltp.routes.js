// ==========================================
// LTP ROUTES
// Real-Time Last Traded Price
// From Angel One Feed
// ==========================================

const express = require("express");
const router = express.Router();
const { getLtpData, loadStockMaster, STOCK_TOKEN_MAP } = require("../services/angel/angelApi.service");
// ✅ Now imports everything needed
/**
 * GET /api/ltp?symbol=NIFTY
 * GET /api/ltp?symbol=BANKNIFTY
 * GET /api/ltp?symbol=RELIANCE
 */
router.get("/", async (req, res) => {
  try {
    const { symbol } = req.query;

    if (!symbol) {
      return res.json({
        status: false,
        message: "symbol parameter required"
      });
    }

    const upperSymbol = symbol.toUpperCase();

    // Try from cache first
    if (global.latestLTP[upperSymbol]) {
      const cached = global.latestLTP[upperSymbol];
      return res.json({
        status: true,
        symbol: upperSymbol,
        ltp: cached.ltp,
        source: "WEBSOCKET",
        timestamp: cached.timestamp
      });
    }

 // ---------------------------------------
// Fallback: Call Angel API with Stock Master
// Supports INDEX + ALL NSE/BSE STOCKS
// ---------------------------------------

// Common Index Tokens
const indexTokenMap = {
  "NIFTY": { exchange: "NSE", token: "99926000" },
  "BANKNIFTY": { exchange: "NSE", token: "99926009" },
  "FINNIFTY": { exchange: "NSE", token: "99926037" },
  "MIDCPNIFTY": { exchange: "NSE", token: "99926074" }
};

let tokenToUse = null;
let exchangeToUse = "NSE";

// Check if it's a known index
if (indexTokenMap[upperSymbol]) {
  tokenToUse = indexTokenMap[upperSymbol].token;
  exchangeToUse = indexTokenMap[upperSymbol].exchange;
} else {
  // Load stock master for regular stocks
  await loadStockMaster();

  // Try NSE first, then BSE
  if (STOCK_TOKEN_MAP.NSE[upperSymbol]) {
    tokenToUse = STOCK_TOKEN_MAP.NSE[upperSymbol];
    exchangeToUse = "NSE";
  } else if (STOCK_TOKEN_MAP.BSE[upperSymbol]) {
    tokenToUse = STOCK_TOKEN_MAP.BSE[upperSymbol];
    exchangeToUse = "BSE";
  }
}

// Fetch LTP if token found
if (tokenToUse) {
  const result = await getLtpData(
    exchangeToUse,
    upperSymbol,
    tokenToUse
  );

  if (result.success && result.data) {
    // Cache for WebSocket/API speed
    global.latestLTP = global.latestLTP || {};
    global.latestLTP[upperSymbol] = {
      ltp: result.data.ltp || result.data.close,
      timestamp: Date.now()
    };

    return res.json({
      status: true,
      symbol: upperSymbol,
      exchange: exchangeToUse,
      ltp: result.data.ltp || result.data.close,
      open: result.data.open,
      high: result.data.high,
      low: result.data.low,
      close: result.data.close,
      source: "ANGEL_API",
      timestamp: Date.now()
    });
  }
}

// If still not found
return res.json({
  status: false,
  message: "LTP not available for symbol",
  symbol: upperSymbol
});
  } catch (err) {
    console.error("❌ LTP Route Error:", err.message);
    return res.status(500).json({
      status: false,
      error: err.message
    });
  }
});

module.exports = router;
