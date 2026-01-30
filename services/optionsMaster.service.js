// ==========================================  
// OPTIONS MASTER SERVICE (FIXED)  
// Central controller for Options logic  
// NIFTY / BANKNIFTY / STOCK OPTIONS  
// ==========================================  
  
const https = require("https");  
  
// ==========================================  
// GLOBAL CACHE  
// ==========================================  
let optionMasterCache = [];  
let lastLoadTime = 0;  
const RELOAD_INTERVAL = 30 * 60 * 1000; // 30 minutes  
  
// ==========================================  
// LOAD OPTION MASTER FROM ANGEL  
// ==========================================  
async function loadOptionMaster() {  
  const now = Date.now();  
    
  // Return cache if fresh  
  if (optionMasterCache.length > 0 && (now - lastLoadTime) < RELOAD_INTERVAL) {  
    return optionMasterCache;  
  }  
  
  return new Promise((resolve, reject) => {  
    const url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";  
      
    console.log("📥 Loading Option Master from Angel...");  
      
    https.get(url, { timeout: 15000 }, (res) => {  
      if (res.statusCode !== 200) {  
        return reject(new Error(`HTTP ${res.statusCode}`));  
      }  
  
      let data = "";  
      res.on("data", (chunk) => (data += chunk));  
      res.on("end", () => {  
        try {  
          const json = JSON.parse(data);  
          const options = [];  
  
          json.forEach((item) => {  
            if (  
              item.exch_seg === "NFO" &&  
              (item.instrumenttype === "OPTIDX" || item.instrumenttype === "OPTSTK") &&  
              item.symbol &&  
              item.token  
            ) {  
              // Parse option details from symbol  
              const symbol = item.symbol.toUpperCase();  
              let optionType = null;  
                
              if (symbol.endsWith("CE")) {  
                optionType = "CE";  
              } else if (symbol.endsWith("PE")) {  
                optionType = "PE";  
              }  
  
              if (optionType) {  
                options.push({  
                  symbol: symbol,  
                  token: item.token,  
                  name: item.name,  
                  expiry: item.expiry,  
                  strike: item.strike,  
                  lotsize: item.lotsize,  
                  type: optionType,  
                  instrumentType: item.instrumenttype  
                });  
              }  
            }  
          });  
  
          optionMasterCache = options;  
          lastLoadTime = Date.now();  
            
          console.log(`✅ Option Master Loaded: ${options.length} symbols`);  
          resolve(options);  
        } catch (err) {  
          reject(err);  
        }  
      });  
    }).on("error", reject);  
  });  
}  
  
// ==========================================  
// GET ALL OPTION SYMBOLS (ASYNC)  
// ==========================================  
async function getAllOptionSymbols() {  
  try {  
    return await loadOptionMaster();  
  } catch (err) {  
    console.error("❌ Failed to load option symbols:", err.message);  
    return [];  
  }  
}  
  
// ==========================================  
// GET OPTIONS BY UNDERLYING  
// ==========================================  
function getOptionsByUnderlying(underlying) {  
  return optionMasterCache.filter(opt =>   
    opt.name && opt.name.toUpperCase() === underlying.toUpperCase()  
  );  
}  
  
// ==========================================  
// GET OPTIONS CONTEXT (EXISTING FUNCTION)  
// ==========================================  
function getOptionsContext(data = {}) {  
  const { symbol, spotPrice, expiry, tradeType } = data;  
  
  if (!symbol || !spotPrice || !expiry || !tradeType) {  
    return {  
      status: "WAIT",  
      reason: "Insufficient options input data",  
    };  
  }  
  
  const expiryType =  
    expiry === "WEEKLY"  
      ? "WEEKLY_EXPIRY"  
      : expiry === "MONTHLY"  
      ? "MONTHLY_EXPIRY"  
      : "UNKNOWN_EXPIRY";  
  
  const tradeContext =  
    tradeType === "INTRADAY"  
      ? "INTRADAY_OPTIONS"  
      : "POSITIONAL_OPTIONS";  
  
  return {  
    status: "READY",  
    symbol,  
    spotPrice,  
    expiryType,  
    tradeContext,  
    note: "Options master + safety context ready",  
  };  
}  
  
// ==========================================  
// EXPORT  
// ==========================================  
module.exports = {  
  getAllOptionSymbols,  // 🔥 FIXED: Now properly exported  
  getOptionsByUnderlying,  
  getOptionsContext,  
  loadOptionMaster  
};
