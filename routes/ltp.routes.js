// ==========================================
// LTP ROUTES - COMMODITY FIXED
// Real-Time Last Traded Price
// FULL SUPPORT: INDEX + STOCK + COMMODITY
// ==========================================

const express = require("express");
const router = express.Router();

const { subscribeCommodityToken } = require("../services/angel/angelWebSocket.service");

const {
  getLtpData,
  loadStockMaster,
  loadCommodityMaster,
  getCommodityToken,
  STOCK_TOKEN_MAP,
  COMMODITY_TOKEN_MAP
} = require("../services/angel/angelApi.service");

// ==========================================
// SYMBOL TYPE DETECTION
// ==========================================
function determineSymbolType(symbol) {
  const s = symbol.toUpperCase();

  // Indices
  const indices = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"];
  if (indices.includes(s)) return "INDEX";

  // Commodities (MCX)
  const commodities = [
    "GOLD", "GOLDM", "GOLDPETAL",
    "SILVER", "SILVERM", "SILVERMICRO",
    "CRUDE", "CRUDEOIL", "CRUDEOILM",
    "NATURALGAS", "NATGAS", "NATURALG",
    "COPPER", "ZINC", "LEAD", "NICKEL", "ALUMINIUM"
  ];

  if (commodities.includes(s) || s.includes("MCX")) {
    return "COMMODITY";
  }

  // Futures hint (MCX formats like GOLD26FEB, SILVER26FEB)
  if (/\d{1,2}[A-Z]{3}/.test(s)) {
    return "COMMODITY";
  }

  // Default
  return "STOCK";
}

// ==========================================
// GET /api/ltp?symbol=GOLD
// GET /api/ltp?symbol=SILVER
// GET /api/ltp?symbol=CRUDEOIL
// GET /api/ltp?symbol=NATURALGAS
// GET /api/ltp?symbol=RELIANCE
// GET /api/ltp?symbol=NIFTY
// GET /api/ltp?symbol=GOLD26FEB (MCX FUT)
// ==========================================

router.get("/", async (req, res) => {
  try {
    const { symbol } = req.query;

    if (!symbol) {
      return res.json({
        status: false,
        message: "symbol parameter required",
        examples: [
          "/api/ltp?symbol=NIFTY - Index LTP",
          "/api/ltp?symbol=RELIANCE - Stock LTP",
          "/api/ltp?symbol=GOLD - Commodity LTP",
          "/api/ltp?symbol=SILVER - Commodity LTP",
          "/api/ltp?symbol=CRUDEOIL - Commodity LTP",
          "/api/ltp?symbol=NATURALGAS - Commodity LTP",
          "/api/ltp?symbol=GOLD26FEB - Commodity Future"
        ]
      });
    }

    const upperSymbol = symbol.toUpperCase();
    const symbolType = determineSymbolType(upperSymbol);

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
        type: symbolType,
        ltp: cached.ltp,
        source: "WEBSOCKET_CACHE",
        timestamp: cached.timestamp || Date.now()
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
    // 2️⃣ COMMODITY CHECK (MCX) - IMPROVED
    // ---------------------------------------
    if (!tokenToUse && symbolType === "COMMODITY") {
      console.log(`[LTP] Loading commodity master for ${upperSymbol}...`);
      await loadCommodityMaster();

      // Try exact / flexible token lookup
      tokenToUse = getCommodityToken(upperSymbol);

      if (tokenToUse) {
        exchangeToUse = "MCX";
        console.log(`[LTP] Found commodity token: ${tokenToUse} for ${upperSymbol}`);
      } else {
        console.log(`[LTP] No commodity token found for ${upperSymbol}`);
        console.log(
          `[LTP] Available commodities sample:`,
          Object.keys(COMMODITY_TOKEN_MAP).slice(0, 10)
        );
      }
    }

// Trigger WS subscription for live price
if (tokenToUse) {
  subscribeCommodityToken(tokenToUse);
}
    
    // ---------------------------------------
    // 3️⃣ STOCK CHECK (NSE → BSE fallback)
    // ---------------------------------------
    if (!tokenToUse && symbolType === "STOCK") {
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
          type: symbolType,
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
      message: `LTP not available for ${upperSymbol}`,
      symbol: upperSymbol,
      type: symbolType,
      exchange: exchangeToUse,
      hint: symbolType === "COMMODITY"
        ? "Try exact MCX symbol (e.g., GOLD26FEB, SILVER26FEB, CRUDEOIL26FEB)"
        : "Make sure Angel One login is successful and symbol exists"
    });
  } catch (err) {
    console.error("❌ LTP Route Error:", err.message);
    return res.status(500).json({
      status: false,
      error: err.message
    });
  }
});

// ==========================================
// DEBUG ENDPOINT - List Available Commodities
// GET /api/ltp/commodities
// ==========================================
router.get("/commodities", async (req, res) => {
  try {
    await loadCommodityMaster();

    const commodities = Object.keys(COMMODITY_TOKEN_MAP).sort();

    return res.json({
      status: true,
      count: commodities.length,
      commodities: commodities.slice(0, 50),
      note: "Use exact symbol from this list for /api/ltp?symbol=SYMBOL"
    });
  } catch (err) {
    return res.json({
      status: false,
      error: err.message
    });
  }
});

module.exports = router;
