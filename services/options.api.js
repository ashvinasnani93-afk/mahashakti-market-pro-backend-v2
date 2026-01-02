// ==========================================
// OPTIONS API (PHASE-4)
// Entry point for Options module
// Context + Signal + FINAL DECISION
// NO EXECUTION | FRONTEND READY
// ==========================================

const { getOptionsContext } = require("./optionsMaster.service");
const { generateOptionsSignal } = require("./optionsSignal.engine");
const { decideOptionTrade } = require("./optionDecision.service");

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
      expiry: body.expiry,           // WEEKLY / MONTHLY
      tradeType: body.tradeType,     // INTRADAY / POSITIONAL
      isResultDay: body.isResultDay === true,
      isExpiryDay: body.isExpiryDay === true,
    });

    if (optionsContext.status !== "READY") {
      return res.json({
        status: true,
        context: optionsContext,
      });
    }

    // -----------------------------
    // STEP 2: OPTIONS SIGNAL ENGINE
    // Buyer / Seller permission
    // -----------------------------
    const signalResult = generateOptionsSignal({
      ...optionsContext,
      ema20: typeof body.ema20 === "number" ? body.ema20 : undefined,
      ema50: typeof body.ema50 === "number" ? body.ema50 : undefined,
      rsi: typeof body.rsi === "number" ? body.rsi : undefined,
      vix: typeof body.vix === "number" ? body.vix : undefined,
    });

    // -----------------------------
    // STEP 3: FINAL OPTION DECISION
    // BUY / SELL / NO_TRADE (TEXT ONLY)
    // -----------------------------
    const finalDecision = decideOptionTrade({
      ...optionsContext,
      ...signalResult,
      ema20: body.ema20,
      ema50: body.ema50,
      rsi: body.rsi,
      vix: body.vix,
    });

    // -----------------------------
    // FINAL API RESPONSE
    // -----------------------------
    return res.json({
      status: true,
      context: optionsContext,
      signal: signalResult,
      decision: finalDecision,
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
