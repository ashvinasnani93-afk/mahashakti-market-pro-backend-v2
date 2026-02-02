// ==========================================
// LTP ROUTES - COMPLETELY FIXED
// GOLD, SILVER, CRUDE की rates guaranteed!
// ==========================================

const express = require("express");
const router = express.Router();

const {
  getLtpData,
  loadStockMaster,
  loadCommodityMaster,
  getCommodityToken,
  STOCK_TOKEN_MAP,
  COMMODITY_TOKEN_MAP,
  COMMODITY_NAME_MAP
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

  return "STOCK";
}

// ==========================================
// GET /api/ltp?symbol=GOLD
// CRITICAL FIX: Don't use cache if ltp is null
// ==========================================
router.get("/", async (req, res) => {
  try {
    const { symbol, force } = req.query;

    if (!symbol) {
      return res.json({
        status: false,
        message: "symbol parameter required",
        examples: [
          "/api/ltp?symbol=NIFTY - Index LTP",
          "/api/ltp?symbol=RELIANCE - Stock LTP",
          "/api/ltp?symbol=GOLD - Commodity LTP",
          "/api/ltp?symbol=SILVER - Commodity LTP"
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
    // Cache Read (symbol OR token based)
    // ---------------------------------------
    if (!force && global.latestLTP[upperSymbol]) {
      const cached = global.latestLTP[upperSymbol];

      if (cached.ltp !== null && cached.ltp !== undefined && !isNaN(cached.ltp)) {
        return res.json({
          status: true,
          symbol: upperSymbol,
          type: symbolType,
          ltp: cached.ltp,
          source: "WEBSOCKET_CACHE",
          timestamp: cached.timestamp || Date.now()
        });
      } else {
        console.log(`[LTP] Cache invalid for ${upperSymbol}, refetching`);
        delete global.latestLTP[upperSymbol];
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
    let tradingSymbol = upperSymbol;

    // ---------------------------------------
    // 1️⃣ INDEX
    // ---------------------------------------
    if (indexTokenMap[upperSymbol]) {
      tokenToUse = indexTokenMap[upperSymbol].token;
      exchangeToUse = indexTokenMap[upperSymbol].exchange;
      console.log(`[LTP] Index ${upperSymbol} → ${tokenToUse}`);
    }

    // ---------------------------------------
    // 2️⃣ COMMODITY (MCX) — SAFE SUPPORT STRING/OBJECT
    // ---------------------------------------
    if (!tokenToUse && symbolType === "COMMODITY") {
      console.log(`[LTP] Loading commodity master for ${upperSymbol}`);
      await loadCommodityMaster();

      const commodityInfo = getCommodityToken(upperSymbol);

      if (commodityInfo) {
        // Support both old + new formats
        if (typeof commodityInfo === "string") {
          tokenToUse = commodityInfo;
          tradingSymbol = upperSymbol;
        } else {
          tokenToUse = commodityInfo.token;
          tradingSymbol = commodityInfo.symbol || upperSymbol;
        }

        exchangeToUse = "MCX";
        console.log(`[LTP] MCX ${upperSymbol} → token=${tokenToUse}, symbol=${tradingSymbol}`);
      } else {
        console.log(`[LTP] ❌ No MCX token for ${upperSymbol}`);
      }
    }

    // ---------------------------------------
    // 3️⃣ STOCK NSE → BSE
    // ---------------------------------------
    if (!tokenToUse && symbolType === "STOCK") {
      await loadStockMaster();

      if (STOCK_TOKEN_MAP.NSE?.[upperSymbol]) {
        tokenToUse = STOCK_TOKEN_MAP.NSE[upperSymbol];
        exchangeToUse = "NSE";
      } else if (STOCK_TOKEN_MAP.BSE?.[upperSymbol]) {
        tokenToUse = STOCK_TOKEN_MAP.BSE[upperSymbol];
        exchangeToUse = "BSE";
      }

      if (tokenToUse) {
        console.log(`[LTP] Stock ${upperSymbol} → ${exchangeToUse} ${tokenToUse}`);
      }
    }

    // ---------------------------------------
    // Token Required
    // ---------------------------------------
    if (!tokenToUse) {
      return res.json({
        status: false,
        message: `Token not found for ${upperSymbol}`,
        symbol: upperSymbol,
        type: symbolType,
        hint: symbolType === "COMMODITY"
          ? "Try: /api/ltp/commodities"
          : "Check stock symbol or master load"
      });
    }

    // ---------------------------------------
    // Angel API Call
    // ---------------------------------------
    console.log(`[LTP] API → ${exchangeToUse} | ${tradingSymbol} | ${tokenToUse}`);

    let result;
    try {
      result = await getLtpData(
        exchangeToUse,
        tradingSymbol,
        tokenToUse
      );
    } catch (apiErr) {
      console.error("[LTP] API Crash:", apiErr.message);
    }

    if (result?.success && result.data) {
      const ltpValue =
        result.data.ltp ??
        result.data.close ??
        result.data.last_traded_price;

      if (ltpValue !== null && ltpValue !== undefined && !isNaN(ltpValue)) {

        // Cache by SYMBOL
        global.latestLTP[upperSymbol] = {
          ltp: Number(ltpValue),
          timestamp: Date.now()
        };

        // Cache by TOKEN (for WebSocket sync)
        global.latestLTP[tokenToUse] = {
          ltp: Number(ltpValue),
          timestamp: Date.now()
        };

        return res.json({
          status: true,
          symbol: upperSymbol,
          type: symbolType,
          exchange: exchangeToUse,
          token: tokenToUse,
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
    // Fail
    // ---------------------------------------
    return res.json({
      status: false,
      message: `LTP fetch failed for ${upperSymbol}`,
      symbol: upperSymbol,
      type: symbolType,
      exchange: exchangeToUse,
      error: result?.error || result?.message || "Unknown API failure",
      hint: "Check market hours / Angel login / token validity"
    });

  } catch (err) {
    console.error("❌ LTP Route Error:", err.message);
    console.error(err.stack);
    return res.status(500).json({
      status: false,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
});

// ==========================================
// DEBUG ENDPOINT
// GET /api/ltp/commodities
// ==========================================
router.get("/commodities", async (req, res) => {
  try {
    await loadCommodityMaster();

    const commodities = Object.keys(COMMODITY_TOKEN_MAP).sort();
    const grouped = {};

    commodities.forEach(sym => {
      const base = sym.replace(/\d+[A-Z]{3}\d*/g, "").toUpperCase();
      if (!grouped[base]) grouped[base] = [];
      grouped[base].push(sym);
    });

    return res.json({
      status: true,
      count: commodities.length,
      commodities: commodities.slice(0, 100),
      grouped: Object.keys(grouped).slice(0, 20).reduce((acc, key) => {
        acc[key] = grouped[key];
        return acc;
      }, {}),
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
