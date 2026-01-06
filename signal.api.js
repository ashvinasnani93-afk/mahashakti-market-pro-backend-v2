// ==========================================
// SIGNAL API – FINAL (MERGED + CHAT READY)
// BUY / SELL / STRONG BUY / STRONG SELL / WAIT
// ==========================================

const { finalDecision } = require("./signalDecision.service");
const { getIndexConfig } = require("./services/indexMaster.service");

// 🔒 EXISTING CONTEXT / LOCKED MODULES
const { getMarketBreadth } = require("./services/marketBreadth.service");
const { detectMarketRegime } = require("./services/marketRegime.service");
const { analyzeMarketStructure } = require("./services/marketStructure.service");
const { analyzePriceAction } = require("./services/priceAction.service");
const { validateVolume } = require("./services/volumeValidation.service");
const { generateStrongSignal } = require("./services/strongBuy.engine");

// 🆕 CONTEXT ONLY (NO SIGNAL CHANGE)
const { scanMomentum } = require("./services/momentumScanner.service");
const { analyzeInstitutionalFlow } = require("./services/institutionalFlow.service");

// 🆕 SECTOR PARTICIPATION (CONTEXT ONLY)
const {
  analyzeSectorParticipation,
} = require("./services/sectorParticipation.service");

// 🆕 CHAT FORMATTER (LOCKED UX)
const { formatSignalMessage } = require("./services/chatFormatter.util");

// ==========================================
// POST /signal
// ==========================================
function getSignal(req, res) {
  try {
    const body = req.body || {};

    // -------------------------------
    // BASIC INPUT CHECK (ORIGINAL)
    // -------------------------------
    if (!body || typeof body !== "object") {
      return res.json({ status: false, signal: "WAIT" });
    }

    if (!Array.isArray(body.closes) || body.closes.length === 0) {
      return res.json({ status: true, signal: "WAIT" });
    }

    const symbol = body.symbol || body.indexName;
    if (!symbol) {
      return res.json({ status: true, signal: "WAIT" });
    }

    const indexConfig = getIndexConfig(symbol);
    if (!indexConfig) {
      return res.json({ status: true, signal: "WAIT" });
    }

    const segment = body.segment || "EQUITY";
    const tradeType = body.tradeType || "INTRADAY";

    // -------------------------------
    // ORIGINAL CONTEXT BUILDING (UNCHANGED)
    // -------------------------------
    const marketBreadth = getMarketBreadth(body.breadthData || {});
    const marketStructure = analyzeMarketStructure(body);
    const marketRegime = detectMarketRegime(body);
    const priceAction = analyzePriceAction(body);
    const volumeContext = validateVolume({
      currentVolume: body.volume,
      averageVolume: body.avgVolume,
      priceDirection: "UP",
    });

    // -------------------------------
    // ENGINE INPUT (ORIGINAL FLOW)
    // -------------------------------
    const engineData = {
      symbol,
      segment,
      instrumentType: indexConfig.instrumentType,

      closes: body.closes,
      ema20: body.ema20,
      ema50: body.ema50,
      rsi: body.rsi,

      close: body.close,
      prevClose: body.prevClose,

      support: body.support,
      resistance: body.resistance,

      volume: body.volume,
      avgVolume: body.avgVolume,

      breadth: marketBreadth,

      oiData: Array.isArray(body.oiData) ? body.oiData : [],
      pcrValue: typeof body.pcrValue === "number" ? body.pcrValue : null,

      isResultDay: body.isResultDay === true,
      isExpiryDay: body.isExpiryDay === true,
      tradeCountToday: Number(body.tradeCountToday || 0),
      tradeType,

      vix: typeof body.vix === "number" ? body.vix : null,
    };

    // -------------------------------
    // FINAL DECISION (ENTRY ENGINE)
    // -------------------------------
    const result = finalDecision(engineData);

    // =================================================
    // 🆕 CONTEXT ADDITION (POST-DECISION, SAFE)
    // =================================================

    // Momentum (scanner only)
    const momentumResult = scanMomentum({
      price: body.close,
      currentVolume: body.volume,
      avgVolume: body.avgVolume,
      rangeHigh: body.rangeHigh,
      close: body.close,
    });

    // Institutional (hawaa only)
    const institutional = analyzeInstitutionalFlow({
      fiiNet: body.fiiNet,
      diiNet: body.diiNet,
    });

    // 🆕 Sector Participation (context only)
    const sectorParticipation = analyzeSectorParticipation(
      body.sectors || []
    );

    // -------------------------------
    // CHAT FORMAT (LOCKED UX RULE)
    // -------------------------------
    const chat = formatSignalMessage({
      symbol,
      signal: result.signal,
      momentumActive: momentumResult.active === true,
      institutionalTag: institutional.tag,
      sectorTag: sectorParticipation.participation,
    });

    // -------------------------------
    // FINAL RESPONSE (MERGED)
    // -------------------------------
    return res.json({
      status: true,

      symbol,
      segment,
      exchange: indexConfig.exchange,
      instrumentType: indexConfig.instrumentType,

      // 🔒 CORE SIGNAL
      signal: chat.signal,
      display: chat.display,
      lines: chat.lines,
// 🆕 BACKWARD SAFE (COLOR / EMOJI LOCK)
  color: chat.display,
  emoji: chat.display,
      // OPTIONAL RAW FLAGS (UI)
      momentumActive: momentumResult.active === true,
      institutionalTag: institutional.tag,
      sectorParticipation: sectorParticipation.participation,
    });
  } catch (e) {
    console.error("❌ Signal API Error:", e.message);
    return res.json({
      status: false,
      signal: "WAIT",
    });
  }
}

module.exports = {
  getSignal,
};
