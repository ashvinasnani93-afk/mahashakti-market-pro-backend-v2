// ==================================================
// RANGE COMPRESSION SCANNER (NEW)
// Detects volatility squeeze
// ==================================================

function detectRangeCompression(data = {}) {
  const { highs = [], lows = [], closes = [] } = data;

  if (highs.length < 20 || lows.length < 20 || closes.length < 20) {
    return { compressed: false, reason: "Insufficient data" };
  }

  const h20 = highs.slice(-20);
  const l20 = lows.slice(-20);
  const c20 = closes.slice(-20);

  const ranges = h20.map((h, i) => h - l20[i]);
  const avg20 = ranges.reduce((s, r) => s + r, 0) / 20;

  const recent5 = ranges.slice(-5);
  const avg5 = recent5.reduce((s, r) => s + r, 0) / 5;

  const atrRatio = avg20 > 0 ? avg5 / avg20 : 1;
  const contracting = atrRatio < 0.7;

  const hi = Math.max(...h20.slice(-5));
  const lo = Math.min(...l20.slice(-5));
  const rangePct = ((hi - lo) / c20[c20.length - 1]) * 100;

  let score = 0;
  if (contracting) score += 3;
  if (rangePct < 2) score += 2;

  if (score >= 4) {
    return {
      compressed: true,
      confidence: score >= 6 ? "HIGH" : "MEDIUM",
      atrRatio: atrRatio.toFixed(2),
      score,
      note: "Volatility squeeze detected",
    };
  }

  return { compressed: false, score, atrRatio: atrRatio.toFixed(2) };
}

module.exports = { detectRangeCompression };
