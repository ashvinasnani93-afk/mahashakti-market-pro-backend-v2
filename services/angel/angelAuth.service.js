// ==========================================
// ANGEL AUTH SERVICE - FINAL PRODUCTION MERGED
// Documentation Compliant + Concurrency Safe
// ==========================================

const axios = require("axios");
const { authenticator } = require("otplib");
const { BASE_URL, ENDPOINTS, HEADERS, TIMEOUT } = require("../../config/angel.config");

// ==========================================
// INTERNAL STATE
// ==========================================
let loginInProgress = false;
let lastLoginTime = null;
const TOKEN_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours

// ==========================================
// BUILD ANGEL HEADERS
// ==========================================
function buildHeaders(apiKey, jwtToken = null) {
  return {
    "Authorization": jwtToken ? `Bearer ${jwtToken}` : undefined,
    "Content-Type": HEADERS.CONTENT_TYPE,
    "Accept": HEADERS.ACCEPT,
    "X-UserType": HEADERS.USER_TYPE,
    "X-SourceID": HEADERS.SOURCE_ID,
    "X-ClientLocalIP": HEADERS.CLIENT_LOCAL_IP,
    "X-ClientPublicIP": HEADERS.CLIENT_PUBLIC_IP,
    "X-MACAddress": HEADERS.MAC_ADDRESS,
    "X-PrivateKey": apiKey
  };
}

// ==========================================
// LOGIN WITH PASSWORD + TOTP
// ==========================================
async function loginWithPassword({ clientCode, password, totpSecret, apiKey }) {
  try {
    if (loginInProgress) {
      console.log("[AUTH] Login already in progress. Waiting...");
      await waitForLogin();
      return { success: true };
    }

    loginInProgress = true;

    if (!clientCode || !password || !totpSecret || !apiKey) {
      return { success: false, error: "Missing login parameters" };
    }

    console.log("[AUTH] Logging into Angel One...");

    const totp = authenticator.generate(totpSecret);

    const payload = {
      clientcode: clientCode,
      password,
      totp
    };

    const url = `${BASE_URL}${ENDPOINTS.LOGIN}`;

    const response = await axios.post(url, payload, {
      headers: buildHeaders(apiKey),
      timeout: TIMEOUT.API
    });

    const data = response.data;

    if (data.status === true && data.data) {
      const { jwtToken, refreshToken, feedToken } = data.data;

      global.angelSession = {
        jwtToken,
        refreshToken,
        feedToken,
        apiKey,
        clientCode,
        isLoggedIn: true,
        wsConnected: false
      };

      lastLoginTime = Date.now();

      console.log("[AUTH] ✅ Angel Login SUCCESS");

      return {
        success: true,
        jwtToken,
        refreshToken,
        feedToken,
        clientCode
      };
    }

    return {
      success: false,
      error: data.message || "Angel login failed"
    };

  } catch (err) {
    console.error("[AUTH] Login error:", err.message);

    return {
      success: false,
      error: err.response?.data?.message || err.message
    };

  } finally {
    loginInProgress = false;
  }
}

// ==========================================
// WAIT FOR LOGIN (Concurrency Protection)
// ==========================================
async function waitForLogin() {
  const maxWait = 30000;
  const interval = 200;
  let waited = 0;

  while (loginInProgress && waited < maxWait) {
    await new Promise(res => setTimeout(res, interval));
    waited += interval;
  }
}

// ==========================================
// ENSURE AUTHENTICATED (Auto Re-login)
// ==========================================
async function ensureAuthenticated() {
  const session = global.angelSession;

  if (!session || !session.jwtToken) {
    throw new Error("Angel session not initialized");
  }

  const tokenAge = Date.now() - (lastLoginTime || 0);

  if (tokenAge > TOKEN_EXPIRY_MS) {
    console.log("[AUTH] Token expired. Refreshing...");
    await generateToken(session.refreshToken, session.apiKey);
  }

  return session.jwtToken;
}

// ==========================================
// GENERATE NEW TOKEN USING REFRESH TOKEN
// ==========================================
async function generateToken(refreshToken, apiKey) {
  try {
    if (!refreshToken || !apiKey) {
      return { success: false, error: "Missing refresh token or API key" };
    }

    console.log("[AUTH] Refreshing JWT token...");

    const payload = { refreshToken };

    const url = `${BASE_URL}${ENDPOINTS.GENERATE_TOKEN}`;

    const response = await axios.post(url, payload, {
      headers: buildHeaders(apiKey),
      timeout: TIMEOUT.API
    });

    const data = response.data;

    if (data.status === true && data.data) {
      global.angelSession.jwtToken = data.data.jwtToken;
      global.angelSession.refreshToken = data.data.refreshToken;
      global.angelSession.feedToken = data.data.feedToken;

      lastLoginTime = Date.now();

      console.log("[AUTH] ✅ Token refreshed successfully");

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
    console.error("[AUTH] Token refresh error:", err.message);

    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  loginWithPassword,
  generateToken,
  ensureAuthenticated
};
