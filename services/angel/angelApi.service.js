// ==========================================
// ANGEL ONE API SERVICE - COMMODITY FIXED
// All Angel One REST API Calls
// FULL SUPPORT: NSE + BSE + MCX
// ==========================================

const axios = require("axios");
const https = require("https");

// ==========================================
// BASE CONFIG
// ==========================================
const BASE_URL = "https://apiconnect.angelone.in";

// ==========================================
// STOCK MASTER CACHE (NSE + BSE)
// ==========================================
let STOCK_MASTER_LOADED = false;
const STOCK_TOKEN_MAP = {
  NSE: {},
  BSE: {}
};

// ==========================================
// COMMODITY MASTER CACHE (MCX) - IMPROVED
// ==========================================
let COMMODITY_MASTER_LOADED = false;
const COMMODITY_TOKEN_MAP = {};  // Exact symbol → token
const COMMODITY_NAME_MAP = {};   // Base name → token (for flexible matching)

// ==========================================
// LOAD STOCK MASTER FROM ANGEL
// ==========================================
async function loadStockMaster() {
  if (STOCK_MASTER_LOADED) return;

  console.log("[STOCK] Loading Angel Stock Master (NSE + BSE)...");

  return new Promise((resolve, reject) => {
    https.get(
      "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json",
      { timeout: 15000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);

            json.forEach((row) => {
              if (!row.symbol || !row.token || !row.exch_seg) return;

              const symbol = row.symbol.toUpperCase();

              if (row.exch_seg === "NSE") {
                STOCK_TOKEN_MAP.NSE[symbol] = row.token;
              }

              if (row.exch_seg === "BSE") {
                STOCK_TOKEN_MAP.BSE[symbol] = row.token;
              }
            });

            STOCK_MASTER_LOADED = true;

            console.log(
              `[STOCK] Master Loaded | NSE: ${Object.keys(STOCK_TOKEN_MAP.NSE).length} | BSE: ${Object.keys(STOCK_TOKEN_MAP.BSE).length}`
            );

            resolve();
          } catch (e) {
            console.error("[STOCK] Parse Error:", e.message);
            reject(e);
          }
        });
      }
    ).on("error", (err) => {
      console.error("[STOCK] Download Error:", err.message);
      reject(err);
    });
  });
}

// ==========================================
// LOAD COMMODITY MASTER FROM ANGEL (MCX) - IMPROVED
// ==========================================
async function loadCommodityMaster() {
  if (COMMODITY_MASTER_LOADED) return;

  console.log("[MCX] Loading Angel Commodity Master...");

  return new Promise((resolve, reject) => {
    https.get(
      "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json",
      { timeout: 15000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);

            json.forEach((row) => {
              if (!row.symbol || !row.token || !row.exch_seg) return;

              // MCX commodities
              if (row.exch_seg === "MCX") {
                const symbol = row.symbol.toUpperCase();
                const name = row.name ? row.name.toUpperCase() : "";

                // Store exact trading symbol
                COMMODITY_TOKEN_MAP[symbol] = row.token;

                // Store base name mapping (GOLD, SILVER, CRUDEOIL, NATURALGAS)
                if (name) {
                  COMMODITY_NAME_MAP[name] = row.token;
                }
              }
            });

            COMMODITY_MASTER_LOADED = true;

            console.log(
              `[MCX] Master Loaded | Symbols: ${Object.keys(COMMODITY_TOKEN_MAP).length}`
            );

            // Debug log common commodities
            const commonCommodities = ["GOLD", "SILVER", "CRUDE", "NATURAL", "CRUDEOIL", "NATURALGAS"];
            console.log("[MCX] Common Commodity Matches:");
            commonCommodities.forEach((name) => {
              const found = Object.keys(COMMODITY_NAME_MAP).find((k) =>
                k.includes(name)
              );
              if (found) {
                console.log(`  ${name} → ${found} (token: ${COMMODITY_NAME_MAP[found]})`);
              }
            });

            resolve();
          } catch (e) {
            console.error("[MCX] Parse Error:", e.message);
            reject(e);
          }
        });
      }
    ).on("error", (err) => {
      console.error("[MCX] Download Error:", err.message);
      reject(err);
    });
  });
}

// ==========================================
// GET COMMODITY TOKEN WITH FLEXIBLE MATCHING
// ==========================================
function getCommodityToken(symbol) {
  const upperSymbol = symbol.toUpperCase();

  // 1️⃣ Exact match (full trading symbol)
  if (COMMODITY_TOKEN_MAP[upperSymbol]) {
    return COMMODITY_TOKEN_MAP[upperSymbol];
  }

  // 2️⃣ Base name match (GOLD, SILVER, CRUDEOIL, NATURALGAS)
  const matchingName = Object.keys(COMMODITY_NAME_MAP).find((name) =>
    name.includes(upperSymbol) || upperSymbol.includes(name)
  );

  if (matchingName) {
    console.log(`[MCX] Matched ${upperSymbol} → ${matchingName}`);
    return COMMODITY_NAME_MAP[matchingName];
  }

  return null;
}

// ==========================================
// GLOBAL SESSION BRIDGE
// ==========================================
let globalJwtToken = null;
let globalApiKey = null;
let globalClientCode = null;

// ==========================================
// SESSION SETTERS (CALLED FROM AUTH SERVICE)
// ==========================================
function setGlobalTokens(jwtToken, apiKey, clientCode) {
  globalJwtToken = jwtToken;
  globalApiKey = apiKey;
  globalClientCode = clientCode;

  console.log("🔗 API SESSION SET");
  console.log("🔗 ClientCode:", clientCode);

  // Push into global angel session for WS Engine
  global.angelSession = global.angelSession || {};
  global.angelSession.jwtToken = jwtToken;
  global.angelSession.apiKey = apiKey;
  global.angelSession.clientCode = clientCode;
}

// ==========================================
// COMMON HEADERS (ANGEL SMARTAPI COMPLIANT)
// ==========================================
function getHeaders(jwtToken = null) {
  return {
    "Authorization": `Bearer ${jwtToken || globalJwtToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": globalApiKey
  };
}

// ==========================================
// LTP DATA - IMPROVED WITH MCX SUPPORT
// ==========================================
async function getLtpData(exchange, tradingSymbol, symbolToken) {
  try {
    const upperSymbol = tradingSymbol.toUpperCase();

    // ---------------------------------------
    // AUTO-LOAD TOKEN FOR NSE + BSE STOCKS
    // ---------------------------------------
    if (!symbolToken && (exchange === "NSE" || exchange === "BSE")) {
      await loadStockMaster();
      symbolToken = STOCK_TOKEN_MAP[exchange]?.[upperSymbol];
    }

    // ---------------------------------------
    // AUTO-LOAD TOKEN FOR MCX COMMODITIES
    // ---------------------------------------
    if (!symbolToken && exchange === "MCX") {
      await loadCommodityMaster();
      symbolToken = getCommodityToken(upperSymbol);
    }

    if (!symbolToken) {
      return {
        success: false,
        message: `Symbol token not found for ${upperSymbol} in ${exchange}`
      };
    }

    // ---------------------------------------
    // ANGEL LTP API CALL
    // ---------------------------------------
    const response = await axios.post(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/getLtpData`,
      {
        exchange,
        tradingsymbol: upperSymbol,
        symboltoken: symbolToken
      },
      {
        headers: getHeaders(),
        timeout: 10000
      }
    );

    if (response.data && response.data.status === true) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      throw new Error(response.data.message || "LTP fetch failed");
    }
  } catch (err) {
    console.error("❌ LTP Fetch Error:", err.response?.data || err.message);
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}

// ==========================================
// RMS (FUNDS & MARGIN)
// ==========================================
async function getRMS() {
  try {
    const response = await axios.get(
      `${BASE_URL}/rest/secure/angelbroking/user/v1/getRMS`,
      {
        headers: getHeaders()
      }
    );

    if (response.data && response.data.status === true) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      throw new Error("RMS fetch failed");
    }
  } catch (err) {
    console.error("❌ RMS Fetch Error:", err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

// ==========================================
// ORDER BOOK
// ==========================================
async function getOrderBook() {
  try {
    const response = await axios.get(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/getOrderBook`,
      {
        headers: getHeaders()
      }
    );

    if (response.data && response.data.status === true) {
      return {
        success: true,
        orders: response.data.data
      };
    } else {
      throw new Error("Order book fetch failed");
    }
  } catch (err) {
    console.error("❌ Order Book Error:", err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

// ==========================================
// TRADE BOOK
// ==========================================
async function getTradeBook() {
  try {
    const response = await axios.get(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/getTradeBook`,
      {
        headers: getHeaders()
      }
    );

    if (response.data && response.data.status === true) {
      return {
        success: true,
        trades: response.data.data
      };
    } else {
      throw new Error("Trade book fetch failed");
    }
  } catch (err) {
    console.error("❌ Trade Book Error:", err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

// ==========================================
// PLACE ORDER
// ==========================================
async function placeOrder(orderParams) {
  try {
    const response = await axios.post(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/placeOrder`,
      orderParams,
      {
        headers: getHeaders()
      }
    );

    if (response.data && response.data.status === true) {
      console.log("✅ Order Placed:", response.data.data.orderid);
      return {
        success: true,
        orderId: response.data.data.orderid
      };
    } else {
      throw new Error(response.data.message || "Order placement failed");
    }
  } catch (err) {
    console.error("❌ Place Order Error:", err.response?.data || err.message);
    return {
      success: false,
      error: err.response?.data?.message || err.message,
      errorCode: err.response?.data?.errorcode
    };
  }
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  setGlobalTokens,
  getLtpData,
  getRMS,
  getOrderBook,
  getTradeBook,
  placeOrder,
  loadStockMaster,
  loadCommodityMaster,
  getCommodityToken,
  STOCK_TOKEN_MAP,
  COMMODITY_TOKEN_MAP,
  COMMODITY_NAME_MAP
};
