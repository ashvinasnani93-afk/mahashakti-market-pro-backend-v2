// ==========================================
// ANGEL ONE API SERVICE
// All Angel One REST API Calls
// Following Official Documentation
// ==========================================

const axios = require("axios");

const BASE_URL = "https://apiconnect.angelone.in";

// Global tokens (set by auth service)
let globalJwtToken = null;
let globalApiKey = null;

function setGlobalTokens(jwtToken, apiKey) {
  globalJwtToken = jwtToken;
  globalApiKey = apiKey;
}

// ==========================================
// COMMON HEADERS FOR ANGEL API
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
// GET LTP DATA (Multiple Symbols)
// ==========================================
async function getLtpData(exchange, tradingSymbol, symbolToken) {
  try {
    const response = await axios.post(
      `${BASE_URL}/rest/secure/angelbroking/order/v1/getLtpData`,
      {
        exchange: exchange,
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
// GET RMS (Funds & Margin)
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
// GET ORDER BOOK
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
// GET TRADE BOOK
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
// PLACE ORDER (Real Angel One Order)
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

module.exports = {
  setGlobalTokens,
  getLtpData,
  getRMS,
  getOrderBook,
  getTradeBook,
  placeOrder
};
