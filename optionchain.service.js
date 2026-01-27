// ==========================================
// OPTION CHAIN SERVICE – FINAL (A3.1)
// Angel = SINGLE SOURCE OF TRUTH
// No Fake / Manual Strikes
// ==========================================

const { formatOptionSymbol, isMonthlyExpiry } = require("./symbol.service");
const { getOptionToken } = require("./token.service");

// ==========================================  
// BUILD OPTION CHAIN (ANGEL VALIDATED)  
// Supports both INDEX and STOCK options  
// ==========================================  
function buildOptionChain({  
  index,        // NIFTY / BANKNIFTY (optional)  
  stock,        // RELIANCE / TCS (optional)  
  expiryDate,   // JS Date object  
  strikes = [], // strikes from strike.service (Angel validated)  
}) {  
  const chain = {};  
  
  // -------------------------------  
  // HARD VALIDATION  
  // -------------------------------  
  if (!(expiryDate instanceof Date) || !Array.isArray(strikes)) {  
    return chain;  
  }  
  
  if (!index && !stock) {  
    return chain;  
  }  
  
  const symbol = index || stock;  
  const expiryType = isMonthlyExpiry(expiryDate)  
    ? "MONTHLY"  
    : "WEEKLY";  
  
  strikes.forEach((strike) => {  
    if (typeof strike !== "number") return;  
  
    // -------------------------------  
    // FORMAT OPTION SYMBOLS  
    // -------------------------------  
    const ceSymbol = formatOptionSymbol({  
      index: index || null,  
      stock: stock || null,  
      expiryDate,  
      strike,  
      type: "CE",  
      expiryType,  
    });  
  
    const peSymbol = formatOptionSymbol({  
      index: index || null,  
      stock: stock || null,  
      expiryDate,  
      strike,  
      type: "PE",  
      expiryType,  
    });  
  
    // format failed → skip  
    if (!ceSymbol && !peSymbol) return;  
  
    // -------------------------------  
    // FETCH TOKENS FROM ANGEL MASTER  
    // -------------------------------  
    const ceToken = ceSymbol ? getOptionToken(ceSymbol) : null;  
    const peToken = peSymbol ? getOptionToken(peSymbol) : null;  
  
    // 🚫 HARD FILTER  
    // Angel ke paas dono nahi → strike exist hi nahi karta  
    if (!ceToken && !peToken) return;  
  
    // -------------------------------  
    // FINAL STRIKE OBJECT  
    // -------------------------------  
    chain[strike] = {  
      strike,  
  
      CE: ceToken  
        ? {  
            symbol: ceSymbol,  
            token: ceToken.token,  
            exchangeType: ceToken.exchangeType, // NFO  
          }  
        : null,  
  
      PE: peToken  
        ? {  
            symbol: peSymbol,  
            token: peToken.token,  
            exchangeType: peToken.exchangeType, // NFO  
          }  
        : null,  
    };  
  });  
  
  return chain;  
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  buildOptionChain,
};
