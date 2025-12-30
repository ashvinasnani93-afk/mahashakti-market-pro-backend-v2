// ==========================================
// STRIKE SERVICE – FINAL (A2.9)
// ANGEL SOURCE OF TRUTH
// Extract strikes directly from
// Angel OPTION Symbol Master
// ==========================================

const { isMonthlyExpiry, formatOptionSymbol } = require("./symbol.service");
const { getOptionToken } = require("./token.service");

// ===============================
// EXTRACT STRIKE FROM ANGEL SYMBOL
// Examples:
// NIFTY30JAN2524500CE      -> 24500
// BANKNIFTY30JAN2559100PE -> 59100
// ===============================
function extractStrikeFromSymbol(symbol, index) {
  if (!symbol.startsWith(index)) return null;

  const match = symbol.match(/(\d+)(CE|PE)$/);
  return match ? Number(match[1]) : null;
}

// ===============================
// GET VALID STRIKES (ANGEL VERIFIED)
// ===============================
function getValidStrikes({
  index,       // NIFTY / BANKNIFTY
  expiryDate,  // JS Date
}) {
  const strikesSet = new Set();

  const expiryType = isMonthlyExpiry(expiryDate)
    ? "MONTHLY"
    : "WEEKLY";

  // Angel Option Symbol Master is already loaded
  // We validate ONLY symbols Angel actually knows

  // Iterate over Angel option symbols via token service cache
  // (by trying realistic formatted symbols)

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

    const ceToken = getOptionToken(ceSymbol);
    const peToken = getOptionToken(peSymbol);

    // ✅ ANGEL IS THE BOSS
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
};
