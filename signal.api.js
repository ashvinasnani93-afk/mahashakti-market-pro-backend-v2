// ==========================================
// SIGNAL API – FINAL (FULLY WIRED)
// BUY / SELL / STRONG BUY / STRONG SELL / WAIT
// ==========================================

const { finalDecision } = require("./signalDecision.service");
const { getIndexConfig } = require("./services/indexMaster.service");

// 🔒 NEW LOCKED MODULES (INPUT ONLY)
const { getMarketBreadth } = require("./services/marketBreadth.service");
const { getMarketRegime } = require("./services/marketRegime.service");
const { analyzeMarketStructure } = require("./services/marketStructure.service");
const { analyzePriceAction } = require("./services/priceAction.service");
const { validateVolume } = require("./services/volumeValidation.service");
const { getStrongBuyContext } = require("./services/strongBuy.engine");

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
        signal: "WAIT",
        reason: "Invalid input",
      });
    }

    if (!Array.isArray(body.closes) || body.closes.length === 0) {
      return res.json({
        status: true,
        signal: "WAIT",
        reason: "Closes data missing",
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
        reason: "Symbol missing",
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
    // 🔒 NEW CONTEXT BUILDING
    // -------------------------------
    const marketBreadth = getMarketBreadth(body.breadthData || []);
    const marketStructure = analyzeMarketStructure({
      highs: body.highs || [],
      lows: body.lows || [],
    });

    const marketRegime = getMarketRegime({
      ema20: body.ema20 || [],
      ema50: body.ema50 || [],
      structure: marketStructure.structure,
    });

    const priceAction = analyzePriceAction({
      open: body.open,
      high: body.high,
      low: body.low,
      close: body.close,
    });

    const volumeContext = validateVolume({
      volume: body.volume,
      avgVolume: body.avgVolume,
    });

    const strongBuyContext = getStrongBuyContext({
      structure: marketStructure,
      priceAction,
      volume: volumeContext,
      regime: marketRegime,
    });

    // -------------------------------
    // ENGINE INPUT (FULLY WIRED)
    // -------------------------------
    const data = {
      symbol,
      segment,
      instrumentType: indexConfig.instrumentType,

      closes: body.closes,
      ema20: body.ema20 || [],
      ema50: body.ema50 || [],
      rsi: body.rsi,
      close: body.close,
      prevClose: body.prevClose,

      support: body.support,
      resistance: body.resistance,

      volume: body.volume,
      avgVolume: body.avgVolume,

      oiData: Array.isArray(body.oiData) ? body.oiData : [],
      pcrValue: typeof body.pcrValue === "number" ? body.pcrValue : null,

      isResultDay: body.isResultDay === true,
      isExpiryDay: body.isExpiryDay === true,
      tradeCountToday: Number(body.tradeCountToday || 0),
      tradeType,

      vix: typeof body.vix === "number" ? body.vix : null,

      // 🔒 NEW LOCKED CONTEXT
      marketBreadth,
      marketStructure,
      marketRegime,
      priceAction,
      volumeContext,
      strongBuyContext,
    };

    // -------------------------------
    // FINAL DECISION
    // -------------------------------
    const result = finalDecision(data);

    // -------------------------------
    // FINAL RESPONSE
    // -------------------------------
    return res.json({
      status: true,

      symbol,
      segment,
      exchange: indexConfig.exchange,
      instrumentType: indexConfig.instrumentType,

      signal: result.signal,                // BUY / SELL / STRONG BUY / STRONG SELL / WAIT
      trend: result.trend || null,
      marketRegime: marketRegime.regime,

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
      signal: "WAIT",
      reason: "Signal processing failed",
    });
  }
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getSignal,
};
