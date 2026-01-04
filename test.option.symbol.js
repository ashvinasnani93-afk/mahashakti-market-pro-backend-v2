// ==========================================
// OPTION SYMBOL GENERATOR TEST (MANUAL)
// NIFTY / BANKNIFTY – ANGEL FORMAT
// ⚠️ DO NOT USE IN PRODUCTION
// ==========================================

const {
  formatOptionSymbol,
} = require("./symbol.service");

console.log("=== OPTION SYMBOL TEST START ===");

// -------------------------------
// TEST CASES
// -------------------------------
const tests = [
  {
    index: "NIFTY",
    expiryType: "WEEKLY",
    strike: 22500,
    type: "CE",
    date: new Date("2025-01-02"),
  },
  {
    index: "NIFTY",
    expiryType: "MONTHLY",
    strike: 22600,
    type: "PE",
    date: new Date("2025-01-30"),
  },
  {
    index: "BANKNIFTY",
    expiryType: "WEEKLY",
    strike: 48200,
    type: "CE",
    date: new Date("2025-01-02"),
  },
];

// -------------------------------
// RUN TESTS
// -------------------------------
tests.forEach((t, i) => {
  const symbol = formatOptionSymbol({
    index: t.index,
    expiryDate: t.date,
    strike: t.strike,
    type: t.type,
    expiryType: t.expiryType,
  });

  console.log(`Test ${i + 1}:`, symbol);
});

console.log("=== OPTION SYMBOL TEST END ===");
