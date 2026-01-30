const axios = require("axios");

// ❌ STOCK SYMBOL SERVICE HATA DIYA
// const { getAllSymbols } = require("../../symbol.service");

// ✅ OPTION MASTER SERVICE ADD
const { getAllOptionMaster } = require("./token.service");

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

// 📡 FETCH OPTION TOKENS USING OPTION MASTER
async function fetchOptionTokens(optionSymbols = []) {
  if (!smartApi) {
    throw new Error("SmartAPI not injected into token service");
  }

  // ✅ AUTO PULL FROM OPTION MASTER (NOT STOCK SERVICE)
  if (!optionSymbols.length) {
    console.log("📥 No symbols passed — pulling OPTION symbols from Token Master");

    const optionMaster = getAllOptionMaster();

    if (!optionMaster || !optionMaster.length) {
      throw new Error("Option master empty — token.service not loaded");
    }

    // ⚠️ Angel API limit → max 50–100 symbols per call
    optionSymbols = optionMaster
      .slice(0, 50)
      .map(row => row.symbol);

    console.log("📥 Pulled OPTION symbols from master:", optionSymbols.length);
  }

  if (!optionSymbols || !optionSymbols.length) {
    throw new Error("Option symbol list empty AFTER master pull");
  }

  console.log("📡 Fetching Angel OPTION tokens:", optionSymbols.length);

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
