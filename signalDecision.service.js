// ==================================================
// SIGNAL DECISION SERVICE – FINAL CLEAN (FOUNDER LOCKED)
// MAHASHAKTI MARKET PRO
// BUY / SELL / STRONG BUY / STRONG SELL / WAIT
// ==================================================

const { applySafety } = require("./signalSafety.service");
const { getVixSafetyNote } = require("./signalVix.service");

// Optional advanced scanners (safe if missing)
let detectPreBreakout, detectVolumeBuildup, detectRangeCompression;
try {
  ({ detectPreBreakout } = require("./services/preBreakout.scanner"));
  ({ detectVolumeBuildup } = require("./services/volumeBuildup.detector"));
  ({ detectRangeCompression } = require("./services/rangeCompression.scanner"));
} catch (e) {
  detectPreBreakout = () => ({ active: false });
  detectVolumeBuildup = () => ({ active: false });
  detectRangeCompression = () => ({ active: false });
}

let evaluateMomentumContext;
try {
  ({ evaluateMomentumContext } = require("./services/momentumAdapter.service"));
} catch (e) {
  evaluateMomentumContext = () => ({ active: false });
}

// ==================================================
// UTIL: Normalize
// ==================================================
function normalizeValue(value) {
  if (typeof value === "number") return value;
  if (Array.isArray(value) && value.length) return value[value.length - 1];
  return null;
}
function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

// ==================================================
// TREND (SOFT)
// ==================================================
function checkTrendSoft(data) {
  const close = normalizeValue(data.close);
  const ema20 = normalizeValue(data.ema20);
  const ema50 = normalizeValue(data.ema50);

  if (!close || !ema20 || !ema50) {
    return { trend: "UNKNOWN", strength: "WEAK" };
  }

  const ema20Above50 = ema20 > ema50;
  const ema20Below50 = ema20 < ema50;
  const priceAbove20 = close >= ema20 * 0.997; // within 0.3%
  const priceBelow20 = close <= ema20 * 1.003;

  const emaDiff = Math.abs(ema20 - ema50) / ema50;

  if (priceAbove20 && ema20Above50) {
    return {
      trend: "UPTREND",
      strength: emaDiff > 0.008 ? "STRONG" : "MODERATE",
    };
  }

  if (priceBelow20 && ema20Below50) {
    return {
      trend: "DOWNTREND",
      strength: emaDiff > 0.008 ? "STRONG" : "MODERATE",
    };
  }

  return { trend: "SIDEWAYS", strength: "WEAK" };
}

// ==================================================
// RSI (SOFT BLOCKER)
// ==================================================
function checkRSISoft(data) {
  const rsi = normalizeValue(data.rsi);
  const trend = data.trend;

  if (typeof rsi !== "number") {
    return { allowed: true, note: "RSI missing" };
  }

  // Hard block only extremes
  if (trend === "UPTREND" && rsi >= 78)
    return { allowed: false, note: "RSI extreme overbought" };
  if (trend === "DOWNTREND" && rsi <= 22)
    return { allowed: false, note: "RSI extreme oversold" };

  // Boost zones
  if (trend === "UPTREND" && rsi >= 45 && rsi < 75)
    return { allowed: true, boost: true, note: "RSI bullish zone" };
  if (trend === "DOWNTREND" && rsi <= 55 && rsi > 25)
    return { allowed: true, boost: true, note: "RSI bearish zone" };

  return { allowed: true, note: "RSI neutral" };
}

// ==================================================
// BREAKOUT (OPTIONAL + SOFT)
// ==================================================
function checkBreakoutSoft(data) {
  const close = normalizeValue(data.close);
  const rangeHigh = normalizeValue(data.rangeHigh);
  const rangeLow = normalizeValue(data.rangeLow);
  const prevClose = normalizeValue(data.prevClose);

  if (!close) return { breakout: false, soft: false, note: "Close missing" };

  let breakout = false;
  let soft = false;
  let type = null;

  // Hard
  if (rangeHigh && close > rangeHigh) {
    breakout = true;
    type = "BULLISH_BREAKOUT";
  }
  if (rangeLow && close < rangeLow) {
    breakout = true;
    type = "BEARISH_BREAKDOWN";
  }

  // Soft (near levels or micro-move)
  if (!breakout) {
    if (rangeHigh && close >= rangeHigh * 0.998) {
      soft = true;
      type = "BULLISH_BREAKOUT";
    }
    if (rangeLow && close <= rangeLow * 1.002) {
      soft = true;
      type = "BEARISH_BREAKDOWN";
    }

    if (prevClose) {
      const changePct = Math.abs((close - prevClose) / prevClose) * 100;
      if (changePct >= 0.25) {
        soft = true;
        type = data.trend === "DOWNTREND"
          ? "BEARISH_BREAKDOWN"
          : "BULLISH_BREAKOUT";
      }
    }
  }

  return {
    breakout,
    soft,
    type,
    note: breakout ? "Hard breakout" : soft ? "Soft breakout" : "No breakout",
  };
}

// ==================================================
// VOLUME
// ==================================================
function checkVolumeSoft(data) {
  const volume = normalizeValue(data.volume);
  const avgVolume = normalizeValue(data.avgVolume);

  if (!volume || !avgVolume || avgVolume === 0) {
    return { confirmed: false, level: "UNKNOWN", note: "Volume missing" };
  }

  const ratio = volume / avgVolume;

  if (ratio >= 1.5)
    return { confirmed: true, level: "STRONG", ratio: ratio.toFixed(2) };
  if (ratio >= 1.1)
    return { confirmed: true, level: "MODERATE", ratio: ratio.toFixed(2) };

  return { confirmed: false, level: "WEAK", ratio: ratio.toFixed(2) };
}

// ==================================================
// CANDLE
// ==================================================
function checkCandleStrength(data) {
  const open = normalizeValue(data.open);
  const high = normalizeValue(data.high);
  const low = normalizeValue(data.low);
  const close = normalizeValue(data.close);
  const prevClose = normalizeValue(data.prevClose);

  if (!open || !high || !low || !close || !prevClose)
    return { strength: "UNKNOWN" };

  const body = Math.abs(close - open);
  const range = high - low;
  if (!range) return { strength: "UNKNOWN" };

  const bodyPct = (body / range) * 100;
  const movePct = Math.abs((close - prevClose) / prevClose) * 100;

  if (bodyPct > 50 && movePct > 0.3) return { strength: "STRONG" };
  if (bodyPct > 30) return { strength: "MODERATE" };
  return { strength: "WEAK" };
}

// ==================================================
// MAIN ENGINE
// ==================================================
function finalDecision(data = {}) {
  try {
    if (!data || typeof data !== "object") {
      return { signal: "WAIT", confidence: "NONE", reason: "Invalid input" };
    }

    const normalizedData = {
      symbol: data.symbol || "UNKNOWN",
      close: normalizeValue(data.close),
      open: normalizeValue(data.open),
      high: normalizeValue(data.high),
      low: normalizeValue(data.low),
      prevClose: normalizeValue(data.prevClose),
      ema20: normalizeValue(data.ema20),
      ema50: normalizeValue(data.ema50),
      rsi: normalizeValue(data.rsi),
      volume: normalizeValue(data.volume),
      avgVolume: normalizeValue(data.avgVolume),
      rangeHigh: normalizeValue(data.rangeHigh),
      rangeLow: normalizeValue(data.rangeLow),
      vix: normalizeValue(data.vix),
      closes: normalizeArray(data.closes),
      highs: normalizeArray(data.highs),
      lows: normalizeArray(data.lows),
    };

    if (!normalizedData.close || !normalizedData.ema20 || !normalizedData.ema50) {
      return {
        signal: "WAIT",
        confidence: "NONE",
        reason: "Price/EMA missing",
      };
    }

    // ===========================
    // CORE CHECKS
    // ===========================
    const trendCheck = checkTrendSoft(normalizedData);
    normalizedData.trend = trendCheck.trend;

    const rsiCheck = checkRSISoft(normalizedData);
    const breakoutCheck = checkBreakoutSoft(normalizedData);
    const volumeCheck = checkVolumeSoft(normalizedData);
    const candleCheck = checkCandleStrength(normalizedData);

    // ===========================
    // ADVANCED CONTEXT
    // ===========================
    const preBreakout = detectPreBreakout(normalizedData);
    const volumeBuildup = detectVolumeBuildup({
      volumes: normalizedData.volumes || [],
      avgVolume: normalizedData.avgVolume,
      closes: normalizedData.closes || [],
    });
    const compression = detectRangeCompression({
      highs: normalizedData.highs || [],
      lows: normalizedData.lows || [],
      closes: normalizedData.closes || [],
    });
    const momentum = evaluateMomentumContext({
      trend: normalizedData.trend,
      rsi: normalizedData.rsi,
      volume: normalizedData.volume,
      avgVolume: normalizedData.avgVolume,
      breakoutAction:
        normalizedData.trend === "DOWNTREND" ? "SELL" : "BUY",
    });

    // ===========================
    // SCORING
    // ===========================
    let bullScore = 0;
    let bearScore = 0;

    // Trend
    if (trendCheck.trend === "UPTREND")
      bullScore += trendCheck.strength === "STRONG" ? 3 : 2;
    if (trendCheck.trend === "DOWNTREND")
      bearScore += trendCheck.strength === "STRONG" ? 3 : 2;

    // RSI
    if (rsiCheck.allowed && rsiCheck.boost) {
      if (trendCheck.trend === "UPTREND") bullScore += 1;
      if (trendCheck.trend === "DOWNTREND") bearScore += 1;
    }

    // Volume
    if (volumeCheck.confirmed) {
      const pts = volumeCheck.level === "STRONG" ? 2 : 1;
      if (trendCheck.trend === "UPTREND") bullScore += pts;
      if (trendCheck.trend === "DOWNTREND") bearScore += pts;
    }

    // Breakout
    if (breakoutCheck.breakout) {
      if (breakoutCheck.type === "BULLISH_BREAKOUT") bullScore += 2;
      if (breakoutCheck.type === "BEARISH_BREAKDOWN") bearScore += 2;
    }

    // Candle
    if (candleCheck.strength === "STRONG") {
      if (trendCheck.trend === "UPTREND") bullScore += 1;
      if (trendCheck.trend === "DOWNTREND") bearScore += 1;
    }

    // Operator boosters
    if (preBreakout?.active) {
      if (trendCheck.trend === "UPTREND") bullScore += 1;
      if (trendCheck.trend === "DOWNTREND") bearScore += 1;
    }
    if (volumeBuildup?.active) {
      if (trendCheck.trend === "UPTREND") bullScore += 1;
      if (trendCheck.trend === "DOWNTREND") bearScore += 1;
    }
    if (compression?.active) {
      if (trendCheck.trend === "UPTREND") bullScore += 1;
      if (trendCheck.trend === "DOWNTREND") bearScore += 1;
    }

    // ===========================
    // DECISION
    // ===========================
    const scoreGap = Math.abs(bullScore - bearScore);

    let signal = "WAIT";
    let confidence = "LOW";
    let reason = `Bull:${bullScore} Bear:${bearScore}`;

    // STRONG BUY
    if (
      bullScore >= 6 &&
      scoreGap >= 2 &&
      momentum?.active === true &&
      breakoutCheck.type === "BULLISH_BREAKOUT"
    ) {
      signal = "STRONG_BUY";
      confidence = "VERY_HIGH";
      reason = "Trend + Volume + Breakout + Momentum aligned";
    }
    // BUY
    else if (
      bullScore >= 3 &&
      rsiCheck.allowed &&
      volumeCheck.confirmed
    ) {
      signal = "BUY";
      confidence = bullScore >= 4 ? "HIGH" : "MEDIUM";
      reason = "Trend + RSI + Volume aligned";
    }
    // STRONG SELL
    else if (
      bearScore >= 6 &&
      scoreGap >= 2 &&
      momentum?.active === true &&
      breakoutCheck.type === "BEARISH_BREAKDOWN"
    ) {
      signal = "STRONG_SELL";
      confidence = "VERY_HIGH";
      reason = "Trend + Volume + Breakdown + Momentum aligned";
    }
    // SELL
    else if (
      bearScore >= 3 &&
      rsiCheck.allowed &&
      volumeCheck.confirmed
    ) {
      signal = "SELL";
      confidence = bearScore >= 4 ? "HIGH" : "MEDIUM";
      reason = "Trend + RSI + Volume aligned";
    }

    // ===========================
    // SAFETY
    // ===========================
    const safetyContext = {
      isResultDay: data.isResultDay === true,
      isExpiryDay: data.isExpiryDay === true,
      tradeCountToday: Number(data.tradeCountToday || 0),
      tradeType: data.tradeType || "INTRADAY",
      vix: normalizedData.vix,
    };

    const safeSignal = applySafety({ signal }, safetyContext);

    if (safeSignal.signal === "WAIT" && signal !== "WAIT") {
      confidence = "BLOCKED";
      reason = "Blocked by safety rules";
    }

    // Overtrade soft warning
    if (safetyContext.tradeCountToday >= 3 && safeSignal.signal !== "WAIT") {
      confidence = "LOW";
      reason += " | Overtrade risk";
    }

    return {
      signal: safeSignal.signal,
      confidence,
      reason,
      analysis: {
        trend: trendCheck,
        rsi: rsiCheck,
        breakout: breakoutCheck,
        volume: volumeCheck,
        candle: candleCheck,
        scores: { bullish: bullScore, bearish: bearScore },
      },
      notes: {
        vix: getVixSafetyNote(normalizedData.vix),
        safety: safetyContext,
      },
      symbol: normalizedData.symbol,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("❌ finalDecision Error:", err.message);
    return {
      signal: "WAIT",
      confidence: "ERROR",
      reason: "Engine failure",
      error: err.message,
    };
  }
}

// ==================================================
// EXPORTS
// ==================================================
module.exports = {
  finalDecision,
  getFinalMarketSignal: (input) =>
    Array.isArray(input)
      ? input.map(finalDecision)
      : finalDecision(input),
};
