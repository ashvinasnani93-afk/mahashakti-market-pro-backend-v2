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

  // Strike step based on index
  const STEP = index === "BANKNIFTY" ? 100 : 50;

  // Safe wide scan (Angel validation will filter)
  const RANGE =
    index === "BANKNIFTY"
      ? { start: 30000, end: 70000 }
      : { start: 10000, end: 35000 };

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

    if (!ceSymbol && !peSymbol) continue;

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
