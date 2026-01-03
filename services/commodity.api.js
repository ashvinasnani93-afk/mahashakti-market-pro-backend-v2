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
    // COMMODITY DECISION ENGINE
    // -----------------------------
    const result = decideCommodityTrade({
      commodity: body.commodity,          // GOLD / SILVER / CRUDE / NATURAL_GAS
      price: body.price,
      trend: body.trend,                  // UPTREND / DOWNTREND / SIDEWAYS
      userType: body.userType || "FREE",  // FREE / TRIAL / PRO
      safetyInput: {
        isEventDay: body.isEventDay === true,
        isSpikeCandle: body.isSpikeCandle === true,
        volatility: body.volatility || "NORMAL", // LOW / NORMAL / HIGH
      },
    });

    // -----------------------------
    // FINAL RESPONSE
    // -----------------------------
    return res.json({
      status: true,
      data: result,
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
