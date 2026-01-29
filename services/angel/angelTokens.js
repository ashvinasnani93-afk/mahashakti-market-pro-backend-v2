const axios = require("axios");

let smartApi = null;

const BASE = "https://apiconnect.angelone.in/rest/secure/angelbroking";

const HEADERS = () => {
  if (!process.env.ANGEL_API_KEY || !process.env.ANGEL_ACCESS_TOKEN) {
    throw new Error("ANGEL_API_KEY / ANGEL_ACCESS_TOKEN missing");
  }

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
};

// 🔗 INJECT SMART API INSTANCE FROM SERVER
function setSmartApi(instance) {
  smartApi = instance;
  console.log("🔗 SmartAPI linked into Angel Token Service");
}

// 📡 FETCH OPTION TOKENS USING LOCAL SYMBOL MASTER
async function fetchOptionTokens(optionSymbols = []) {
  if (!smartApi) {
    throw new Error("SmartAPI not injected into token service");
  }

  if (!optionSymbols.length) {
    throw new Error("Option symbol master empty");
  }

  console.log("📡 Fetching Angel option tokens:", optionSymbols.length);

  const res = await axios.post(
    `${BASE}/marketData/v1/optionTokens`,
    { symbols: optionSymbols },
    { headers: HEADERS() }
  );

  if (!res.data || !res.data.data) {
    throw new Error("Empty response body from Angel");
  }

  return res.data.data;
}

module.exports = {
  setSmartApi,
  fetchOptionTokens
};
