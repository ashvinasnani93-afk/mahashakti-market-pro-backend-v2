// ==========================================
// MOMENTUM SCANNER SERVICE (OPERATOR-GRADE)
// ROLE: Detect REAL momentum (NO SIGNAL)
// MAHASHAKTI LOCKED LOGIC
// ==========================================

/**
 * scanMomentum
 * @param {Object} data
 * Required:
 * - price
 * - currentVolume
 * - avgVolume
 * - rangeHigh
 * - rangeLow
 * - open
 * - close
 * - direction ("BUY" | "SELL")
 */
function scanMomentum(data = {}) {
  const price = Number(data.price || 0);
  const currentVolume = Number(data.currentVolume || 0);
  const avgVolume = Number(data.avgVolume || 0);
  const rangeHigh = Number(data.rangeHigh || 0);
  const rangeLow = Number(data.rangeLow || 0);
  const open = Number(data.open || 0);
  const close = Number(data.close || 0);
  const direction = data.direction || "BUY";

  // -----------------------------
  // HARD SAFETY
  // -----------------------------
  if (
    !price ||
    !close ||
    !open ||
    !avgVolume ||
    (!rangeHigh && !rangeLow)
  ) {
    return { active: false, reason: "INVALID_DATA" };
  }

  // -----------------------------
  // FILTER 1: PRICE SANITY
  // -----------------------------
  if (price < 20 || price > 3000) {
    return { active: false, reason: "PRICE_OUT_OF_RANGE" };
  }

  // -----------------------------
  // FILTER 2: VOLUME SPIKE (HARD)
  // -----------------------------
  const volumeRatio = currentVolume / avgVolume;
  if (volumeRatio < 1.8) {
    return { active: false, reason: "NO_VOLUME_SPIKE" };
  }

  // -----------------------------
  // FILTER 3: CANDLE QUALITY
  // Body must be strong (not wick fake)
  // -----------------------------
  const bodySize = Math.abs(close - open);
  const candleRange = Math.max(
    Math.abs(rangeHigh - rangeLow),
    bodySize
  );

  const bodyStrength = bodySize / candleRange;
  if (bodyStrength < 0.5) {
    return { active: false, reason: "WEAK_CANDLE_BODY" };
  }

  // -----------------------------
  // FILTER 4: RANGE BREAK LOGIC
  // -----------------------------
  if (direction === "BUY") {
    if (close <= rangeHigh) {
      return { active: false, reason: "NO_BREAKOUT" };
    }
  }

  if (direction === "SELL") {
    if (close >= rangeLow) {
      return { active: false, reason: "NO_BREAKDOWN" };
    }
  }

  // -----------------------------
  // MOMENTUM CONFIRMED
  // -----------------------------
  return {
    active: true,
    state: "MOMENTUM_CONFIRMED",
    direction,
    volumeRatio: Number(volumeRatio.toFixed(2)),
    bodyStrength: Number(bodyStrength.toFixed(2)),
  };
}

module.exports = {
  scanMomentum,
};
