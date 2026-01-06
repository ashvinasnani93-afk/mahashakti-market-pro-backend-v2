// ==================================================
// TRADE MONITOR SERVICE
// ROLE: Monitor active paper trade and suggest EXIT
// ==================================================

/**
 * monitorTrade
 * @param {object} trade
 * @param {object} market
 * @returns {object}
 *
 * trade:
 * - entryPrice
 * - signal
 * - tradeState
 *
 * market:
 * - currentPrice
 * - volume
 * - avgVolume
 * - oppositeStrongCandle (boolean)
 * - structureBroken (boolean)
 */
function monitorTrade(trade = {}, market = {}) {
  if (trade.tradeState !== "ACTIVE") {
    return { status: "NO_ACTION" };
  }

  const {
    entryPrice,
    signal,
  } = trade;

  const {
    currentPrice,
    volume,
    avgVolume,
    oppositeStrongCandle = false,
    structureBroken = false,
  } = market;

  if (!entryPrice || !currentPrice) {
    return { status: "HOLD" };
  }

  // ------------------------------
  // EXIT CONDITIONS
  // ------------------------------

  // 1️⃣ Strong opposite candle
  if (oppositeStrongCandle) {
    return { status: "EXIT" };
  }

  // 2️⃣ Structure break
  if (structureBroken) {
    return { status: "EXIT" };
  }

  // 3️⃣ Volume dry + price against trade
  const volumeWeak = avgVolume > 0 && volume < avgVolume * 0.7;

  if (
    volumeWeak &&
    (
      (signal.includes("BUY") && currentPrice < entryPrice) ||
      (signal.includes("SELL") && currentPrice > entryPrice)
    )
  ) {
    return { status: "EXIT" };
  }

  return { status: "HOLD" };
}

module.exports = {
  monitorTrade,
};
