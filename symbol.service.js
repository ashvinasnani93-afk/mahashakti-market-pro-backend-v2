// ==========================================
// OPTION SYMBOL GENERATOR – FINAL (A2.8)
// ANGEL READY | SINGLE SOURCE FORMAT
// NIFTY / BANKNIFTY
// WEEKLY + MONTHLY (EXACT ANGEL FORMAT)
// ==========================================

const MONTH_MAP = {
  0: "JAN",
  1: "FEB",
  2: "MAR",
  3: "APR",
  4: "MAY",
  5: "JUN",
  6: "JUL",
  7: "AUG",
  8: "SEP",
  9: "OCT",
  10: "NOV",
  11: "DEC",
};

// ==============================
// GET ALL SYMBOLS (ENGINE USE)
// ==============================
function getAllSymbols() {
  try {
    // Stock symbol master already loaded in server.js
    // Global fallback (safe)
    if (global.STOCK_SYMBOLS && Array.isArray(global.STOCK_SYMBOLS)) {
      return global.STOCK_SYMBOLS;
    }

    console.log("⚠️ Symbol Master not ready yet");
    return [];
  } catch (e) {
    console.error("❌ getAllSymbols failed:", e.message);
    return [];
  }
}

// ===============================
// GET LAST THURSDAY OF MONTH
// ===============================
function getLastThursday(year, month) {
  const d = new Date(year, month + 1, 0);
  while (d.getDay() !== 4) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

// ===============================
// CHECK MONTHLY EXPIRY
// ===============================
function isMonthlyExpiry(date) {
  if (!(date instanceof Date)) return false;

  const lastThursday = getLastThursday(
    date.getFullYear(),
    date.getMonth()
  );

  return (
    date.getDate() === lastThursday.getDate() &&
    date.getMonth() === lastThursday.getMonth()
  );
}

// ===============================
// NORMALIZE EXPIRY DATE (SAFE)
// ===============================
function normalizeExpiryDate(date, expiryType) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  // ✅ SAFETY FALLBACK (LOCKED)
  const finalExpiryType =
    expiryType === "MONTHLY" || expiryType === "WEEKLY"
      ? expiryType
      : "WEEKLY";

  if (finalExpiryType === "MONTHLY") {
    return getLastThursday(d.getFullYear(), d.getMonth());
  }

  // WEEKLY → nearest upcoming Thursday
  while (d.getDay() !== 4) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// ===============================
// FORMAT OPTION SYMBOL (ANGEL)
// ===============================
function formatOptionSymbol({
  index,
  expiryDate,
  strike,
  type,
  expiryType = "WEEKLY",
}) {
  // -------------------------------
  // HARD VALIDATION
  // -------------------------------
  if (!index || !strike || !type) return null;
  if (typeof strike !== "number") return null;

  const d = normalizeExpiryDate(expiryDate, expiryType);
  if (!d) return null;

  const IDX = index.toUpperCase();
  const OPT_TYPE = type.toUpperCase(); // CE / PE

 const year = d.getFullYear().toString(); // FULL YEAR REQUIRED FOR ANGEL
  const month = MONTH_MAP[d.getMonth()];
  const day = d.getDate().toString().padStart(2, "0");

  const symbol = `${IDX}${day}${month}${year}${strike}${OPT_TYPE}`;

  console.log("🧠 FINAL SYMBOL:", symbol);

  return symbol;
}

// ===============================
// EXPORT
// ===============================
module.exports = {
  formatOptionSymbol,
  isMonthlyExpiry,
  normalizeExpiryDate,
  getAllSymbols,   // ✅ ADD THIS
};
