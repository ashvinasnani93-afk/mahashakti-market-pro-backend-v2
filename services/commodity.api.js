// ==========================================
// COMMODITY API (PHASE-C2)
// Entry point for Commodity module
// Direction / Zone based output
// NO EXECUTION | FRONTEND READY
// ==========================================

const { decideCommodityTrade } = require("./commodityDecision.service");

// ==========================================
// POST /commodity
// ==========================================
function getCommodity(req, res) {
  try {
    const body = req.body;

    // -----------------------------
    // BASIC INPUT CHECK
    // -----------------------------
    if (!body || typeof body !== "object") {
      return res.json({
        status: false,
        message: "Invalid commodity input",
      });
    }

    if (!body.commodity || typeof body.price !== "number") {
      return res.json({
        status: false,
        message: "commodity and price required",
      });
    }

    // -----------------------------
    // NORMALIZED INPUT
    // -----------------------------
    const decisionInput = {
      commodity: body.commodity,               // GOLD / SILVER / CRUDE / NATURAL_GAS
      price: body.price,
      trend: body.trend || "SIDEWAYS",         // UPTREND / DOWNTREND / SIDEWAYS
      userType: body.userType || "FREE",       // FREE / TRIAL / PRO
      safetyInput: {
        isEventDay: body.isEventDay === true,
        isSpikeCandle: body.isSpikeCandle === true,
        volatility: body.volatility || "NORMAL", // LOW / NORMAL / HIGH
      },
    };

    // -----------------------------
    // COMMODITY DECISION ENGINE
    // -----------------------------
    const result = decideCommodityTrade(decisionInput);

    // -----------------------------
    // FINAL RESPONSE (FRONTEND SAFE)
    // -----------------------------
  return res.json({
  status: true,
  commodity: decisionInput.commodity,
  price: decisionInput.price,

  view: {
    mode: result.mode || "INFO",
    direction: result.direction || null,
    zone: result.zone || null,
    note: result.note || "Commodity advisory",
    riskNote: result.riskNote || null,
  },

  disclaimer: "No execution | Capital at risk",
});
  } catch (e) {
    console.error("❌ Commodity API Error:", e.message);

    return res.json({
      status: false,
      message: "Commodity processing error",
    });
  }
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getCommodity,
};
