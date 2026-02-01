// ==========================================
// ANGEL AUTH SERVICE
// Handles Angel One Login & Token Refresh
// REAL API - NO DUMMY
// ==========================================

const axios = require("axios");
const { authenticator } = require("otplib");
const path = require("path");

// 🔌 WebSocket Bridge (58-files baseline safe)
const {
  startAngelWebSocket,
  setClientCode,
  setSessionTokens
} = require("./angelWebSocket.service");

const { BASE_URL, ENDPOINTS, HEADERS, TIMEOUT } = require(
  path.join(process.cwd(), "config", "angel.config.js")
);

// ==========================================
// LOGIN WITH PASSWORD + TOTP
// ==========================================
async function loginWithPassword({ clientCode, password, totpSecret, apiKey }) {
  try {
    if (!clientCode || !password || !totpSecret || !apiKey) {
      return {
        success: false,
        error: "Missing login parameters"
      };
    }

    // Generate TOTP
    const totp = authenticator.generate(totpSecret);

    const payload = {
      clientcode: clientCode,
      password: password,
      totp: totp
    };

    const headers = {
      "Content-Type": HEADERS.CONTENT_TYPE,
      "Accept": HEADERS.ACCEPT,
      "X-UserType": HEADERS.USER_TYPE,
      "X-SourceID": HEADERS.SOURCE_ID,
      "X-ClientLocalIP": HEADERS.CLIENT_LOCAL_IP,
      "X-ClientPublicIP": HEADERS.CLIENT_PUBLIC_IP,
      "X-MACAddress": HEADERS.MAC_ADDRESS,
      "X-PrivateKey": apiKey
    };

    const url = `${BASE_URL}${ENDPOINTS.LOGIN}`;

    const response = await axios.post(url, payload, {
      headers,
      timeout: TIMEOUT.API
    });

    const data = response.data;

    if (data.status === true && data.data) {
      const jwtToken = data.data.jwtToken;
      const refreshToken = data.data.refreshToken;
      const feedToken = data.data.feedToken;
      
     const resolvedClientCode = clientCode; // TRUST ENV, NOT API RESPONSE

      if (!resolvedClientCode) {
  throw new Error("CRITICAL: ClientCode missing from ENV / login input");
}

      // ==============================
      // 🔗 WS BRIDGE (CRITICAL FIX)
      // ==============================
      setClientCode(resolvedClientCode);
      setSessionTokens(feedToken, apiKey);

      // Start Angel WebSocket
      startAngelWebSocket(feedToken, resolvedClientCode, apiKey);

      return {
        success: true,
        jwtToken,
        refreshToken,
        feedToken,
        clientCode: resolvedClientCode
      };
    }

    return {
      success: false,
      error: data.message || "Angel login failed"
    };

  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message || "Angel login error"
    };
  }
}

// ==========================================
// GENERATE NEW TOKEN USING REFRESH TOKEN
// ==========================================
async function generateToken(refreshToken, apiKey) {
  try {
    if (!refreshToken || !apiKey) {
      return {
        success: false,
        error: "Missing refresh token or API key"
      };
    }

    const payload = {
      refreshToken: refreshToken
    };

    const headers = {
      "Content-Type": HEADERS.CONTENT_TYPE,
      "Accept": HEADERS.ACCEPT,
      "X-UserType": HEADERS.USER_TYPE,
      "X-SourceID": HEADERS.SOURCE_ID,
      "X-ClientLocalIP": HEADERS.CLIENT_LOCAL_IP,
      "X-ClientPublicIP": HEADERS.CLIENT_PUBLIC_IP,
      "X-MACAddress": HEADERS.MAC_ADDRESS,
      "X-PrivateKey": apiKey
    };

    const url = `${BASE_URL}${ENDPOINTS.GENERATE_TOKEN}`;

    const response = await axios.post(url, payload, {
      headers,
      timeout: TIMEOUT.API
    });

    const data = response.data;

    if (data.status === true && data.data) {
      const jwtToken = data.data.jwtToken;
      const newRefreshToken = data.data.refreshToken;
      const feedToken = data.data.feedToken;

      // ==============================
      // 🔗 WS TOKEN REFRESH BRIDGE
      // ==============================
      setSessionTokens(feedToken, apiKey);

      return {
        success: true,
        jwtToken,
        refreshToken: newRefreshToken,
        feedToken
      };
    }

    return {
      success: false,
      error: data.message || "Token refresh failed"
    };

  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message || "Token refresh error"
    };
  }
}

module.exports = {
  loginWithPassword,
  generateToken
};
