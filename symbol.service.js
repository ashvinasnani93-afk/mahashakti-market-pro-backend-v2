// ==========================================
// OPTION SYMBOL GENERATOR (FINAL – ANGEL READY)
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

  // ✅ SAFETY FALLBACK (future-proof)
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
  const d = normalizeExpiryDate(expiryDate, expiryType);

  const year = d.getFullYear().toString().slice(-2);
  const month = MONTH_MAP[d.getMonth()];
  const day = d.getDate();
  const dd = day.toString().padStart(2, "0");

  // ✅ ANGEL FINAL FORMAT
  // Example: NIFTY30JAN2524500CE
  return `${index}${dd}${month}${year}${strike}${type}`;
}

// ===============================
// EXPORT
// ===============================
module.exports = {
  formatOptionSymbol,
  isMonthlyExpiry,
  normalizeExpiryDate,
};
