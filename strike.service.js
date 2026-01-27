// ==========================================
// STRIKE SERVICE – FINAL (A2.9.1)
// ANGEL SOURCE OF TRUTH
// Extract strikes ONLY if Angel validates
// ==========================================

const { isMonthlyExpiry, formatOptionSymbol } = require("./symbol.service");
const { getOptionToken } = require("./token.service");

// ===============================
// EXTRACT STRIKE FROM ANGEL SYMBOL
// (UTILITY – SAFE, NON-EXECUTING)
// Examples:
// NIFTY30JAN2524500CE      -> 24500
// BANKNIFTY30JAN2559100PE -> 59100
// ===============================
function extractStrikeFromSymbol(symbol, index) {
  if (!symbol || !index) return null;
  if (!symbol.startsWith(index)) return null;

  const match = symbol.match(/(\d+)(CE|PE)$/);
  return match ? Number(match[1]) : null;
}

// ===============================
// GET VALID STRIKES (ANGEL VERIFIED)
// ===============================
async function getValidStrikes({
  index,       // NIFTY / BANKNIFTY
  expiryDate,  // JS Date
}) {
  // -------------------------------
  // HARD VALIDATION
  // -------------------------------
  if (!index || !(expiryDate instanceof Date)) {
    return [];
  }

  const strikesSet = new Set();

  const expiryType = isMonthlyExpiry(expiryDate)
    ? "MONTHLY"
    : "WEEKLY";

 // ================================
// LIVE ATM RANGE (PRODUCTION SAFE)
// ================================

// Get spot price from Angel / internal cache
const spot = await getOptionToken(index); 
// NOTE: getOptionToken(index) must return LTP for index symbol

const ATM = Math.round(spot / STEP) * STEP;

// Scan ±10 strikes around ATM
const RANGE = {
  start: ATM - (STEP * 10),
  end: ATM + (STEP * 10)
};

console.log("🧠 ATM RANGE:", index, "ATM:", ATM, "RANGE:", RANGE);

  for (let strike = RANGE.start; strike <= RANGE.end; strike += STEP) {
    const ceSymbol = formatOptionSymbol({
      index,
      expiryDate,
      strike,
      type: "CE",
      expiryType,
    });

    const peSymbol = formatOptionSymbol({
      index,
      expiryDate,
      strike,
      type: "PE",
      expiryType,
    });

   if (!ceSymbol || !peSymbol) {
  console.log("⚠️ SYMBOL FORMAT FAIL:", {
    index,
    strike,
    expiryDate,
    expiryType,
    ceSymbol,
    peSymbol
  });
}

const ceToken = ceSymbol ? await getOptionToken(ceSymbol) : null;
const peToken = peSymbol ? await getOptionToken(peSymbol) : null; 
    
console.log("TEST CE:", ceSymbol, "=>", ceToken);
console.log("TEST PE:", peSymbol, "=>", peToken);

// ✅ ANGEL IS FINAL AUTHORITY
if (ceToken || peToken) {
  strikesSet.add(strike);
}
  }

  return Array.from(strikesSet).sort((a, b) => a - b);
}

// ===============================
// EXPORT
// ===============================
module.exports = {
  getValidStrikes,
  extractStrikeFromSymbol, // utility only (future safe)
};
