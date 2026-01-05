// ==========================================
// SIGNAL API – FINAL (UPDATED FOR NEW LOCKS)
// BUY / SELL / WAIT + STRONG BUY SUPPORT
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
        signal: "WAIT",
        reason: "closes array required",
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
        reason: "Instrument not supported",
      });
    }

    const segment = body.segment || "EQUITY";
    const tradeType = body.tradeType || "INTRADAY";

    // -------------------------------
    // ENGINE INPUT (NORMALIZED)
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
    // FINAL DECISION (CORE ENGINE)
    // -------------------------------
    const result = finalDecision(data);

    // -------------------------------
    // MARKET REGIME (DERIVED – SAFE)
    // -------------------------------
    let marketRegime = "SIDEWAYS";
    if (result.trend === "UPTREND" || result.trend === "DOWNTREND") {
      marketRegime = "TRENDING";
    }
    if (result.signal === "WAIT") {
      marketRegime = "NO_TRADE_ZONE";
    }

    // -------------------------------
    // SIGNAL STRENGTH TAG (NEW)
    // -------------------------------
    const strengthTag =
      result.confidence === "HIGH"
        ? "STRONG"
        : "NORMAL";

    // -------------------------------
    // FINAL RESPONSE
    // -------------------------------
    return res.json({
      status: true,

      symbol,
      segment,
      instrumentType: indexConfig.instrumentType,
      exchange: indexConfig.exchange,

      signal: result.signal,              // BUY / SELL / WAIT
      signalStrength: strengthTag,        // STRONG / NORMAL
      trend: result.trend || null,
      marketRegime,                       // TRENDING / SIDEWAYS / NO_TRADE_ZONE

      reason: result.reason,

      // CONTEXT (TEXT ONLY)
      institutionalBias: result.institutionalBias || null,
      pcrBias: result.pcrBias || null,
      greeksNote: result.greeksNote || null,
      vixNote: result.vixNote || null,
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
