// ==========================================
// ANGEL AUTH SERVICE
// Handles Angel One Login & Token Refresh
// REAL API - NO DUMMY
// ==========================================

const axios = require("axios");
const { authenticator } = require("otplib");
const { BASE_URL, ENDPOINTS, HEADERS, TIMEOUT } = require("../../config/angel.config");

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
      return {
        success: true,
        jwtToken: data.data.jwtToken,
        refreshToken: data.data.refreshToken,
        feedToken: data.data.feedToken,
        clientCode: data.data.clientcode
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
      return {
        success: true,
        jwtToken: data.data.jwtToken,
        refreshToken: data.data.refreshToken,
        feedToken: data.data.feedToken
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
