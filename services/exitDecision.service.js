// ==========================================
// EXIT DECISION SERVICE
// ROLE: Decide EXIT or HOLD (NO ENTRY SIGNAL)
// ==========================================

/**
 * decideExit
 * @param {Object} data
 * @returns {Object}
 *
 * Required:
 * - entryPrice
 * - currentPrice
 * - volume
 * - avgVolume
 * - oppositeStrongCandle (boolean)
 * - structureBroken (boolean)
 */
function decideExit(data = {}) {
  const entryPrice = Number(data.entryPrice || 0);
  const currentPrice = Number(data.currentPrice || 0);
  const volume = Number(data.volume || 0);
  const avgVolume = Number(data.avgVolume || 0);

  const oppositeStrongCandle = Boolean(data.oppositeStrongCandle);
  const structureBroken = Boolean(data.structureBroken);

  // Safety: invalid data
  if (entryPrice <= 0 || currentPrice <= 0) {
    return { status: "HOLD" };
  }

  // Rule 1: Strong opposite candle
  if (oppositeStrongCandle) {
    return { status: "EXIT" };
  }

  // Rule 2: Structure broken
  if (structureBroken) {
    return { status: "EXIT" };
  }

  // Rule 3: Volume dries up and price slips
  const volumeWeak = avgVolume > 0 && volume < avgVolume * 0.7;
  if (volumeWeak && currentPrice < entryPrice) {
    return { status: "EXIT" };
  }

  return { status: "HOLD" };
}

module.exports = {
  decideExit,
};// ==========================================
// EXIT DECISION SERVICE
// ROLE: Decide EXIT or HOLD (NO ENTRY SIGNAL)
// ==========================================

/**
 * decideExit
 * @param {Object} data
 * @returns {Object}
 *
 * Required:
 * - entryPrice
 * - currentPrice
 * - volume
 * - avgVolume
 * - oppositeStrongCandle (boolean)
 * - structureBroken (boolean)
 */
function decideExit(data = {}) {
  const entryPrice = Number(data.entryPrice || 0);
  const currentPrice = Number(data.currentPrice || 0);
  const volume = Number(data.volume || 0);
  const avgVolume = Number(data.avgVolume || 0);

  const oppositeStrongCandle = Boolean(data.oppositeStrongCandle);
  const structureBroken = Boolean(data.structureBroken);

  // Safety: invalid data
  if (entryPrice <= 0 || currentPrice <= 0) {
    return { status: "HOLD" };
  }

  // Rule 1: Strong opposite candle
  if (oppositeStrongCandle) {
    return { status: "EXIT" };
  }

  // Rule 2: Structure broken
  if (structureBroken) {
    return { status: "EXIT" };
  }

  // Rule 3: Volume dries up and price slips
  const volumeWeak = avgVolume > 0 && volume < avgVolume * 0.7;
  if (volumeWeak && currentPrice < entryPrice) {
    return { status: "EXIT" };
  }

  return { status: "HOLD" };
}

module.exports = {
  decideExit,
};
