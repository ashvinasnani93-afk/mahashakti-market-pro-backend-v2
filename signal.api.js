// ==========================================
// SIGNAL API – FINAL (PHASE-2A READY)
// BUY / SELL / WAIT
// ANDROID READY + SAFETY + INSTITUTIONAL
// ==========================================

const { finalDecision } = require("./signalDecision.service");

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
    // NORMALIZED DATA
    // (ENGINE + SAFETY + INSTITUTIONAL)
    // -------------------------------
    const data = {
      // ===== PRICE / TECHNICAL =====
      closes: body.closes,
      ema20: body.ema20 || [],
      ema50: body.ema50 || [],
      rsi: body.rsi,
      close: body.close,
      support: body.support,
      resistance: body.resistance,
      volume: body.volume,
      avgVolume: body.avgVolume,

      // ===== INSTITUTIONAL (PHASE-2A REAL) =====
      oiData: Array.isArray(body.oiData) ? body.oiData : [],
      pcrValue:
        typeof body.pcrValue === "number" ? body.pcrValue : null,

      // ===== SAFETY CONTEXT (PHASE-1 LOCKED) =====
      isResultDay: body.isResultDay === true,
      isExpiryDay: body.isExpiryDay === true,
      tradeCountToday: Number(body.tradeCountToday || 0),
      tradeType: body.tradeType || "INTRADAY",

      // ===== VIX (SAFETY TEXT ONLY – LOCKED RULE) =====
      vix: typeof body.vix === "number" ? body.vix : null,
    };

    // -------------------------------
    // FINAL DECISION ENGINE
    // -------------------------------
    const result = finalDecision(data);

    // -------------------------------
    // VIX SAFETY NOTE (TEXT ONLY)
    // ❌ No signal change allowed
    // -------------------------------
    let vixNote = null;

    if (typeof data.vix === "number") {
      if (data.vix >= 18) {
        vixNote = "High volatility (VIX elevated) – reduce position size & expect fast moves";
      } else if (data.vix <= 12) {
        vixNote = "Low volatility (VIX calm) – breakout follow-through may be slow";
      } else {
        vixNote = "Normal volatility conditions";
      }
    }

    return res.json({
      status: true,
      signal: result.signal,        // BUY / SELL / WAIT
      trend: result.trend || null,  // UPTREND / DOWNTREND / null
      reason: result.reason,        // explainable output
      vixNote,                      // 🟡 SAFETY CONTEXT ONLY
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
