const axios = require("axios");  
  
// ✅ CORRECT PATH TO TOKEN MASTER  
const { getOptionToken } = require("../../token.service"); 
  
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
async function fetchOptionTokens() {
  if (!smartApi) {
    throw new Error("SmartAPI not linked");
  }

  const feedToken = process.env.ANGEL_FEED_TOKEN;
  const clientCode = process.env.ANGEL_CLIENT_ID;

  const accessToken = process.env.ANGEL_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error("Missing ANGEL_ACCESS_TOKEN (JWT) – login not synced");
}

  if (!feedToken || !clientCode) {
    throw new Error("Missing ANGEL_FEED_TOKEN or ANGEL_CLIENT_ID");
  }

  // 🔥 Pull from OPTION MASTER (single source of truth)
  const tokenService = require("../../token.service");
  const optionMaster = tokenService.getAllOptionMaster();

  if (!Array.isArray(optionMaster) || optionMaster.length === 0) {
    throw new Error("Option master empty — cannot subscribe WS");
  }

  const tokens = optionMaster.map(o => String(o.token));

 console.log("📦 Angel Token Bundle Ready:", {
  feedToken: feedToken.slice(0, 6) + "*****",
  clientCode,
  tokens: tokens.length
});

// 🔐 SYNC INTO PROCESS ENV FOR WEBSOCKET
process.env.ANGEL_FEED_TOKEN = feedToken;
process.env.ANGEL_CLIENT_ID = clientCode;
process.env.ANGEL_ACCESS_TOKEN = accessToken;

console.log("🔐 ENV SYNC CONFIRM:", {
  FEED: !!process.env.ANGEL_FEED_TOKEN,
  CLIENT: process.env.ANGEL_CLIENT_ID,
  JWT: process.env.ANGEL_ACCESS_TOKEN?.slice(0, 12) + "****"
});

return {
  feedToken, // ✅ ONLY FEED TOKEN — NO JWT FALLBACK
  clientCode,
  tokens
};
}
  
module.exports = {  
  setSmartApi,  
  fetchOptionTokens  
};
