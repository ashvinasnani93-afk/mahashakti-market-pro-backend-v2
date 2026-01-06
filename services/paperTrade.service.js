// ==================================================
// OPTIONS PAPER TRADE SERVICE (PHASE-3)
// REAL LOGIC – NO DUMMY
// Execution = Virtual | Rules = SAME AS REAL TRADE
// ==================================================

/**
 * createPaperTrade
 * @param {object} data
 * @returns {object}
 *
 * Required:
 * - symbol
 * - optionType (CE / PE)
 * - entryPrice
 * - quantity
 * - signal (BUY / SELL)
 */
function createPaperTrade(data = {}) {
  const {
    symbol,
    optionType,
    entryPrice,
    quantity,
    signal,
  } = data;

  // ------------------------------
  // HARD SAFETY CHECK
  // ------------------------------
  if (
    !symbol ||
    !optionType ||
    typeof entryPrice !== "number" ||
    typeof quantity !== "number" ||
    !signal
  ) {
    return {
      status: "REJECTED",
      reason: "Invalid paper trade input",
    };
  }

  // ------------------------------
  // PAPER TRADE OBJECT
  // ------------------------------
  return {
    status: "PAPER_TRADE_CREATED",
    tradeMode: "PAPER",
    symbol,
    optionType,
    signal,
    entryPrice,
    quantity,
    entryTime: new Date().toISOString(),
    note: "Paper trade executed using real rules",
  };
}

module.exports = {
  createPaperTrade,
};
