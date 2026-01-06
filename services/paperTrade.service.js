// ==================================================
// PAPER TRADE SERVICE (COMMON – PHASE-3)
// REAL LOGIC – NO DUMMY
// Execution = Virtual | Rules = SAME AS REAL TRADE
// Applicable for: STOCKS / OPTIONS / FUTURE MODULES
// ==================================================

/**
 * createPaperTrade
 * @param {object} data
 * @returns {object}
 *
 * Required:
 * - symbol
 * - entryPrice
 * - quantity
 * - signal (BUY / SELL / STRONG BUY / STRONG SELL)
 *
 * Optional:
 * - instrumentType (STOCK / OPTION) [default: STOCK]
 * - optionType (CE / PE)            [only if OPTION]
 */
function createPaperTrade(data = {}) {
  const {
    symbol,
    entryPrice,
    quantity,
    signal,
    instrumentType = "STOCK",
    optionType = null,
  } = data;

  // ------------------------------
  // HARD SAFETY CHECK
  // ------------------------------
  if (
    !symbol ||
    typeof entryPrice !== "number" ||
    typeof quantity !== "number" ||
    !signal
  ) {
    return {
      status: "REJECTED",
      reason: "Invalid paper trade input",
    };
  }

  // OPTION VALIDATION (ONLY IF REQUIRED)
  if (instrumentType === "OPTION" && !optionType) {
    return {
      status: "REJECTED",
      reason: "Option type required for option paper trade",
    };
  }

  // ------------------------------
  // PAPER TRADE OBJECT
  // ------------------------------
  return {
    status: "PAPER_TRADE_CREATED",
    tradeMode: "PAPER",

    instrumentType,
    symbol,
    optionType,

    signal,
    entryPrice,
    quantity,

    entryTime: new Date().toISOString(),

    // Exit engine will act on this later
    tradeState: "ACTIVE",

    note: "Paper trade executed using real Mahashakti rules",
  };
}

module.exports = {
  createPaperTrade,
};
