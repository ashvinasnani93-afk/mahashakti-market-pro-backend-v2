const axios = require("axios");

const BASE = "https://apiconnect.angelone.in/rest/secure/angelbroking";

let smartApi = null;

// ===============================
// LINK SMARTAPI FROM SERVER
// ===============================
function setSmartApi(apiInstance) {
  smartApi = apiInstance;
  console.log("🔗 SmartAPI linked into Angel Token Service");
}

// ===============================
// SAFE HEADER BUILDER
// ===============================
function buildHeaders() {
  if (!process.env.ANGEL_API_KEY || !process.env.ANGEL_ACCESS_TOKEN) {
    throw new Error("Angel headers missing (API KEY / ACCESS TOKEN)");
  }

  return {
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": process.env.ANGEL_API_KEY,
    Authorization: `Bearer ${process.env.ANGEL_ACCESS_TOKEN}`,
    "Content-Type": "application/json"
  };
}

// ===============================
// FETCH OPTION TOKENS (HARDENED)
// ===============================
async function fetchOptionTokens() {
  try {
    console.log("📡 Fetching Angel Option Tokens...");

    const res = await axios.get(
      `${BASE}/marketData/v1/optionTokens`,
      { headers: buildHeaders() }
    );

    const raw = res?.data?.data;

    if (!raw) {
      throw new Error("Empty response body from Angel");
    }

    // Angel sometimes sends tokens inside object
    const tokenList = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.tokens)
        ? raw.tokens
        : [];

    if (!tokenList.length) {
      throw new Error("No option tokens received from Angel");
    }

    const tokens = tokenList
      .map(t => t.token)
      .filter(Boolean);

    console.log("✅ Angel Option Tokens received:", tokens.length);

    return tokens;
  } catch (err) {
    console.error("❌ Angel Token API Error:", err.message);
    return [];
  }
}

module.exports = {
  fetchOptionTokens,
  setSmartApi
};
