// ==========================================
// TOKEN SERVICE
// OPTION SYMBOL → ANGEL TOKEN (NFO)
// ==========================================

const https = require("https");

// ===============================
// GLOBAL CACHE
// ===============================
let optionSymbolMap = {}; 
// FORMAT:
// {
//   "NIFTY24JAN24500CE": {
//        token: "12345",
//        exchangeType: 2   // NFO
//   }
// }

// ===============================
// LOAD SYMBOL MASTER (OPTIONS ONLY)
// ===============================
function loadOptionSymbolMaster() {
  return new Promise((resolve, reject) => {
    console.log("📥 Loading Angel OPTION Symbol Master...");

    https.get(
      "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json",
      (res) => {
        let data = "";

        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);

            json.forEach((item) => {
             if (
  item.exch_seg === "NFO" &&
  item.instrumenttype === "OPTIDX"
) {
  const symbol = item.symbol?.toUpperCase();
  const token = item.token;

 

  if (!symbol || !token) return;

  optionSymbolMap[symbol] = {
    token: token,
    exchangeType: 2, // NFO
  };
} 
            });

            console.log(
              "✅ OPTION Symbols Loaded:",
              Object.keys(optionSymbolMap).length
            );

            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }
    ).on("error", reject);
  });
}

// ===============================
// GET TOKEN BY OPTION SYMBOL
// ===============================
function getOptionToken(optionSymbol) {
  if (!optionSymbol) return null;

  const key = optionSymbol.toUpperCase();

  // 1️⃣ Direct match (best case)
  if (optionSymbolMap[key]) {
    return optionSymbolMap[key];
  }

  // 2️⃣ Fallback: try smart match (Angel weekly/monthly variations)
  // Example key: NIFTY25JAN24500CE
  const index = key.startsWith("BANKNIFTY") ? "BANKNIFTY" : "NIFTY";
  const type = key.endsWith("CE") ? "CE" : "PE";

  // extract strike (24500)
  const strikeMatch = key.match(/(\d{4,5})(CE|PE)$/);
  if (!strikeMatch) return null;
  const strike = strikeMatch[1];

  // try find best match in Angel symbols
  for (const angelSymbol in optionSymbolMap) {
    if (
      angelSymbol.startsWith(index) &&
      angelSymbol.includes(strike) &&
      angelSymbol.endsWith(type)
    ) {
      return optionSymbolMap[angelSymbol];
    }
  }

  return null;
}

// ===============================
// EXPORTS
// ===============================
module.exports = {
  loadOptionSymbolMaster,
  getOptionToken,
};
