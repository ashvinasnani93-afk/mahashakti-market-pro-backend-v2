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
    // 🔒 RATE LIMIT (OPTIONAL — UNCOMMENT WHEN LIVE)
    /*
    const allowed = checkRateLimit(req, 20, 60 * 1000);
    if (!allowed) {
      return res.json({
        status: true,
        signal: "WAIT",
        display: "🟡 WAIT",
        lines: ["Rate limit active — slow down"],
        emoji: "🟡",
        color: "WAIT",
      });
    }
    */

    const body = req.body || {};

    // -------------------------------
    // BASIC INPUT CHECK
    // -------------------------------
    if (!body || typeof body !== "object") {
      return res.json({ status: false, signal: "WAIT" });
    }

    // -------------------------------
    // INPUT NORMALIZATION (CRITICAL)
    // -------------------------------
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

    console.log("📌 SYMBOL RECEIVED:", symbol);
    console.log(
      "📌 INDEX CONFIG:",
      getIndexConfig ? getIndexConfig(symbol) : "NOT LOADED"
    );

    const indexConfig = getIndexConfig
      ? getIndexConfig(symbol)
      : null;

    const safeIndexConfig = indexConfig || {
      exchange: "NSE",
      instrumentType: "INDEX",
    };

    const segment = body.segment || "EQUITY";
    const tradeType = body.tradeType || "INTRADAY";

    // -------------------------------
    // CONTEXT BUILDING
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

      // ===== CURRENT CANDLE =====
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

      // ===== EMA / RSI (SAFE MODE) =====
      ema20:
        typeof body.ema20 === "number"
          ? [body.ema20]
          : Array.isArray(body.ema20) && body.ema20.length
          ? body.ema20
          : [],

      ema50:
        typeof body.ema50 === "number"
          ? [body.ema50]
          : Array.isArray(body.ema50) && body.ema50.length
          ? body.ema50
          : [],

      rsi: typeof body.rsi === "number" ? body.rsi : null,

      // ===== LEVELS =====
      support:
        typeof body.support === "number"
          ? body.support
          : null,

      resistance:
        typeof body.resistance === "number"
          ? body.resistance
          : null,

      rangeHigh:
        typeof body.rangeHigh === "number"
          ? body.rangeHigh
          : null,

      rangeLow:
        typeof body.rangeLow === "number"
          ? body.rangeLow
          : null,

      // ===== VOLUME =====
      volume:
        typeof body.volume === "number"
          ? body.volume
          : null,

      avgVolume:
        typeof body.avgVolume === "number"
          ? body.avgVolume
          : null,

      volumeContext,

      // ===== MARKET CONTEXT =====
      breadth: marketBreadth,
      marketStructure,
      marketRegime,
      priceAction,

      // ===== CANDLE METRICS =====
      candleSizePercent:
        typeof body.candleSizePercent === "number"
          ? body.candleSizePercent
          : typeof body.high === "number" &&
            typeof body.low === "number" &&
            typeof body.prevClose === "number"
          ? ((body.high - body.low) / body.prevClose) * 100
          : 0,

      overlapPercent:
        typeof body.overlapPercent === "number"
          ? body.overlapPercent
          : 30,

      // ===== SECTOR =====
      sectors: Array.isArray(body.sectors)
        ? body.sectors
        : [],

      // ===== INSTITUTIONAL =====
      oiData: Array.isArray(body.oiData)
        ? body.oiData
        : [],

      pcrValue:
        typeof body.pcrValue === "number"
          ? body.pcrValue
          : null,

      // ===== SAFETY FLAGS =====
      isResultDay: body.isResultDay === true,
      isExpiryDay: body.isExpiryDay === true,
      tradeCountToday: Number(body.tradeCountToday || 0),
      tradeType,

      // ===== VIX (TEXT ONLY) =====
      vix:
        typeof body.vix === "number"
          ? body.vix
          : null,
    };

    // ==========================================
    // HARD SAFETY — ENSURE CLOSE EXISTS
    // ==========================================
    engineData.close =
      engineData.close ??
      (Array.isArray(engineData.closes)
        ? engineData.closes[engineData.closes.length - 1]
        : undefined);

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

    // ==========================================
    // DEBUG (TEMPORARY)
    // ==========================================
    console.log("🧠 ENGINE DATA CHECK:", {
      close: engineData.close,
      ema20: engineData.ema20,
      ema50: engineData.ema50,
      rsi: engineData.rsi,
      volume: engineData.volume,
      avgVolume: engineData.avgVolume,
      tradeType: engineData.tradeType,
      rangeHigh: engineData.rangeHigh,
      rangeLow: engineData.rangeLow,
    });

    // -------------------------------
    // FINAL DECISION ENGINE
    // -------------------------------
    const result = finalDecision(engineData);

    // ==========================================
    // CONTEXT ADDITION (POST DECISION)
    // ==========================================
    console.log("🔥 MOMENTUM DEBUG:", {
      close: engineData.close,
      rangeHigh: engineData.rangeHigh,
      rangeLow: engineData.rangeLow,
      volume: engineData.volume,
      avgVolume: engineData.avgVolume,
    });

    const momentumResult = scanMomentum({
      price: engineData.close,
      currentVolume: engineData.volume,
      avgVolume: engineData.avgVolume,
      rangeHigh: engineData.rangeHigh,
      rangeLow: engineData.rangeLow,
      close: engineData.close,
    });

    const institutional = analyzeInstitutionalFlow({
      fiiNet: body.fiiNet,
      diiNet: body.diiNet,
    });

    const sectorParticipation = analyzeSectorParticipation(
      body.sectors || []
    );

    // -------------------------------
    // CHAT FORMAT (LOCKED UX)
    // -------------------------------
    const chat = formatSignalMessage({
      symbol,
      signal: result.signal,
      momentumActive: momentumResult.active === true,
      institutionalTag: institutional.tag,
      sectorTag: sectorParticipation.participation,
    });

    const rawSignal =
      typeof result?.signal === "string"
        ? result.signal
        : "WAIT";

    // -------------------------------
    // FINAL RESPONSE
    // -------------------------------
    return res.json({
      status: true,
      symbol,
      segment,
      exchange: safeIndexConfig.exchange,
      instrumentType: safeIndexConfig.instrumentType,

      signal: rawSignal,
      display: chat.display,
      lines: chat.lines,

      emoji:
        typeof chat.display === "string"
          ? chat.display.split(" ")[0]
          : "🟡",

      color: rawSignal,

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

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getSignal,
};
