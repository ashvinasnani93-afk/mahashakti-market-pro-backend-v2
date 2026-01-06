// ==========================================
// EXIT RULES UTILITY
// ROLE: Reusable exit conditions (NO ENTRY)
// ==========================================

/**
 * checkExitRules
 * @param {Object} data
 * @returns {Object}
 *
 * Required:
 * - entryPrice
 * - currentPrice
 * - volume
 * - avgVolume
 *
 * Optional:
 * - oppositeStrongCandle (boolean)
 * - structureBroken (boolean)
 * - signal (BUY / SELL / STRONG BUY / STRONG SELL)
 */
function checkExitRules(data = {}) {
  const {
    entryPrice,
    currentPrice,
    volume,
    avgVolume,
    oppositeStrongCandle = false,
    structureBroken = false,
    signal = "",
  } = data;

  if (!entryPrice || !currentPrice) {
    return { exit: false };
  }

  // 1️⃣ Strong opposite candle
  if (oppositeStrongCandle) {
    return { exit: true, reason: "Opposite strong candle" };
  }

  // 2️⃣ Structure break
  if (structureBroken) {
    return { exit: true, reason: "Market structure broken" };
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
    return { exit: true, reason: "Volume dried up against trade" };
  }

  return { exit: false };
}

module.exports = {
  checkExitRules,
};
