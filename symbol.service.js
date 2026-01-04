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

  const year = d.getFullYear().toString().slice(-2);
  const month = MONTH_MAP[d.getMonth()];
  const day = d.getDate().toString().padStart(2, "0");

  // ✅ ANGEL FINAL FORMAT
  // Example: NIFTY30JAN2524500CE
  return `${IDX}${day}${month}${year}${strike}${OPT_TYPE}`;
}

// ===============================
// EXPORT
// ===============================
module.exports = {
  formatOptionSymbol,
  isMonthlyExpiry,
  normalizeExpiryDate,
};
