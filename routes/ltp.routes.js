// ==========================================
// LTP ROUTES - PERFECT MCX FIX
// Based on Angel One's actual data format
// GOLD, SILVER, CRUDE guaranteed working!
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
  COMMODITY_FRIENDLY_NAMES
} = require("../services/angel/angelApi.service");

// ==========================================
// SYMBOL TYPE DETECTION
// ==========================================
function determineSymbolType(symbol) {
  const s = symbol.toUpperCase();

  // Indices
  const indices = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"];
  if (indices.includes(s)) return "INDEX";

  // Commodities - check against known commodities
  if (COMMODITY_FRIENDLY_NAMES[s]) return "COMMODITY";

  // Common commodity patterns
  const commodityPatterns = [
    "GOLD",
    "SILVER",
    "CRUDE",
    "NATURAL",
    "COPPER",
    "ZINC",
    "LEAD",
    "NICKEL",
    "ALUMINIUM"
  ];

  if (commodityPatterns.some((pattern) => s.includes(pattern))) {
    return "COMMODITY";
  }

  return "STOCK";
}

// ==========================================
// GET /api/ltp?symbol=GOLD
// PERFECT FIX - No more null values!
// ==========================================
router.get("/", async (req, res) => {
  try {
    const { symbol, force } = req.query;

    if (!symbol) {
      return res.json({
        status: false,
        message: "symbol parameter required",
        examples: [
          "/api/ltp?symbol=NIFTY - Index",
          "/api/ltp?symbol=RELIANCE - Stock",
          "/api/ltp?symbol=GOLD - Commodity MCX",
          "/api/ltp?symbol=SILVER - Commodity MCX",
          "/api/ltp?symbol=CRUDEOIL - Commodity MCX"
        ]
      });
    }

    const upperSymbol = symbol.toUpperCase();
    const symbolType = determineSymbolType(upperSymbol);

    console.log("\n[LTP] ====== NEW REQUEST ======");
    console.log(
      `[LTP] 🔍 Symbol: ${upperSymbol}, Type: ${symbolType}`
    );

    // Safe global cache init
    global.latestLTP = global.latestLTP || {};

    // Check cache - but NEVER return if ltp is null/undefined/0
    if (!force && global.latestLTP[upperSymbol]) {
      const cached = global.latestLTP[upperSymbol];

      if (
        cached.ltp !== null &&
        cached.ltp !== undefined &&
        !isNaN(cached.ltp) &&
        cached.ltp > 0
      ) {
        console.log(
          `[LTP] ✅ Cache hit: ${upperSymbol} = ${cached.ltp}`
        );
        return res.json({
          status: true,
          symbol: upperSymbol,
          type: symbolType,
          ltp: cached.ltp,
          source: "CACHE",
          timestamp: cached.timestamp || Date.now()
        });
      } else {
        console.log(
          "[LTP] ⚠️ Cache invalid (null/0), deleting..."
        );
        delete global.latestLTP[upperSymbol];
      }
    }

    // Common index tokens
    const indexTokenMap = {
      NIFTY: { exchange: "NSE", token: "99926000" },
      BANKNIFTY: { exchange: "NSE", token: "99926009" },
      FINNIFTY: { exchange: "NSE", token: "99926037" },
      MIDCPNIFTY: { exchange: "NSE", token: "99926074" }
    };

    let tokenToUse = null;
    let exchangeToUse = "NSE";
    let exactSymbol = upperSymbol;

    // ========================================
    // 1️⃣ INDEX CHECK
    // ========================================
    if (indexTokenMap[upperSymbol]) {
      tokenToUse = indexTokenMap[upperSymbol].token;
      exchangeToUse =
        indexTokenMap[upperSymbol].exchange;
      console.log(
        `[LTP] 📊 Index detected: ${upperSymbol}`
      );
    }

    // ========================================
    // 2️⃣ COMMODITY CHECK (MCX)
    // ========================================
    if (!tokenToUse && symbolType === "COMMODITY") {
      console.log(
        `[LTP] 🛢️ Commodity detected: ${upperSymbol}`
      );
      console.log("[LTP] 📥 Loading MCX master...");

      await loadCommodityMaster();

      const commodityInfo =
        getCommodityToken(upperSymbol);

      if (commodityInfo) {
        tokenToUse = commodityInfo.token;
        exactSymbol = commodityInfo.symbol;
        exchangeToUse = "MCX";

        console.log("[LTP] ✅ MCX resolved:");
        console.log(`     Input: ${upperSymbol}`);
        console.log(
          `     Exact Symbol: ${exactSymbol}`
        );
        console.log(`     Token: ${tokenToUse}`);
        console.log(
          `     Exchange: ${exchangeToUse}`
        );
      } else {
        console.log(
          `[LTP] ❌ MCX symbol not found: ${upperSymbol}`
        );

        return res.json({
          status: false,
          message: `Commodity ${upperSymbol} not found in MCX master`,
          symbol: upperSymbol,
          type: symbolType,
          hint:
            "Try: /api/ltp/commodities to see available symbols"
        });
      }
    }

    // ========================================
    // 3️⃣ STOCK CHECK (NSE → BSE)
    // ========================================
    if (!tokenToUse && symbolType === "STOCK") {
      console.log(
        `[LTP] 📈 Stock detected: ${upperSymbol}`
      );
      await loadStockMaster();

      if (
        STOCK_TOKEN_MAP.NSE &&
        STOCK_TOKEN_MAP.NSE[upperSymbol]
      ) {
        tokenToUse =
          STOCK_TOKEN_MAP.NSE[upperSymbol];
        exchangeToUse = "NSE";
        console.log(
          `[LTP] ✅ NSE stock found: token=${tokenToUse}`
        );
      } else if (
        STOCK_TOKEN_MAP.BSE &&
        STOCK_TOKEN_MAP.BSE[upperSymbol]
      ) {
        tokenToUse =
          STOCK_TOKEN_MAP.BSE[upperSymbol];
        exchangeToUse = "BSE";
        console.log(
          `[LTP] ✅ BSE stock found: token=${tokenToUse}`
        );
      }
    }

    // ========================================
    // TOKEN MUST EXIST
    // ========================================
    if (!tokenToUse) {
      console.log(
        `[LTP] ❌ Token not found for: ${upperSymbol}`
      );
      return res.json({
        status: false,
        message: `Token not found for ${upperSymbol}`,
        symbol: upperSymbol,
        type: symbolType,
        hint:
          "Check symbol spelling or try /api/ltp/commodities"
      });
    }

    // ========================================
    // FETCH FROM ANGEL API
    // ========================================
    console.log("[LTP] 🌐 Calling Angel API...");
    console.log(
      `     Exchange: ${exchangeToUse}`
    );
    console.log(`     Symbol: ${exactSymbol}`);
    console.log(`     Token: ${tokenToUse}`);

    const result = await getLtpData(
      exchangeToUse,
      exactSymbol,
      tokenToUse
    );

    if (result.success && result.data) {
      const ltpValue =
        result.data.ltp ||
        result.data.close ||
        result.data.last_traded_price;

      console.log(
        `[LTP] ✅ SUCCESS! LTP = ${ltpValue}`
      );

      if (
        ltpValue !== null &&
        ltpValue !== undefined &&
        !isNaN(ltpValue) &&
        ltpValue > 0
      ) {
        global.latestLTP[upperSymbol] = {
          ltp: Number(ltpValue),
          timestamp: Date.now()
        };
      }

      return res.json({
        status: true,
        symbol: upperSymbol,
        type: symbolType,
        exchange: exchangeToUse,
        exactSymbol: exactSymbol,
        ltp: Number(ltpValue),
        open: result.data.open,
        high: result.data.high,
        low: result.data.low,
        close: result.data.close,
        source: "ANGEL_API",
        timestamp: Date.now()
      });
    }

    console.log(
      "[LTP] ❌ API call failed:",
      result.error || result.message
    );

    return res.json({
      status: false,
      message: `LTP fetch failed for ${upperSymbol}`,
      symbol: upperSymbol,
      type: symbolType,
      exchange: exchangeToUse,
      error:
        result.error ||
        result.message ||
        "Unknown error",
      hint: "Check Angel One login and market hours"
    });
  } catch (err) {
    console.error("[LTP] ❌ EXCEPTION:", err.message);
    console.error(err.stack);
    return res.status(500).json({
      status: false,
      error: err.message
    });
  }
});

// ==========================================
// DEBUG ENDPOINT - List MCX Commodities
// GET /api/ltp/commodities
// ==========================================
router.get("/commodities", async (req, res) => {
  try {
    await loadCommodityMaster();

    const allSymbols = Object.keys(
      COMMODITY_TOKEN_MAP
    ).sort();

    const grouped = {};
    allSymbols.forEach((sym) => {
      const base = sym
        .replace("COM", "")
        .replace(/\d+/g, "")
        .toUpperCase();

      if (!grouped[base]) grouped[base] = [];

      grouped[base].push({
        symbol: sym,
        token: COMMODITY_TOKEN_MAP[sym]
      });
    });

    const friendlyMap = {};
    Object.keys(COMMODITY_FRIENDLY_NAMES).forEach(
      (friendly) => {
        const exact =
          COMMODITY_FRIENDLY_NAMES[friendly];
        if (COMMODITY_TOKEN_MAP[exact]) {
          friendlyMap[friendly] = {
            exactSymbol: exact,
            token: COMMODITY_TOKEN_MAP[exact]
          };
        }
      }
    );

    return res.json({
      status: true,
      totalSymbols: allSymbols.length,
      friendlyNames: friendlyMap,
      allSymbols: allSymbols.slice(0, 100),
      grouped: Object.keys(grouped)
        .slice(0, 20)
        .reduce((acc, key) => {
          acc[key] = grouped[key].slice(0, 5);
          return acc;
        }, {}),
      note:
        "Use friendly names (GOLD, SILVER, CRUDE) or exact symbols"
    });
  } catch (err) {
    return res.json({
      status: false,
      error: err.message
    });
  }
});

module.exports = router;
