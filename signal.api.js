// ==========================================
// SIGNAL API – FINAL (MERGED + CHAT READY)
// BUY / SELL / STRONG BUY / STRONG SELL / WAIT
// ==========================================

const { finalDecision } = require("./signalDecision.service");
let getIndexConfig;
try {
  ({ getIndexConfig } = require("./services/indexMaster.service"));
} catch (e) {
  getIndexConfig = null;
}

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
 //   const allowed = checkRateLimit(req, 20, 60 * 1000);
//    if (!allowed) {
//      return res.json({
//        status: true,
//        signal: "🟡",
//        display: "🟡",
//        lines: ["Trade signal generated"],
//      });
//    }

    const body = req.body || {};
    // -------------------------------
    // BASIC INPUT CHECK (ORIGINAL)
    // -------------------------------
    if (!body || typeof body !== "object") {
      return res.json({ status: false, signal: "WAIT" });
    }

// ✅ INPUT NORMALIZATION (CRITICAL FIX)
const normalizedClose =
  typeof body.close === "number"
    ? body.close
    : typeof body.spotPrice === "number"
    ? body.spotPrice
    : null;

if (typeof normalizedClose !== "number") {
  return res.json({ status: false, signal: "WAIT" });
} 

    const symbol = body.symbol || body.indexName;
    if (!symbol) {
      return res.json({ status: true, signal: "WAIT" });
    }
console.log("SYMBOL RECEIVED:", symbol);
console.log("INDEX CONFIG:", getIndexConfig(symbol));
  const indexConfig = getIndexConfig ? getIndexConfig(symbol) : null;

const safeIndexConfig = indexConfig || {
  exchange: "NSE",
  instrumentType: "INDEX",
};

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
     priceDirection:
  typeof body.close === "number" &&
  typeof body.prevClose === "number" &&
  body.close < body.prevClose
    ? "DOWN"
    : "UP",
    });

// ==========================================
// ENGINE INPUT (FINAL – SAFE + LOCKED)
// Carry-2.1 + Carry-2.2 + Carry-2.3
// ==========================================

const engineData = {
  symbol,
  segment,
  instrumentType: safeIndexConfig.instrumentType,

  // ===== CORE PRICE SERIES =====
 closes: Array.isArray(body.closes)
  ? body.closes
  : [normalizedClose],
 highs: Array.isArray(body.highs)
  ? body.highs
  : [normalizedClose],

lows: Array.isArray(body.lows)
  ? body.lows
  : [normalizedClose],

  // ===== CURRENT CANDLE (PRICE ACTION) =====
 
// 🔒 SAFE FALLBACKS (TESTING + LIVE SUPPORT)
open:
  typeof body.open === "number"
    ? body.open
    : normalizedClose,

high:
  typeof body.high === "number"
    ? body.high
    : normalizedClose,

low:
  typeof body.low === "number"
    ? body.low
    : normalizedClose,

prevClose:
  typeof body.prevClose === "number"
    ? body.prevClose
    : normalizedClose,
 // ===== EMA / RSI (Carry-2 FIX) =====
ema20:
  typeof body.ema20 === "number"
    ? [body.ema20]
    : Array.isArray(body.ema20) && body.ema20.length
    ? body.ema20
    : [normalizedClose],

ema50:
  typeof body.ema50 === "number"
    ? [body.ema50]
    : Array.isArray(body.ema50) && body.ema50.length
    ? body.ema50
    : [normalizedClose],

rsi: typeof body.rsi === "number" ? body.rsi : null,

 // ===== LEVELS =====
support: typeof body.support === "number" ? body.support : null,
resistance: typeof body.resistance === "number" ? body.resistance : null,

// ✅ ADD THIS (CRITICAL)
rangeHigh:
  typeof body.rangeHigh === "number"
    ? body.rangeHigh
    : null,
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

// FIX: Ensure close price exists for engine & momentum
engineData.close =
  engineData.close ??
  (Array.isArray(engineData.closes)
    ? engineData.closes[engineData.closes.length - 1]
    : undefined);

// 🔐 ADD-2: SAFETY GUARD (YAHI ADD KARO)
if (typeof engineData.close !== "number") {
  return res.json({
    status: true,
    signal: "WAIT",
    display: "🟡 WAIT",
    lines: ["Price not stable yet"],
    emoji: "🟡",
    color: "WAIT",
  });
}

// 🔍 STEP-4 DEBUG (ENGINE INPUT CHECK – TEMPORARY)
console.log("🧠 ENGINE DATA CHECK:", {
  close: engineData.close,
  ema20: engineData.ema20,
  ema50: engineData.ema50,
  rsi: engineData.rsi,
  volume: engineData.volume,
  avgVolume: engineData.avgVolume,
  tradeType: engineData.tradeType,
});
    // -------------------------------
    // FINAL DECISION (ENTRY ENGINE)
    // -------------------------------
    const result = finalDecision(engineData);

    // =================================================
    // 🆕 CONTEXT ADDITION (POST-DECISION, SAFE)
    // =================================================

   // 🔥 STEP-3 DEBUG (TEMPORARY)
console.log("🔥 MOMENTUM DEBUG:", {
  close: engineData.close,
  rangeHigh: engineData.rangeHigh,
  volume: engineData.volume,
  avgVolume: engineData.avgVolume,
});

// Momentum (scanner only)
const momentumResult = scanMomentum({
  price: engineData.close,
  currentVolume: engineData.volume,
  avgVolume: engineData.avgVolume,
  rangeHigh: engineData.rangeHigh,
  close: engineData.close,
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
 exchange: safeIndexConfig.exchange,
instrumentType: safeIndexConfig.instrumentType,
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
