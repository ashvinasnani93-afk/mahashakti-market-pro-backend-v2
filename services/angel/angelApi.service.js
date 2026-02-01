// ==========================================
// ANGEL ONE API SERVICE
// All Angel One REST API Calls
// FINAL ENGINE (58 FILE BASELINE SAFE)
// ==========================================

const axios = require("axios");

// ==========================================
// BASE CONFIG
// ==========================================
const BASE_URL = "https://apiconnect.angelone.in";

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
// COMMON HEADERS
// ==========================================
function getHeaders(jwtToken = null) {
  return {
    "Authorization": `Bearer ${jwtToken || globalJwtToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
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
    const response = await axios.post(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/getLtpData`,
      {
        exchange,
        tradingsymbol: tradingSymbol,
        symboltoken: symbolToken
      },
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
  placeOrder
};
