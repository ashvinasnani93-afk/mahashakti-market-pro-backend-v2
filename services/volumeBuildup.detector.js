// ==================================================
// VOLUME BUILDUP DETECTOR (NEW)
// Smart money accumulation detection
// ==================================================

function detectVolumeBuildup(data = {}) {
  const { volumes = [], avgVolume, closes = [] } = data;

  if (volumes.length < 10 || !avgVolume) {
    return { buildupDetected: false, reason: "Insufficient data" };
  }

  const last10 = volumes.slice(-10);
  const last5 = last10.slice(-5);
  const prev3 = last10.slice(-8, -5);

  const avg5 = last5.reduce((s, v) => s + v, 0) / 5;
  const avg3 = prev3.reduce((s, v) => s + v, 0) / 3;

  const volumeIncreasing = avg5 > avg3 * 1.1;
  const aboveAvg = avg5 > avgVolume * 0.85;

  const elevated = last5.filter(v => v > avgVolume * 0.9).length >= 3;

  let accumulation = false;
  if (closes.length >= 10) {
    const last10Closes = closes.slice(-10);
    const move = ((last10Closes[9] - last10Closes[0]) / last10Closes[0]) * 100;
    if (move >= -2 && move <= 3 && volumeIncreasing) accumulation = true;
  }

  let score = 0;
  if (volumeIncreasing) score += 2;
  if (aboveAvg) score += 2;
  if (elevated) score += 2;
  if (accumulation) score += 3;

  const direction = accumulation ? "BULLISH_BUILDUP" : "NEUTRAL";

  if (score >= 7) {
    return {
      buildupDetected: true,
      confidence: "HIGH",
      score,
      direction,
      note: "Smart money accumulation detected",
    };
  }

  return {
    buildupDetected: false,
    score,
    direction,
    reason: "No strong buildup",
  };
}

module.exports = { detectVolumeBuildup };
