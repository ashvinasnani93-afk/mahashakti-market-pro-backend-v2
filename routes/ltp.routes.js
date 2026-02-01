// ==========================================
// LTP ROUTES
// Real-Time Last Traded Price
// From Angel One Feed
// ==========================================

const express = require("express");
const router = express.Router();
const { getLtpData } = require("../services/angel/angelApi.service");

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

    // Fallback: Call Angel API
    // Need exchange and token - simplified for common symbols
    const symbolMap = {
      "NIFTY": { exchange: "NSE", token: "99926000" },
      "BANKNIFTY": { exchange: "NSE", token: "99926009" },
      "FINNIFTY": { exchange: "NSE", token: "99926037" }
    };

    if (symbolMap[upperSymbol]) {
      const result = await getLtpData(
        symbolMap[upperSymbol].exchange,
        upperSymbol,
        symbolMap[upperSymbol].token
      );

      if (result.success && result.data) {
        return res.json({
          status: true,
          symbol: upperSymbol,
          ltp: result.data.ltp || result.data.close,
          source: "API",
          timestamp: Date.now()
        });
      }
    }

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
