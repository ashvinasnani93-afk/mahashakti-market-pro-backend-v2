// ==========================================
// OPTION CHAIN CONTROLLER – FINAL (A3.3)
// Angel = SINGLE SOURCE OF TRUTH
// ==========================================

const { getValidStrikes } = require("../strike.service");
const { buildOptionChain } = require("../optionChain.service");

// ==========================================
// GET OPTION CHAIN
// /option-chain?index=BANKNIFTY&expiry=2025-01-30
// ==========================================
async function getOptionChain(req, res) {
  try {
    const { index, expiry } = req.query;

    // -------------------------------
    // VALIDATION
    // -------------------------------
    if (!index || !expiry) {
      return res.json({
        status: false,
        message: "index and expiry required",
      });
    }

    const INDEX = index.toUpperCase();
    const expiryDate = new Date(expiry);

    if (isNaN(expiryDate.getTime())) {
      return res.json({
        status: false,
        message: "invalid expiry date",
      });
    }

    // -------------------------------
    // STRIKES (ANGEL VALIDATED)
    // -------------------------------
    const strikes = getValidStrikes({
      index: INDEX,
      expiryDate,
    });

    // -------------------------------
    // BUILD OPTION CHAIN
    // -------------------------------
    const chain = buildOptionChain({
      index: INDEX,
      expiryDate,
      strikes,
    });

    // -------------------------------
    // RESPONSE
    // -------------------------------
    return res.json({
      status: true,
      index: INDEX,
      expiry: expiryDate.toISOString().slice(0, 10),
      strikes: Object.keys(chain).length,
      chain,
    });
  } catch (e) {
    console.error("❌ OptionChain Error:", e.message);
    return res.json({
      status: false,
      message: "option chain error",
    });
  }
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getOptionChain,
};
