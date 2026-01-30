const axios = require("axios");  
  
// ✅ CORRECT PATH TO TOKEN MASTER  
const { getOptionToken } = require("../token.service");  // 🔥 FIXED: Removed one ../  
  
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
  try {  
    // If smartApi is available, we can use it for additional validation  
    if (smartApi) {  
      console.log("📡 SmartAPI available for token fetching");  
    }  
  
    // ✅ AUTO PULL FROM OPTION MASTER  
    if (!optionSymbols.length) {  
      console.log("📥 No symbols passed — pulling OPTION symbols from Token Master");  
        
      const { getAllOptionSymbols } = require("../services/optionsMaster.service");  
      const optionMaster = await getAllOptionSymbols();  
        
      if (!optionMaster || !optionMaster.length) {  
        throw new Error("Option master empty — token.service not loaded");  
      }  
  
      // Get all option tokens  
      const tokens = optionMaster.map(opt => opt.token).filter(Boolean);  
        
      console.log("📥 Pulled OPTION tokens from master:", tokens.length);  
        
      // Return proper structure for Angel Engine  
      return {  
        feedToken: process.env.ANGEL_FEED_TOKEN || process.env.ANGEL_ACCESS_TOKEN,  
        clientCode: process.env.ANGEL_CLIENT_ID,  
        tokens: tokens  
      };  
    }  
  
    console.log("📡 Fetching Angel OPTION tokens:", optionSymbols.length);  
  
    // If specific symbols provided, fetch their tokens  
    const tokens = [];  
    for (const symbol of optionSymbols) {  
      const tokenData = await getOptionToken(symbol);  
      if (tokenData && tokenData.token) {  
        tokens.push(tokenData.token);  
      }  
    }  
  
    return {  
      feedToken: process.env.ANGEL_FEED_TOKEN || process.env.ANGEL_ACCESS_TOKEN,  
      clientCode: process.env.ANGEL_CLIENT_ID,  
      tokens: tokens  
    };  
  } catch (err) {  
    console.error("❌ fetchOptionTokens error:", err.message);  
    throw err;  
  }  
}  
  
module.exports = {  
  setSmartApi,  
  fetchOptionTokens  
};
