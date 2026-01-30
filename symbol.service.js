// ==========================================  
// SYMBOL MASTER SERVICE — FINAL (FIXED)  
// MAHASHAKTI MARKET PRO  
// SINGLE SOURCE OF TRUTH  
// ==========================================  
  
let symbolStore = [];  
let optionStore = {};  
  
// ==============================  
// SET SYMBOLS (SERVER USE)  
// ==============================  
function setAllSymbols(symbols) {  
  try {  
    if (!Array.isArray(symbols)) {  
      console.log("⚠️ SYMBOL SERVICE: setAllSymbols called with invalid data");  
      return;  
    }  
  
    symbolStore = symbols;  
    console.log("🧠 SYMBOL SERVICE: Stock symbols registered:", symbols.length);  
  } catch (e) {  
    console.error("❌ SYMBOL SERVICE: setAllSymbols failed:", e.message);  
  }  
}  
  
// ============================  
// SET OPTION SYMBOL MASTER  
// ============================  
function setOptionSymbolMaster(map) {  
  try {  
    if (!map || typeof map !== "object") {  
      console.log("⚠️ SYMBOL SERVICE: Option master invalid");  
      return;  
    }  
  
    optionStore = map;  
    console.log(  
      "📦 SYMBOL SERVICE: Option symbols registered:",  
      Object.keys(map).length  
    );  
  } catch (e) {  
    console.error(  
      "❌ SYMBOL SERVICE: setOptionSymbolMaster failed:",  
      e.message  
    );  
  }  
}  
  
// ==============================  
// GET SYMBOLS (ENGINE USE)  
// ==============================  
function getAllSymbols() {  
  try {  
    // PRIORITY = OPTION TOKENS  
    if (  
      optionStore &&  
      typeof optionStore === "object" &&  
      Object.keys(optionStore).length > 0  
    ) {  
      const tokens = Object.values(optionStore);  
      console.log("📤 SYMBOL SERVICE: Returning OPTION TOKENS:", tokens.length);  
      return tokens;  
    }  
  
    // FALLBACK = STOCK SYMBOLS  
    if (!Array.isArray(symbolStore) || symbolStore.length === 0) {  
      console.log("⚠️ SYMBOL SERVICE: No symbols ready yet");  
      return [];  
    }  
  
    console.log(  
      "📤 SYMBOL SERVICE: Returning STOCK SYMBOLS:",  
      symbolStore.length  
    );  
    return symbolStore;  
  } catch (e) {  
    console.error("❌ SYMBOL SERVICE: getAllSymbols failed:", e.message);  
    return [];  
  }  
}  
  
// ==========================================  
// FORMAT OPTION SYMBOL (ANGEL FORMAT)  
// ==========================================  
function formatOptionSymbol({ index, stock, expiryDate, strike, type, expiryType }) {  
  try {  
    const underlying = index || stock;  
    if (!underlying || !expiryDate || !strike || !type) {  
      return null;  
    }  
  
    // Convert date to Angel format: DDMMMYY (e.g., 03FEB26)  
    const date = new Date(expiryDate);  
    const day = String(date.getDate()).padStart(2, '0');  
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];  
    const month = monthNames[date.getMonth()];  
    const year = String(date.getFullYear()).slice(-2);  
  
    // Format: NIFTY03FEB2625200CE or BANKNIFTY03FEB2659100PE  
    const symbol = `${underlying.toUpperCase()}${day}${month}${year}${strike}${type.toUpperCase()}`;  
    return symbol;  
  } catch (err) {  
    console.error("❌ formatOptionSymbol error:", err.message);  
    return null;  
  }  
}  
  
// ==========================================  
// CHECK IF MONTHLY EXPIRY  
// ==========================================  
function isMonthlyExpiry(date) {  
  try {  
    if (!(date instanceof Date)) {  
      date = new Date(date);  
    }  
  
    // Monthly expiry is typically last Thursday of the month for Indian options  
    // For simplicity, we check if it's after 20th day of month  
    const day = date.getDate();  
    return day >= 20;  
  } catch (err) {  
    console.error("❌ isMonthlyExpiry error:", err.message);  
    return false;  
  }  
}  
  
// ==========================================  
// GET EXPIRY TYPE  
// ==========================================  
function getExpiryType(expiryDate) {  
  return isMonthlyExpiry(expiryDate) ? "MONTHLY" : "WEEKLY";  
}  
  
module.exports = {  
  setAllSymbols,  
  setOptionSymbolMaster,  
  getAllSymbols,  
  formatOptionSymbol,  // 🔥 FIXED: Now properly exported  
  isMonthlyExpiry,     // 🔥 FIXED: Now properly exported  
  getExpiryType  
};
