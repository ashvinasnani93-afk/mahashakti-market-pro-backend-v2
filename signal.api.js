// ==========================================
// SIGNAL API – FINAL (MERGED + CHAT READY)
// BUY / SELL / STRONG BUY / STRONG SELL / WAIT
// ==========================================

const { finalDecision } = require("./signalDecision.service");
const { getIndexConfig } = require("./services/indexMaster.service");

// 🔒 EXISTING CONTEXT / LOCKED MODULES
const { analyzeMarketBreadth } = require("./services/marketBreadth.service");
const { detectMarketRegime } = require("./services/marketRegime.service");
const { analyzeMarketStructure } = require("./services/marketStructure.service");
const { analyzePriceAction } = require("./services/priceAction.service");
const { validateVolume } = require("./services/volumeValidation.service");
const { checkRateLimit } = require("./services/rateLimit.util");
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

    // 🔒 RATE LIMIT (Carry-6.1)
    const allowed = checkRateLimit(req, 20, 60 * 1000);
    if (!allowed) {
      return res.json({
        status: true,
        signal: "🟡",
        display: "🟡",
        lines: ["Trade signal generated"],
      });
    }

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
console.log("SYMBOL RECEIVED:", symbol);
console.log("INDEX CONFIG:", getIndexConfig(symbol));
    const indexConfig = getIndexConfig(symbol);
    if (!indexConfig) {
      return res.json({ status: true, signal: "WAIT" });
    }

    const segment = body.segment || "EQUITY";
    const tradeType = body.tradeType || "INTRADAY";

    // -------------------------------
    // ORIGINAL CONTEXT BUILDING (UNCHANGED)
    // -------------------------------
 const marketBreadth = analyzeMarketBreadth(body.breadthData || {});   
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

 // ===== EMA / RSI (Carry-2 FIX) =====
ema20: Array.isArray(body.ema20)
  ? body.ema20
  : typeof body.ema20 === "number"
  ? [body.ema20]
  : [],

ema50: Array.isArray(body.ema50)
  ? body.ema50
  : typeof body.ema50 === "number"
  ? [body.ema50]
  : [],

rsi: typeof body.rsi === "number" ? body.rsi : null,

  // ===== LEVELS =====
  support: typeof body.support === "number" ? body.support : null,
  resistance: typeof body.resistance === "number" ? body.resistance : null,

  // ===== VOLUME =====
  volume: typeof body.volume === "number" ? body.volume : null,
  avgVolume: typeof body.avgVolume === "number" ? body.avgVolume : null,

  // ===== MARKET CONTEXT =====
  breadth: marketBreadth,

// ===== CANDLE SIZE (SAFE FIX) =====
candleSizePercent:
  typeof body.candleSizePercent === "number"
    ? body.candleSizePercent
    : (
        typeof body.high === "number" &&
        typeof body.low === "number" &&
        typeof body.prevClose === "number"
      )
      ? ((body.high - body.low) / body.prevClose) * 100
      : 0,

// Overlap %
 overlapPercent:
  typeof body.overlapPercent === "number"
    ? body.overlapPercent
    : 30,

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
// RAW SIGNAL (SAFE)
const rawSignal =
  typeof result?.signal === "string"
    ? result.signal
    : "WAIT";

// FINAL RESPONSE
return res.json({
  status: true,
  symbol,
  segment,
  exchange: indexConfig.exchange,
  instrumentType: indexConfig.instrumentType,

  // 🔒 LOCKED OUTPUT
  signal: rawSignal,              // RAW
  display: chat.display,          // 🟢 BUY / 🔴🔥 STRONG SELL
  lines: chat.lines,

 emoji: typeof chat.display === "string"
  ? chat.display.split(" ")[0]
  : "🟡",
  color: rawSignal,               // frontend map karega

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
