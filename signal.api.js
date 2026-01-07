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

// ==========================================
// ENGINE INPUT (FINAL – SAFE + LOCKED)
// Carry-2.1 + Carry-2.2 + Carry-2.3
// ==========================================

const engineData = {
  symbol,
  segment,
  instrumentType: indexConfig.instrumentType,

  // ===== CORE PRICE SERIES =====
  closes: Array.isArray(body.closes) ? body.closes : [],
  highs: Array.isArray(body.highs) ? body.highs : [],
  lows: Array.isArray(body.lows) ? body.lows : [],

  // ===== CURRENT CANDLE (PRICE ACTION) =====
  open: typeof body.open === "number" ? body.open : null,
  high: typeof body.high === "number" ? body.high : null,
  low: typeof body.low === "number" ? body.low : null,
  close: typeof body.close === "number" ? body.close : null,
  prevClose: typeof body.prevClose === "number" ? body.prevClose : null,

  // ===== EMA / RSI =====
  ema20: Array.isArray(body.ema20) ? body.ema20 : [],
  ema50: Array.isArray(body.ema50) ? body.ema50 : [],
  rsi: typeof body.rsi === "number" ? body.rsi : null,

  // ===== LEVELS =====
  support: typeof body.support === "number" ? body.support : null,
  resistance: typeof body.resistance === "number" ? body.resistance : null,

  // ===== VOLUME =====
  volume: typeof body.volume === "number" ? body.volume : null,
  avgVolume: typeof body.avgVolume === "number" ? body.avgVolume : null,

  // ===== MARKET CONTEXT =====
  breadth: marketBreadth,

  // ===== REGIME HELPERS (SAFE DEFAULTS) =====
  candleSizePercent:
    typeof body.candleSizePercent === "number"
      ? body.candleSizePercent
      : 0,

  overlapPercent:
    typeof body.overlapPercent === "number"
      ? body.overlapPercent
      : 0,

  // ===== SECTOR PARTICIPATION (Carry-1.1) =====
  sectors: Array.isArray(body.sectors) ? body.sectors : [],

  // ===== INSTITUTIONAL (PASS-THROUGH) =====
  oiData: Array.isArray(body.oiData) ? body.oiData : [],
  pcrValue:
    typeof body.pcrValue === "number" ? body.pcrValue : null,

  // ===== SAFETY FLAGS =====
  isResultDay: body.isResultDay === true,
  isExpiryDay: body.isExpiryDay === true,
  tradeCountToday: Number(body.tradeCountToday || 0),
  tradeType,

  // ===== VIX (TEXT CONTEXT ONLY) =====
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

// ==========================================
// 🔒 CARRY-2.5: CHAT TEXT EDGE-CASE SAFETY
// Ensures chat lines are NEVER empty or broken
// ==========================================

let safeSignal =
  typeof chat?.signal === "string"
    ? chat.signal
    : result.signal || "WAIT";

const safeDisplay = safeSignal;


// ==========================================
// 🔒 STEP: SIGNAL-ONLY OUTPUT (NO REASON)
// ==========================================



// Signal icon mapping (LOCKED)
if (safeSignal === "STRONG_BUY") {
  safeSignal = "🟢🔥";
} else if (safeSignal === "STRONG_SELL") {
  safeSignal = "🔴🔥";
} else if (safeSignal === "BUY") {
  safeSignal = "🟢";
} else if (safeSignal === "SELL") {
  safeSignal = "🔴";
} else {
  safeSignal = "🟡";
}

// Lines ko simple rakho (NO REASON)
const safeLines = [];
 // -------------------------------
    // FINAL RESPONSE (MERGED)
    // -------------------------------
   return res.json({
  status: true,
  symbol,
  segment,
  exchange: indexConfig.exchange,
  instrumentType: indexConfig.instrumentType,

  // 🔒 CORE OUTPUT (CARRY-2.4 SAFE)
  signal: safeSignal,
  display: safeDisplay,
  lines: safeLines,

  // 🔒 BACKWARD SAFE FIELDS (COLOR / EMOJI LOCK)
  color: safeSignal,
emoji: safeSignal,

  // OPTIONAL CONTEXT (UI ONLY)
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
