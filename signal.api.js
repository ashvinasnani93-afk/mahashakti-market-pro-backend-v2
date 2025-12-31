// ==========================================
// SIGNAL API – ANDROID READY
// BUY / SELL / WAIT
// ==========================================

const { finalDecision } = require("./signalDecision.service");

// ==========================================
// POST /signal
// ==========================================
function getSignal(req, res) {
  try {
    const data = req.body;

    // -------------------------------
    // BASIC INPUT CHECK
    // -------------------------------
    if (!data || typeof data !== "object") {
      return res.json({
        status: false,
        message: "input data missing or invalid",
      });
    }

    // -------------------------------
    // FINAL DECISION ENGINE
    // -------------------------------
    const result = finalDecision(data);

    return res.json({
      status: true,
      signal: result.signal,          // BUY / SELL / WAIT
      trend: result.trend || null,    // UPTREND / DOWNTREND / null
      reason: result.reason,          // clear explanation
    });
  } catch (e) {
    console.error("❌ Signal API Error:", e);

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
