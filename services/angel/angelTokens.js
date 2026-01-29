const axios = require("axios");

// ==========================================
// ANGEL OPTION TOKEN FETCHER (HARDENED)
// MAHASHAKTI MARKET PRO – CARRY-2 FIX
// ==========================================

const BASE = "https://apiconnect.angelone.in/rest/secure/angelbroking";

function buildHeaders() {
  return {
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": process.env.ANGEL_API_KEY,
    "Authorization": `Bearer ${process.env.ANGEL_ACCESS_TOKEN}`,
    "Content-Type": "application/json"
  };
}

// ==========================================
// SAFE FETCH (NEVER RETURNS UNDEFINED)
// ==========================================
async function fetchOptionTokens() {
  try {
    console.log("📡 Fetching Angel Option Tokens...");

    const res = await axios.get(
      `${BASE}/marketData/v1/optionTokens`,
      { headers: buildHeaders(), timeout: 15000 }
    );

    const raw = res?.data?.data;

    // ----------------------------------
    // HARD GUARD
    // ----------------------------------
    if (!raw) {
      console.error("❌ Angel Token API: Empty response body");
      return [];
    }

    if (!Array.isArray(raw)) {
      console.error("❌ Angel Token API: Invalid format", typeof raw);
      return [];
    }

    const tokens = raw
      .map(t => t?.token)
      .filter(t => typeof t === "string" && t.length > 0);

    console.log("✅ Option Tokens Ready:", tokens.length);

    return tokens;
  } catch (err) {
    console.error("❌ fetchOptionTokens FAILED:", err.message);
    return []; // 🔥 NEVER crash engine
  }
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  fetchOptionTokens
};
