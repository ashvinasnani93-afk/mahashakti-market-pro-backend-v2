const axios = require("axios");

let smartApiRef = null;

// ===============================
// LINK SMART API FROM SERVER
// ===============================
function setSmartApi(apiInstance) {
  smartApiRef = apiInstance;
  console.log("🔗 SmartAPI linked into Angel Token Service");
}

// ===============================
// FETCH OPTION TOKENS
// ===============================
async function fetchOptionTokens() {
  if (!smartApiRef) {
    throw new Error("SmartAPI not linked. Call setSmartApi() first.");
  }

  const BASE = "https://apiconnect.angelone.in/rest/secure/angelbroking";

  const HEADERS = {
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": process.env.ANGEL_API_KEY,
    "Authorization": `Bearer ${process.env.ANGEL_ACCESS_TOKEN}`,
    "Content-Type": "application/json"
  };

  const res = await axios.get(
    `${BASE}/marketData/v1/optionTokens`,
    { headers: HEADERS }
  );

  if (!res.data || !res.data.data) {
    throw new Error("Invalid Angel option token response");
  }

  return res.data.data.map(t => t.token);
}

// ===============================
// EXPORT
// ===============================
module.exports = {
  setSmartApi,
  fetchOptionTokens
};
