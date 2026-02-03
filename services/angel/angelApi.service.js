// ==========================================
// ANGEL ONE API SERVICE - PERFECT MCX FIX
// Angel One की actual master file के according
// Tested with real MCX data
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
// COMMODITY MASTER CACHE (MCX) - PERFECT FIX
// ==========================================
let COMMODITY_MASTER_LOADED = false;
const COMMODITY_TOKEN_MAP = {}; // Exact symbol (with COM) → token
const COMMODITY_NAME_TO_SYMBOL = {}; // Friendly name → exact symbol

// Common MCX commodity mappings
const COMMODITY_FRIENDLY_NAMES = {
  GOLD: "GOLDCOM",
  GOLDM: "GOLDMCOM",
  SILVER: "SILVERCOM",
  SILVERM: "SILVERMCOM",
  SILVERMIC: "SILVERMICCOM",
  CRUDE: "CRUDEOILCOM",
  CRUDEOIL: "CRUDEOILCOM",
  CRUDEOILM: "CRUDEOILMCOM",
  NATURALGAS: "NATURALGASCOM",
  NATGAS: "NATURALGASCOM",
  COPPER: "COPPERCOM",
  ZINC: "ZINCCOM",
  LEAD: "LEADCOM",
  NICKEL: "NICKELCOM",
  ALUMINIUM: "ALUMINIUMCOM"
};

// ==========================================
// LOAD STOCK MASTER FROM ANGEL
// ==========================================
async function loadStockMaster() {
  if (STOCK_MASTER_LOADED) return;

  console.log("[STOCK] Loading Angel Stock Master (NSE + BSE)...");

  return new Promise((resolve, reject) => {
    https
      .get(
        "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json",
        { timeout: 20000 },
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
                `[STOCK] ✅ Master Loaded | NSE: ${Object.keys(
                  STOCK_TOKEN_MAP.NSE
                ).length} | BSE: ${Object.keys(
                  STOCK_TOKEN_MAP.BSE
                ).length}`
              );

              resolve();
            } catch (e) {
              console.error("[STOCK] ❌ Parse Error:", e.message);
              reject(e);
            }
          });
        }
      )
      .on("error", (err) => {
        console.error("[STOCK] ❌ Download Error:", err.message);
        reject(err);
      });
  });
}

// ==========================================
// LOAD COMMODITY MASTER FROM ANGEL (MCX)
// ==========================================
async function loadCommodityMaster() {
  if (COMMODITY_MASTER_LOADED) return;

  console.log("[MCX] 📥 Loading Angel Commodity Master...");

  return new Promise((resolve, reject) => {
    https
      .get(
        "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json",
        { timeout: 20000 },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);

              json.forEach((row) => {
                if (!row.symbol || !row.token || !row.exch_seg) return;

                if (row.exch_seg === "MCX") {
                  const symbol = row.symbol.toUpperCase();
                  const name = row.name
                    ? row.name.toUpperCase()
                    : "";

                  // Store by exact symbol
                  COMMODITY_TOKEN_MAP[symbol] = row.token;

                  // Store name mapping
                  if (name) {
                    COMMODITY_NAME_TO_SYMBOL[name] = symbol;
                  }
                }
              });

              COMMODITY_MASTER_LOADED = true;

              console.log(
                `[MCX] ✅ Master Loaded | Total Symbols: ${Object.keys(
                  COMMODITY_TOKEN_MAP
                ).length}`
              );

              console.log("[MCX] 📊 Key Commodities Available:");
              const importantNames = [
                "GOLD",
                "SILVER",
                "CRUDEOIL",
                "NATURALGAS",
                "COPPER",
                "ZINC"
              ];

              importantNames.forEach((friendlyName) => {
                const exactSymbol =
                  COMMODITY_FRIENDLY_NAMES[friendlyName];

                if (
                  exactSymbol &&
                  COMMODITY_TOKEN_MAP[exactSymbol]
                ) {
                  console.log(
                    `  ✅ ${friendlyName}: ${exactSymbol} (token: ${COMMODITY_TOKEN_MAP[exactSymbol]})`
                  );
                } else {
                  const found = Object.keys(
                    COMMODITY_NAME_TO_SYMBOL
                  ).find((k) =>
                    k.includes(friendlyName)
                  );
                  if (found) {
                    const sym =
                      COMMODITY_NAME_TO_SYMBOL[found];
                    console.log(
                      `  ✅ ${friendlyName}: ${found} → ${sym} (token: ${COMMODITY_TOKEN_MAP[sym]})`
                    );
                  }
                }
              });

              resolve();
            } catch (e) {
              console.error("[MCX] ❌ Parse Error:", e.message);
              reject(e);
            }
          });
        }
      )
      .on("error", (err) => {
        console.error("[MCX] ❌ Download Error:", err.message);
        reject(err);
      });
  });
}

// ==========================================
// GET COMMODITY SYMBOL & TOKEN
// ==========================================
function getCommodityToken(inputSymbol) {
  const upperInput = inputSymbol.toUpperCase();

  console.log(`[MCX] 🔍 Looking for: ${upperInput}`);

  // STEP 1: Friendly mapping
  const friendlyMapping =
    COMMODITY_FRIENDLY_NAMES[upperInput];
  if (
    friendlyMapping &&
    COMMODITY_TOKEN_MAP[friendlyMapping]
  ) {
    console.log(
      `[MCX] ✅ Friendly mapping: ${upperInput} → ${friendlyMapping} (token: ${COMMODITY_TOKEN_MAP[friendlyMapping]})`
    );
    return {
      symbol: friendlyMapping,
      token: COMMODITY_TOKEN_MAP[friendlyMapping]
    };
  }

  // STEP 2: Exact symbol
  if (COMMODITY_TOKEN_MAP[upperInput]) {
    console.log(
      `[MCX] ✅ Exact match: ${upperInput} (token: ${COMMODITY_TOKEN_MAP[upperInput]})`
    );
    return {
      symbol: upperInput,
      token: COMMODITY_TOKEN_MAP[upperInput]
    };
  }

  // STEP 3: Name-based lookup
  if (COMMODITY_NAME_TO_SYMBOL[upperInput]) {
    const exactSymbol =
      COMMODITY_NAME_TO_SYMBOL[upperInput];
    console.log(
      `[MCX] ✅ Name lookup: ${upperInput} → ${exactSymbol} (token: ${COMMODITY_TOKEN_MAP[exactSymbol]})`
    );
    return {
      symbol: exactSymbol,
      token: COMMODITY_TOKEN_MAP[exactSymbol]
    };
  }

  // STEP 4: Add COM suffix
  if (!upperInput.endsWith("COM")) {
    const withCom = upperInput + "COM";
    if (COMMODITY_TOKEN_MAP[withCom]) {
      console.log(
        `[MCX] ✅ Added COM suffix: ${upperInput} → ${withCom} (token: ${COMMODITY_TOKEN_MAP[withCom]})`
      );
      return {
        symbol: withCom,
        token: COMMODITY_TOKEN_MAP[withCom]
      };
    }
  }

  // STEP 5: Partial match
  const partialMatch = Object.keys(
    COMMODITY_TOKEN_MAP
  ).find(
    (sym) =>
      sym.includes(upperInput) ||
      upperInput.includes(sym.replace("COM", ""))
  );

  if (partialMatch) {
    console.log(
      `[MCX] ⚠️ Partial match: ${upperInput} → ${partialMatch} (token: ${COMMODITY_TOKEN_MAP[partialMatch]})`
    );
    return {
      symbol: partialMatch,
      token: COMMODITY_TOKEN_MAP[partialMatch]
    };
  }

  console.log(`[MCX] ❌ Not found: ${upperInput}`);
  console.log(
    "[MCX] 💡 Available samples:",
    Object.keys(COMMODITY_TOKEN_MAP)
      .slice(0, 10)
      .join(", ")
  );

  return null;
}

// ==========================================
// GLOBAL SESSION BRIDGE
// ==========================================
let globalJwtToken = null;
let globalApiKey = null;
let globalClientCode = null;

function setGlobalTokens(jwtToken, apiKey, clientCode) {
  globalJwtToken = jwtToken;
  globalApiKey = apiKey;
  globalClientCode = clientCode;

  console.log("🔗 API SESSION SET");
  console.log("🔗 ClientCode:", clientCode);

  global.angelSession = global.angelSession || {};
  global.angelSession.jwtToken = jwtToken;
  global.angelSession.apiKey = apiKey;
  global.angelSession.clientCode = clientCode;
}

// ==========================================
// COMMON HEADERS
// ==========================================
function getHeaders(jwtToken = null) {
  return {
    Authorization: `Bearer ${jwtToken || globalJwtToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "106.51.71.158",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": globalApiKey
  };
}

// ==========================================
// LTP DATA
// ==========================================
async function getLtpData(exchange, tradingSymbol, symbolToken) {
  try {
    console.log(
      `[API] 📞 getLtpData: exchange=${exchange}, symbol=${tradingSymbol}, token=${symbolToken}`
    );

    // NSE/BSE
    if (
      !symbolToken &&
      (exchange === "NSE" || exchange === "BSE")
    ) {
      await loadStockMaster();
      symbolToken =
        STOCK_TOKEN_MAP[exchange]?.[
          tradingSymbol.toUpperCase()
        ];
      if (symbolToken) {
        console.log(
          `[API] ✅ Stock token found: ${symbolToken}`
        );
      }
    }

    // MCX
    if (!symbolToken && exchange === "MCX") {
      await loadCommodityMaster();
      const commodityInfo =
        getCommodityToken(tradingSymbol);
      if (commodityInfo) {
        symbolToken = commodityInfo.token;
        tradingSymbol = commodityInfo.symbol;
        console.log(
          `[API] ✅ MCX resolved: symbol=${tradingSymbol}, token=${symbolToken}`
        );
      }
    }

    if (!symbolToken) {
      console.log(
        `[API] ❌ Token not found for: ${tradingSymbol} in ${exchange}`
      );
      return {
        success: false,
        message: `Symbol token not found for ${tradingSymbol} in ${exchange}`
      };
    }

    const payload = {
      exchange,
      tradingsymbol: tradingSymbol,
      symboltoken: symbolToken
    };

    console.log(
      "[API] 🌐 Calling Angel API:",
      JSON.stringify(payload)
    );

    const response = await axios.post(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/getLtpData`,
      payload,
      {
        headers: getHeaders(),
        timeout: 15000
      }
    );

    console.log(
      "[API] 📥 Response status:",
      response.data?.status
    );

    if (response.data && response.data.status === true) {
      const ltpValue =
        response.data.data?.ltp ||
        response.data.data?.close;

      console.log("[API] ✅ LTP received:", ltpValue);

      return {
        success: true,
        data: response.data.data
      };
    } else {
      console.log(
        "[API] ❌ API returned false status:",
        response.data?.message
      );
      throw new Error(
        response.data.message || "LTP fetch failed"
      );
    }
  } catch (err) {
    console.error("[API] ❌ Error:", err.message);
    if (err.response?.data) {
      console.error(
        "[API] ❌ Response data:",
        JSON.stringify(err.response.data)
      );
    }
    return {
      success: false,
      error:
        err.response?.data?.message || err.message
    };
  }
}

// ==========================================
// RMS, ORDER BOOK, TRADE BOOK, PLACE ORDER
// ==========================================
async function getRMS() {
  try {
    const response = await axios.get(
      `${BASE_URL}/rest/secure/angelbroking/user/v1/getRMS`,
      { headers: getHeaders() }
    );
    if (response.data && response.data.status === true) {
      return { success: true, data: response.data.data };
    }
    throw new Error("RMS fetch failed");
  } catch (err) {
    console.error("❌ RMS Error:", err.message);
    return { success: false, error: err.message };
  }
}

async function getOrderBook() {
  try {
    const response = await axios.get(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/getOrderBook`,
      { headers: getHeaders() }
    );
    if (response.data && response.data.status === true) {
      return { success: true, orders: response.data.data };
    }
    throw new Error("Order book fetch failed");
  } catch (err) {
    console.error("❌ Order Book Error:", err.message);
    return { success: false, error: err.message };
  }
}

async function getTradeBook() {
  try {
    const response = await axios.get(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/getTradeBook`,
      { headers: getHeaders() }
    );
    if (response.data && response.data.status === true) {
      return { success: true, trades: response.data.data };
    }
    throw new Error("Trade book fetch failed");
  } catch (err) {
    console.error("❌ Trade Book Error:", err.message);
    return { success: false, error: err.message };
  }
}

async function placeOrder(orderParams) {
  try {
    const response = await axios.post(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/placeOrder`,
      orderParams,
      { headers: getHeaders() }
    );
    if (response.data && response.data.status === true) {
      console.log(
        "✅ Order Placed:",
        response.data.data.orderid
      );
      return {
        success: true,
        orderId: response.data.data.orderid
      };
    }
    throw new Error(
      response.data.message || "Order placement failed"
    );
  } catch (err) {
    console.error(
      "❌ Place Order Error:",
      err.response?.data || err.message
    );
    return {
      success: false,
      error:
        err.response?.data?.message || err.message,
      errorCode:
        err.response?.data?.errorcode
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
  COMMODITY_NAME_TO_SYMBOL,
  COMMODITY_FRIENDLY_NAMES
};
