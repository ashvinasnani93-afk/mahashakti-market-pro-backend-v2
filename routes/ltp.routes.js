// ==========================================
// LTP ROUTES
// Real-Time Last Traded Price
// From Angel One Feed
// ==========================================

const express = require("express");
const router = express.Router();

const {
  getLtpData,
  loadStockMaster,
  loadCommodityMaster, // ✅ MCX support
  STOCK_TOKEN_MAP,
  COMMODITY_TOKEN_MAP // ✅ MCX token map
} = require("../services/angel/angelApi.service");

// ==========================================
// GET /api/ltp?symbol=
// Supports:
// INDEX → NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY
// STOCK → NSE + BSE
// COMMODITY → MCX (GOLD, SILVER, CRUDEOIL, NATURALGAS, etc)
// ==========================================

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

    // ---------------------------------------
    // Safe Global Cache Init
    // ---------------------------------------
    global.latestLTP = global.latestLTP || {};

    // ---------------------------------------
    // Try from WebSocket cache first
    // ---------------------------------------
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
    // Common Index Tokens
    // ---------------------------------------
    const indexTokenMap = {
      NIFTY: { exchange: "NSE", token: "99926000" },
      BANKNIFTY: { exchange: "NSE", token: "99926009" },
      FINNIFTY: { exchange: "NSE", token: "99926037" },
      MIDCPNIFTY: { exchange: "NSE", token: "99926074" }
    };

    let tokenToUse = null;
    let exchangeToUse = "NSE";

    // ---------------------------------------
    // 1️⃣ INDEX CHECK
    // ---------------------------------------
    if (indexTokenMap[upperSymbol]) {
      tokenToUse = indexTokenMap[upperSymbol].token;
      exchangeToUse = indexTokenMap[upperSymbol].exchange;
    }

    // ---------------------------------------
    // 2️⃣ COMMODITY CHECK (MCX)
    // ---------------------------------------
    if (!tokenToUse) {
      await loadCommodityMaster();

      if (COMMODITY_TOKEN_MAP && COMMODITY_TOKEN_MAP[upperSymbol]) {
        tokenToUse = COMMODITY_TOKEN_MAP[upperSymbol];
        exchangeToUse = "MCX";
      }
    }

    // ---------------------------------------
    // 3️⃣ STOCK CHECK (NSE → BSE fallback)
    // ---------------------------------------
    if (!tokenToUse) {
      await loadStockMaster();

      if (STOCK_TOKEN_MAP.NSE && STOCK_TOKEN_MAP.NSE[upperSymbol]) {
        tokenToUse = STOCK_TOKEN_MAP.NSE[upperSymbol];
        exchangeToUse = "NSE";
      } else if (STOCK_TOKEN_MAP.BSE && STOCK_TOKEN_MAP.BSE[upperSymbol]) {
        tokenToUse = STOCK_TOKEN_MAP.BSE[upperSymbol];
        exchangeToUse = "BSE";
      }
    }

    // ---------------------------------------
    // Fetch LTP from Angel API
    // ---------------------------------------
    if (tokenToUse) {
      const result = await getLtpData(
        exchangeToUse,
        upperSymbol,
        tokenToUse
      );

      if (result.success && result.data) {
        const ltpValue =
          result.data.ltp ||
          result.data.close ||
          result.data.last_traded_price;

        // Cache for speed
        global.latestLTP[upperSymbol] = {
          ltp: Number(ltpValue),
          timestamp: Date.now()
        };

        return res.json({
          status: true,
          symbol: upperSymbol,
          exchange: exchangeToUse,
          ltp: Number(ltpValue),
          open: result.data.open,
          high: result.data.high,
          low: result.data.low,
          close: result.data.close,
          source: "ANGEL_API",
          timestamp: Date.now()
        });
      }
    }

    // ---------------------------------------
    // Not Found
    // ---------------------------------------
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
