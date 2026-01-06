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
  // BASIC FILTERS
  // -----------------------------
  if (price < 20 || price > 300) {
    return { active: false, reason: "Price out of range" };
  }

  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;
  if (volumeRatio < 2) {
    return { active: false, reason: "No volume spike" };
  }

  if (close <= rangeHigh) {
    return { active: false, reason: "No range breakout" };
  }

  // -----------------------------
  // MOMENTUM DETECTED
  // -----------------------------
  return {
    active: true,
    state: "MOMENTUM_BUILDING",
  };
}

module.exports = {
  scanMomentum,
};
