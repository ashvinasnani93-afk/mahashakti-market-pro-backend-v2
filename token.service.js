// ==========================================
// TOKEN SERVICE — FINAL (T2.6)
// ANGEL SOURCE OF TRUTH
// SPOT LTP + OPTION SYMBOL → TOKEN (NFO)
// MEMORY SAFE + AUTO REFRESH
// ==========================================

const https = require("https");

// ==========================================
// GLOBAL CACHE
// ==========================================
let optionSymbolMap = {};
let lastLoadCount = 0;
let lastLoadTime = 0;

// ==========================================
// CONFIG
// ==========================================
const MASTER_URL =
  "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

// Reload every 30 minutes
const RELOAD_INTERVAL = 30 * 60 * 1000;

// ==========================================
// UTILITY: CHECK OPTION EXPIRY
// Angel format: NIFTY03FEB2625200CE
// ==========================================
function isExpiredOption(symbol) {
  try {
    if (!symbol) return true;

    const match = symbol.match(
      /(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})/
    );

    if (!match) return true;

    const day = Number(match[1]);
    const monthStr = match[2];
    const year = Number("20" + match[3]);

    const MONTH_MAP = {
      JAN: 0,
      FEB: 1,
      MAR: 2,
      APR: 3,
      MAY: 4,
      JUN: 5,
      JUL: 6,
      AUG: 7,
      SEP: 8,
      OCT: 9,
      NOV: 10,
      DEC: 11,
    };

    const expiryDate = new Date(year, MONTH_MAP[monthStr], day);
    expiryDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return expiryDate < today;
  } catch {
    return true;
  }
}

// ==========================================
// LOAD OPTION SYMBOL MASTER (NFO ONLY)
// ==========================================
function loadOptionSymbolMaster(force = false) {
  return new Promise((resolve, reject) => {
    const now = Date.now();

    if (!force && now - lastLoadTime < RELOAD_INTERVAL && lastLoadCount > 0) {
      return resolve();
    }

    console.log("📥 Loading Angel OPTION Symbol Master...");

    https
      .get(MASTER_URL, (res) => {
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

            // 🔥 MEMORY RESET
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

                // 🚫 IGNORE EXPIRED
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
            lastLoadTime = Date.now();
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

// ==========================================
// GET TOKEN BY OPTION SYMBOL
// STRICT ANGEL MATCH
// ==========================================
async function getOptionToken(optionSymbol) {
  if (!optionSymbol) return null;

  const key = optionSymbol.toUpperCase();

  // Auto-load if empty or expired cache
  if (!lastLoadCount || Date.now() - lastLoadTime > RELOAD_INTERVAL) {
    try {
      await loadOptionSymbolMaster();
    } catch (e) {
      console.log("❌ SYMBOL MASTER LOAD FAIL:", e.message);
      return null;
    }
  }

  return optionSymbolMap[key] || null;
}

// ==========================================
// GET LIVE SPOT LTP (INDEX)
// Uses Angel REST proxy or your backend route
// ==========================================
async function getSpotLTP(index) {
  return new Promise((resolve, reject) => {
    try {
      // 🔁 CHANGE THIS IF YOUR ROUTE IS DIFFERENT
      const url = `https://mahashakti-market-pro-production.up.railway.app/angel/ltp?symbol=${index}`;

      https
        .get(url, (res) => {
          let data = "";

          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);

              if (!json || !json.ltp) {
                return reject("Invalid LTP response");
              }

              resolve(Number(json.ltp));
            } catch (e) {
              reject(e);
            }
          });
        })
        .on("error", reject);
    } catch (e) {
      reject(e);
    }
  });
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  loadOptionSymbolMaster,
  getOptionToken,
  getSpotLTP,
};
