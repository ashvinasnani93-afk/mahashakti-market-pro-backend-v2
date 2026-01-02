// ==========================================
// OPTIONS API (PHASE-3)
// Entry point for Options module
// Context + Safety + Buyer/Seller Regime
// NO EXECUTION | FRONTEND READY
// ==========================================

const { getOptionsContext } = require("./optionsMaster.service");
const { generateOptionsSignal } = require("./optionsSignal.engine");

// ==========================================
// POST /options/context
// ==========================================
function getOptions(req, res) {
  try {
    const body = req.body;

    // -----------------------------
    // BASIC INPUT CHECK
    // -----------------------------
    if (!body || typeof body !== "object") {
      return res.json({
        status: false,
        message: "Invalid options input",
      });
    }

    if (!body.symbol || typeof body.spotPrice !== "number") {
      return res.json({
        status: false,
        message: "symbol and spotPrice required",
      });
    }

    // -----------------------------
    // STEP 1: OPTIONS MASTER CONTEXT
    // -----------------------------
    const optionsContext = getOptionsContext({
      symbol: body.symbol,
      spotPrice: body.spotPrice,
      expiry: body.expiry,         // WEEKLY / MONTHLY
      tradeType: body.tradeType,   // INTRADAY / POSITIONAL
    });

    if (optionsContext.status !== "READY") {
      return res.json({
        status: true,
        context: optionsContext,
      });
    }

    // -----------------------------
    // STEP 2: OPTIONS SIGNAL ENGINE
    // (Buyer / Seller permission only)
    // -----------------------------
    const signalResult = generateOptionsSignal({
      ...optionsContext,
      ema20: body.ema20,
      ema50: body.ema50,
      rsi: body.rsi,
      vix: body.vix, // optional, safety-only
    });

    // -----------------------------
    // FINAL API RESPONSE
    // -----------------------------
    return res.json({
      status: true,
      context: optionsContext,
      signal: signalResult,
    });
  } catch (e) {
    console.error("❌ Options API Error:", e.message);

    return res.json({
      status: false,
      message: "Options processing error",
    });
  }
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getOptions,
};
