// services/angel/angelTokens.js
// FIXED: Reliable NFO master load + debug

const https = require("https");

const MASTER_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

let optionSymbolMap = {};
let lastLoadTime = 0;
let loadAttempts = 0;
const MAX_ATTEMPTS = 3;

const MONTH_MAP = { JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5, JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 };

function parseExpiryDate(expiryStr) {
  if (!expiryStr) return null;
  const match = expiryStr.match(/(\d{1,2})([A-Z]{3})(\d{4}|\d{2})/i);
  if (!match) return null;

  let day = parseInt(match[1], 10);
  let month = MONTH_MAP[match[2].toUpperCase()];
  let year = parseInt(match[3], 10);
  if (year < 100) year += 2000;

  if (isNaN(day) || month === undefined || isNaN(year)) return null;
  return new Date(year, month, day);
}

async function loadOptionTokens(force = false) {
  const now = Date.now();
  if (!force && now - lastLoadTime < 1800000 && Object.keys(optionSymbolMap).length > 0) {
    return;
  }

  if (loadAttempts >= MAX_ATTEMPTS) {
    console.error("[TOKENS] Max retry attempts reached. Giving up.");
    return;
  }

  loadAttempts++;
  console.log(`[TOKENS] Loading master attempt ${loadAttempts}...`);

  return new Promise((resolve, reject) => {
    https.get(MASTER_URL, { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) {
        console.error(`[TOKENS] HTTP ${res.statusCode}`);
        reject();
        return;
      }

      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          optionSymbolMap = {};
          let added = 0, skipped = 0;

          json.forEach(item => {
            if (item.exch_seg !== "NFO") return;
            if (!["OPTIDX", "OPTSTK"].includes(item.instrumenttype)) return;

            const sym = (item.symbol || "").trim().toUpperCase();
            if (!sym || !item.token) return;

            const expDate = parseExpiryDate(item.expiry || sym);
            if (!expDate || expDate < new Date()) {
              skipped++;
              return;
            }

            optionSymbolMap[sym] = { token: item.token, exchType: 2 };
            added++;
          });

          console.log(`[TOKENS] Added ${added} option symbols | skipped expired ${skipped}`);
          lastLoadTime = now;
          loadAttempts = 0;
          resolve();
        } catch (err) {
          console.error("[TOKENS] Parse error:", err.message);
          reject();
        }
      });
    }).on("error", err => {
      console.error("[TOKENS] Fetch error:", err.message);
      reject();
    });
  }).catch(() => {
    setTimeout(() => loadOptionTokens(true), 10000);
  });
}

function getOptionToken(symbol) {
  return optionSymbolMap[(symbol || "").trim().toUpperCase()] || null;
}

// Auto start on require
loadOptionTokens(true);

module.exports = { loadOptionTokens, getOptionToken };
