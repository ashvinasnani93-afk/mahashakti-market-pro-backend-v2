// ==========================================
// TOKEN SERVICE (FINAL – MEMORY SAFE)
// OPTION SYMBOL → ANGEL TOKEN (NFO)
// ==========================================

const https = require("https");

// ===============================
// GLOBAL CACHE (REBUILT EVERY LOAD)
// ===============================
let optionSymbolMap = {};
let lastLoadCount = 0;

// ===============================
// UTILITY: CHECK OPTION EXPIRY
// Angel format: NIFTY30JAN2524500CE
// ===============================
function isExpiredOption(symbol) {
  try {
    if (!symbol) return true;

    const match = symbol.match(
      /(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})/
    );

    // Invalid / unexpected format → ignore safely
    if (!match) return true;

    const day = Number(match[1]);
    const monthStr = match[2];
    const year = Number("20" + match[3]);

    const MONTH_MAP = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    };

    const expiryDate = new Date(year, MONTH_MAP[monthStr], day);
    expiryDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return expiryDate < today;
  } catch {
    // Any parsing error → safest action is ignore
    return true;
  }
}

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
          if (res.statusCode !== 200) {
            return reject(
              new Error(`Angel symbol master HTTP ${res.statusCode}`)
            );
          }

          let data = "";

          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);

              // 🔥 MEMORY RESET (CRITICAL)
              optionSymbolMap = {};
              let added = 0;
              let skippedExpired = 0;

              json.forEach((item) => {
                if (
                  item.exch_seg === "NFO" &&
                  (item.instrumenttype === "OPTIDX" ||
                    item.instrumenttype === "OPTSTK")
                ) {
                  const symbol = item.symbol?.toUpperCase();
                  const token = item.token;

                  if (!symbol || !token) return;

                  // 🚫 AUTO-IGNORE EXPIRED OPTIONS
                  if (isExpiredOption(symbol)) {
                    skippedExpired++;
                    return;
                  }

                  optionSymbolMap[symbol] = {
                    token,
                    exchangeType: 2, // NFO
                  };
                  added++;
                }
              });

              console.log(
                `✅ OPTION Symbols Loaded: ${added} (expired ignored: ${skippedExpired})`
              );

              if (lastLoadCount > 0 && lastLoadCount !== added) {
                console.log(
                  `🧪 Symbol count change: ${lastLoadCount} → ${added}`
                );
              }

              lastLoadCount = added;
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

  // ✅ STRICT MATCH ONLY (RULE-LOCKED)
  return optionSymbolMap[key] || null;
}

// ===============================
// EXPORTS
// ===============================
module.exports = {
  loadOptionSymbolMaster,
  getOptionToken,
};
