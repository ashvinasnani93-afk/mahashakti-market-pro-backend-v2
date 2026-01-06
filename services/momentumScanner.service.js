// ==========================================
// MOMENTUM SCANNER SERVICE
// ROLE: Detect early momentum (NO SIGNAL)
// ==========================================

/**
 * scanMomentum
 * @param {Object} data
 * @returns {Object}
 *
 * Required:
 * - price
 * - currentVolume
 * - avgVolume
 * - rangeHigh
 * - close
 */
function scanMomentum(data = {}) {
  const price = Number(data.price || 0);
  const currentVolume = Number(data.currentVolume || 0);
  const avgVolume = Number(data.avgVolume || 0);
  const rangeHigh = Number(data.rangeHigh || 0);
  const close = Number(data.close || 0);

  // -----------------------------
  // HARD SAFETY
  // -----------------------------
  if (!price || !close || !avgVolume) {
    return { active: false, reason: "Invalid data" };
  }

  // -----------------------------
  // FILTER 1: PRICE RANGE
  // -----------------------------
  if (price < 20 || price > 300) {
    return { active: false, reason: "Price out of range" };
  }

  // -----------------------------
  // FILTER 2: VOLUME SPIKE
  // -----------------------------
  const volumeRatio = currentVolume / avgVolume;
  if (volumeRatio < 2) {
    return { active: false, reason: "No volume spike" };
  }

  // -----------------------------
  // FILTER 3: RANGE BREAK
  // -----------------------------
  if (close <= rangeHigh) {
    return { active: false, reason: "No range breakout" };
  }

  // -----------------------------
  // MOMENTUM DETECTED (NO SIGNAL)
  // -----------------------------
  return {
    active: true,
    state: "MOMENTUM_BUILDING",
    volumeRatio: Number(volumeRatio.toFixed(2)),
  };
}

module.exports = {
  scanMomentum,
};
