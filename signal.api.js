// ==========================================
// SIGNAL API – FINAL (PHASE-2A + A2 + AUDIT)
// BUY / SELL / WAIT
// ANDROID READY + SAFETY + INSTITUTIONAL
// ==========================================

const { finalDecision } = require("./signalDecision.service");
const { getIndexConfig } = require("./services/indexMaster.service");

// ==========================================
// POST /signal
// ==========================================
function getSignal(req, res) {
  try {
    const body = req.body;

    // -------------------------------
    // BASIC INPUT CHECK
    // -------------------------------
    if (!body || typeof body !== "object") {
      return res.json({
        status: false,
        message: "input data missing or invalid",
      });
    }

    if (!Array.isArray(body.closes) || body.closes.length === 0) {
      return res.json({
        status: false,
        message: "closes array required",
      });
    }

    // -------------------------------
    // INSTRUMENT VALIDATION
    // -------------------------------
    const symbol = body.symbol || body.indexName;
    if (!symbol) {
      return res.json({
        status: true,
        signal: "WAIT",
        reason: "Instrument symbol missing",
      });
    }

    const indexConfig = getIndexConfig(symbol);
    if (!indexConfig) {
      return res.json({
        status: true,
        signal: "WAIT",
        reason: "Instrument not supported in app",
      });
    }

    const segment = body.segment || "EQUITY";
    const tradeType = body.tradeType || "INTRADAY";

    if (!indexConfig.segments.includes(segment)) {
      return res.json({
        status: true,
        signal: "WAIT",
        reason: `Segment ${segment} not allowed for ${symbol}`,
      });
    }

    if (
      indexConfig.allowedTradeTypes &&
      !indexConfig.allowedTradeTypes.includes(tradeType)
    ) {
      return res.json({
        status: true,
        signal: "WAIT",
        reason: `Trade type ${tradeType} not allowed for ${symbol}`,
      });
    }

    // -------------------------------
    // NORMALIZED ENGINE INPUT
    // -------------------------------
    const data = {
      symbol,
      instrumentType: indexConfig.instrumentType,
      segment,

      closes: body.closes,
      ema20: body.ema20 || [],
      ema50: body.ema50 || [],
      rsi: body.rsi,
      close: body.close,
      support: body.support,
      resistance: body.resistance,
      volume: body.volume,
      avgVolume: body.avgVolume,

      oiData: Array.isArray(body.oiData) ? body.oiData : [],
      pcrValue:
        typeof body.pcrValue === "number" ? body.pcrValue : null,

      isResultDay: body.isResultDay === true,
      isExpiryDay: body.isExpiryDay === true,
      tradeCountToday: Number(body.tradeCountToday || 0),
      tradeType,

      vix: typeof body.vix === "number" ? body.vix : null,
    };

    // -------------------------------
    // FINAL DECISION
    // -------------------------------
    const result = finalDecision(data);

    // -------------------------------
    // RISK TAG (TEXT ONLY)
    // -------------------------------
    let riskTag = "NORMAL";
    if (data.isResultDay) riskTag = "RESULT_DAY";
    else if (data.isExpiryDay) riskTag = "EXPIRY_DAY";

    // -------------------------------
    // VIX NOTE (DISPLAY ONLY)
    // -------------------------------
    let vixNote = null;
    if (typeof data.vix === "number") {
      if (data.vix >= 18) {
        vixNote =
          "High volatility – reduce position size & expect fast moves";
      } else if (data.vix <= 12) {
        vixNote =
          "Low volatility – breakout follow-through may be slow";
      } else {
        vixNote = "Normal volatility conditions";
      }
    }

    // -------------------------------
    // FINAL RESPONSE (EXTENDED – SAFE)
    // -------------------------------
    return res.json({
      status: true,

      symbol,
      instrumentType: indexConfig.instrumentType,
      exchange: indexConfig.exchange,
      segment,

      signal: result.signal,      // BUY / SELL / WAIT
      trend: result.trend || null,
      reason: result.reason,

      // 🔥 NEW – NON BREAKING CONTEXT
      mode: result.mode || "NORMAL",
      institutionalBias: result.institutionalBias || null,
      pcrBias: result.pcrBias || null,
      greeksNote: result.greeksNote || null,
      riskTag,
      vixNote,
    });
  } catch (e) {
    console.error("❌ Signal API Error:", e.message);
    return res.json({
      status: false,
      message: "signal processing error",
    });
  }
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getSignal,
};
