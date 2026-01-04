// ==========================================
// TOKEN SERVICE
// OPTION SYMBOL → ANGEL TOKEN (NFO)
// ==========================================

const https = require("https");

// ===============================
// GLOBAL CACHE
// ===============================
let optionSymbolMap = {};
// {
//   "NIFTY30JAN2524500CE": {
//        token: "12345",
//        exchangeType: 2
//   }
// }

// ===============================
// LOAD SYMBOL MASTER (OPTIONS ONLY)
// ===============================
function loadOptionSymbolMaster() {
  return new Promise((resolve, reject) => {
    console.log("📥 Loading Angel OPTION Symbol Master...");

    https
      .get(
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
                  (item.instrumenttype === "OPTIDX" ||
                    item.instrumenttype === "OPTSTK")
                ) {
                  const symbol = item.symbol?.toUpperCase();
                  const token = item.token;

                  if (!symbol || !token) return;

                  optionSymbolMap[symbol] = {
                    token,
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
      )
      .on("error", reject);
  });
}

// ===============================
// GET TOKEN BY OPTION SYMBOL
// ===============================
function getOptionToken(optionSymbol) {
  if (!optionSymbol) return null;

  const key = optionSymbol.toUpperCase();

  // ✅ 1. Direct exact match (BEST)
  if (optionSymbolMap[key]) {
    return optionSymbolMap[key];
  }

  // ❌ No unsafe fallback
  // Angel symbol format must match exactly
  // If not found → token does NOT exist

  return null;
}

// ===============================
// EXPORTS
// ===============================
module.exports = {
  loadOptionSymbolMaster,
  getOptionToken,
};
