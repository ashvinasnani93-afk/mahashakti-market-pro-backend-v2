// ==========================================
// LTP ROUTES
// Real-Time Last Traded Price
// From Angel One Feed
// ==========================================

const express = require("express");
const router = express.Router();

// ------------------------------------------
// Angel Services
// ------------------------------------------
const angelApi = require("../services/angel/angelApi.service");

// ------------------------------------------
// Angel Engine (WebSocket + API unified LTP)
// FEATURE #3 → getLtp export support
// ------------------------------------------
let getLtpFromEngine = null;
try {
  const angelEngine = require("../src.angelEngine");
  getLtpFromEngine = angelEngine.getLtp || null;
} catch (e) {
  getLtpFromEngine = null;
}

const {
  getLtpData,
  loadStockMaster,
  STOCK_TOKEN_MAP
} = angelApi;

// ------------------------------------------
// SAFE COMMODITY HOOKS (won't crash if missing)
// FEATURE #1 + #2
// ------------------------------------------
const loadCommodityMaster =
  angelApi.loadCommodityMaster || (async () => {});

const COMMODITY_TOKEN_MAP =
  angelApi.COMMODITY_TOKEN_MAP || {};

// ------------------------------------------
// FEATURE #4 → Better Symbol Type Detection
// ------------------------------------------
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

  // Default
  return "STOCK";
}

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
        timestamp: cached.timestamp
      });
    }

    // ---------------------------------------
    // FEATURE #3 → Try Angel Engine getLtp()
    // ---------------------------------------
    if (getLtpFromEngine) {
      try {
        const engineLtp = await getLtpFromEngine(upperSymbol);
        if (engineLtp) {
          global.latestLTP[upperSymbol] = {
            ltp: Number(engineLtp),
            timestamp: Date.now()
          };

          return res.json({
            status: true,
            symbol: upperSymbol,
            type: symbolType,
            ltp: Number(engineLtp),
            source: "ANGEL_ENGINE",
            timestamp: Date.now()
          });
        }
      } catch (e) {
        // Silent fallback to API
      }
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
    // FEATURE #1 + #2 + #5
    // ---------------------------------------
    if (!tokenToUse && symbolType === "COMMODITY") {
      await loadCommodityMaster();

      if (COMMODITY_TOKEN_MAP && COMMODITY_TOKEN_MAP[upperSymbol]) {
        tokenToUse = COMMODITY_TOKEN_MAP[upperSymbol];
        exchangeToUse = "MCX";
      }
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
    // 4️⃣ FINAL FALLBACK (Angel API Auto Token)
    // ---------------------------------------
    if (!tokenToUse) {
      const fallbackResult = await getLtpData(
        exchangeToUse,
        upperSymbol,
        null // let Angel API service auto-detect token
      );

      if (fallbackResult.success && fallbackResult.data) {
        const ltpValue =
          fallbackResult.data.ltp ||
          fallbackResult.data.close ||
          fallbackResult.data.last_traded_price;

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
          open: fallbackResult.data.open,
          high: fallbackResult.data.high,
          low: fallbackResult.data.low,
          close: fallbackResult.data.close,
          source: "ANGEL_API_FALLBACK",
          timestamp: Date.now()
        });
      }
    }

    // ---------------------------------------
    // Fetch LTP from Angel API (Normal Path)
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
      message: "LTP not available for symbol",
      symbol: upperSymbol,
      type: symbolType
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
